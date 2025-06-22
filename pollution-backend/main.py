from fastapi import FastAPI, HTTPException, Depends, UploadFile, File
import numpy as np
import xarray as xr
import pandas as pd
from pydantic import BaseModel
import sqlite3
from fastapi.responses import JSONResponse, StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
import matplotlib.pyplot as plt
import matplotlib.colors as mcolors
import io
import os
import time
import logging
from auth import router as auth_router

# Настройка логирования
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI()
app.include_router(auth_router)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Папка для хранения загруженных файлов
UPLOAD_DIR = "uploads"
if not os.path.exists(UPLOAD_DIR):
    os.makedirs(UPLOAD_DIR)

# Переменная для хранения текущего файла
current_file = os.path.join(UPLOAD_DIR, "res_annotated_all.nc")

# Список допустимых переменных
ALLOWED_VARIABLES = ["qReference", "qInit", "qRecontrsucted", "trajReference", "trajInit", "trajReconstructed"]

def get_time_coord_name(dataset):
    for name in ["time", "Times"]:
        if name in dataset.dims or name in dataset.coords:
            return name
    raise ValueError("В файле не найдена координата времени ('time' или 'Times')")

def load_dataset():
    try:
        return xr.open_dataset(current_file)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Ошибка загрузки файла {current_file}: {str(e)}")

# Endpoint для загрузки файла
@app.post("/upload_dataset")
async def upload_dataset(file: UploadFile = File(...)):
    try:
        if not file.filename.endswith('.nc'):
            raise HTTPException(status_code=400, detail="Файл должен иметь расширение .nc")

        base_name, ext = os.path.splitext(file.filename)
        file_path = os.path.join(UPLOAD_DIR, f"{base_name}_{int(time.time())}{ext}")
        logger.info(f"Попытка сохранить файл: {file_path}")

        with open(file_path, "wb") as buffer:
            buffer.write(await file.read())

        # Проверяем и обрабатываем файл
        try:
            with xr.open_dataset(file_path) as ds:
                ds = ds.load()  # загружаем в память, чтобы можно было работать после закрытия

                # Переименование координат, если нужно
                rename_map = {}
                if 'latitude' in ds.coords or 'latitude' in ds.variables:
                    rename_map['latitude'] = 'lat'
                if 'longitude' in ds.coords or 'longitude' in ds.variables:
                    rename_map['longitude'] = 'lon'
                if rename_map:
                    ds = ds.rename(rename_map)

                # Преобразование переменных в координаты, если нужно
                for coord in ['lat', 'lon']:
                    if coord in ds.variables and coord not in ds.coords:
                        ds = ds.set_coords(coord)

                # Проверка наличия координат
                for coord in ['lat', 'lon']:
                    if coord not in ds.coords:
                        raise HTTPException(status_code=400, detail=f"Файл не содержит координату '{coord}'")

                # Проверка допустимых переменных
                if not any(var in ds for var in ALLOWED_VARIABLES):
                    raise HTTPException(status_code=400, detail=f"Файл не содержит ни одной допустимой переменной: {ALLOWED_VARIABLES}")

            # Устанавливаем файл как текущий
            global current_file
            current_file = file_path
            logger.info(f"Файл успешно загружен и установлен как текущий: {file_path}")

            return {"message": f"Файл {os.path.basename(file_path)} успешно загружен", "success": True}

        except HTTPException:
            if os.path.exists(file_path):
                os.remove(file_path)
            raise
        except Exception as e:
            logger.error(f"Ошибка обработки файла {file_path}: {str(e)}")
            if os.path.exists(file_path):
                os.remove(file_path)
            raise HTTPException(status_code=400, detail=f"Ошибка обработки файла: {str(e)}")

    except Exception as e:
        logger.error(f"Ошибка загрузки файла: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Ошибка загрузки файла: {str(e)}")

@app.post("/set_dataset/{file_name}")
async def set_dataset(file_name: str):
    global current_file
    file_path = os.path.join(UPLOAD_DIR, file_name)
    
    if not os.path.exists(file_path):
        logger.error(f"Файл не найден: {file_path}")
        raise HTTPException(status_code=404, detail=f"Файл {file_name} не найден")

    try:
        with xr.open_dataset(file_path):
            current_file = file_path
            logger.info(f"Установлен новый текущий файл: {file_path}")
            return {
                "message": f"Файл данных изменен на {file_name}",
                "success": True
            }
    except Exception as e:
        logger.error(f"Ошибка загрузки файла {file_path}: {str(e)}")
        raise HTTPException(status_code=400, detail=f"Ошибка загрузки файла: {str(e)}")

@app.get("/available_datasets", response_class=JSONResponse)
async def get_available_datasets():
    try:
        datasets = [f for f in os.listdir(UPLOAD_DIR) if f.endswith('.nc')]
        logger.info(f"Возвращён список наборов данных: {datasets}")
        return JSONResponse(
            content={"datasets": datasets},
            headers={"Cache-Control": "no-cache, no-store, must-revalidate"}
        )
    except Exception as e:
        logger.error(f"Ошибка получения списка файлов: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Ошибка получения списка файлов: {str(e)}")

# Остальные эндпоинты без изменений
@app.get("/pollution/bounds")
async def get_bounds():
    dataset = load_dataset()
    lat = dataset["lat"].values
    lon = dataset["lon"].values
    return {
        "lat_min": float(lat.min()),
        "lat_max": float(lat.max()),
        "lon_min": float(lon.min()),
        "lon_max": float(lon.max())
    }

@app.get("/pollution/time")
async def get_time(time_index: int = 0):
    try:
        dataset = load_dataset()
        try:
            time = dataset['Times'].values
        except KeyError:
            time = dataset['time'].values
        try:
            base_date_str = dataset.attrs['startDateTime']
            base_date = pd.to_datetime(base_date_str, format="%Y-%m-%d_%H:%M:%S")
        except KeyError:
            base_date = pd.to_datetime("2023-01-01") 
        time_as_datetime = base_date + pd.to_timedelta(time[time_index], unit='s')

        return {
            "time": time_as_datetime.strftime('%Y-%m-%d %H:%M:%S'),
            "max_time_index": len(time) - 1
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/pollution/data_types")
async def get_data_types():
    try:
        dataset = load_dataset()
        available_types = []
        
        for data_type in ALLOWED_VARIABLES:
            if data_type in dataset:
                available_types.append(data_type)
        
        return {"data_types": available_types}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

def get_variable_data(dataset, data_type, species_index, time_index, level_index):
    time_coord = get_time_coord_name(dataset)
    try:
        data = dataset[data_type].isel(spec=species_index, **{time_coord: time_index, "levCoord": level_index})
        return np.nan_to_num(data, nan=0.0)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Ошибка получения данных переменной {data_type}: {str(e)}")

@app.get("/pollution/image")
async def get_pollution_image(
    time_index: int = 0, 
    level_index: int = 0, 
    species: str = "PM",
    data_type: str = "trajReconstructed"
):
    try:
        dataset = load_dataset()
        
        if data_type not in dataset:
            raise HTTPException(status_code=404, detail=f"Тип данных '{data_type}' не найден")
        
        lat = dataset["lat"].values
        lon = dataset["lon"].values

        raw_species = dataset["species_names"].values
        species_names = ["".join([ch.decode("utf-8") for ch in row]).strip() for row in raw_species]

        if species not in species_names:
            raise HTTPException(status_code=404, detail=f"Вещество '{species}' не найдено")

        species_index = species_names.index(species)

        data = get_variable_data(dataset, data_type, species_index, time_index, level_index)

        fig, ax = plt.subplots(figsize=(6, 4))
        contour = ax.contourf(lon, lat, data, levels=20, cmap='plasma')
        ax.axis('off')

        cbar = fig.colorbar(contour, ax=ax, orientation='vertical', shrink=0.7, pad=0.02)
        cbar.set_label('Концентрация')

        buf = io.BytesIO()
        fig.savefig(buf, format='png', bbox_inches='tight', pad_inches=0.1, transparent=True)
        buf.seek(0)
        plt.close(fig)

        return StreamingResponse(buf, media_type="image/png")
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/pollution/species")
async def get_species():
    try:
        dataset = load_dataset()
        raw_species = dataset["species_names"].values
        species_names = ["".join([ch.decode("utf-8") for ch in row]).strip() for row in raw_species]
        return {"species_names": species_names}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/pollution")
async def get_pollution_data(time_index: int = 0, level_index: int = 0):
    try:
        dataset = load_dataset()
        
        time_coord = get_time_coord_name(dataset)
        time = dataset[time_coord].values

        base_date = pd.to_datetime("1970-01-01")
        time_as_datetime = base_date + pd.to_timedelta(time[time_index], unit='s')
        
        time_str = time_as_datetime.strftime('%Y-%m-%d %H:%M:%S')

        required_vars = ["lat", "lon", "trajReconstructed"]
        for var in required_vars:
            if var not in dataset:
                raise HTTPException(status_code=500, detail=f"Переменная '{var}' отсутствует в файле.")

        lat = dataset["lat"].values
        lon = dataset["lon"].values
        trajReconstructed = dataset["trajReconstructed"].values

        trajReconstructed_slice = trajReconstructed[0, time_index, level_index, :, :]

        valid_indices = np.where(trajReconstructed_slice > 0)

        features = [
            {
                "type": "Feature",
                "geometry": {"type": "Point", "coordinates": [float(lon[i, j]), float(lat[i, j])]},
                "properties": {"concentration": float(trajReconstructed_slice[i, j])},
            }
            for i, j in zip(valid_indices[0], valid_indices[1])
        ]

        geojson_data = {
            "type": "FeatureCollection",
            "features": features,
            "time": time_str
        }

        return JSONResponse(content=geojson_data)
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Модель и эндпоинты для авторизации
class UserLogin(BaseModel):
    login: str
    password: str

def authenticate_user(login: str, password: str):
    conn = sqlite3.connect('users.db')
    cursor = conn.cursor()
    cursor.execute('SELECT * FROM users WHERE login = ? AND password = ?', (login, password))
    user = cursor.fetchone()
    conn.close()
    if user is None:
        raise HTTPException(status_code=401, detail="Неверный логин или пароль")
    return user

@app.post("/login")
async def login(user: UserLogin):
    authenticated_user = authenticate_user(user.login, user.password)
    return {
        "message": f"Добро пожаловать, {authenticated_user[1]}!",
        "name": authenticated_user[1],
        "role": authenticated_user[4]
    }

@app.post("/logout")
async def logout():
    return {"message": "Вы вышли из системы"}

@app.get("/")
def read_root():
    return {"message": "Backend работает"}