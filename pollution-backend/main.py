from fastapi import FastAPI, HTTPException, Depends
import numpy as np
import xarray as xr
import pandas as pd
from pydantic import BaseModel
import sqlite3
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
import matplotlib.pyplot as plt
import matplotlib.colors as mcolors
import io
from auth import router as auth_router

app = FastAPI()
app.include_router(auth_router)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Можно ограничить конкретным доменом
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def load_dataset():
    return xr.open_dataset("res_annotated.nc")
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
        dataset = load_dataset()  # Загружаем датасет
        try:
            time = dataset['Times'].values
        except KeyError:
            time = dataset['time'].values
        base_date = pd.to_datetime("2023-01-01") 
        time_as_datetime = base_date + pd.to_timedelta(time[time_index], unit='s')

        # Возвращаем время в удобном формате
        return {
            "time": time_as_datetime.strftime('%Y-%m-%d %H:%M:%S'),
            "max_time_index": len(time) - 1  # Возвращаем максимальный индекс времени
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))



    
@app.get("/pollution/image")
async def get_pollution_image(time_index: int = 0, level_index: int = 0, species: str = "PM"):
    try:
        dataset = load_dataset()
        lat = dataset["lat"].values
        lon = dataset["lon"].values

        # Получение названий веществ
        raw_species = dataset["species_names"].values
        species_names = ["".join([ch.decode("utf-8") for ch in row]).strip() for row in raw_species]

        if species not in species_names:
            raise HTTPException(status_code=404, detail=f"Вещество '{species}' не найдено")

        species_index = species_names.index(species)

        data = dataset["trajReconstructed"].isel(spec=species_index, time=time_index, levCoord=level_index).values

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


# Остальной код для /pollution
@app.get("/pollution")
async def get_pollution_data(time_index: int = 0, level_index: int = 0):
    try:
        dataset = load_dataset()
        
        # Получаем значение времени
        try:
            time = dataset['Times'].values
        except KeyError:
            time = dataset['time'].values
        base_date = pd.to_datetime("1970-01-01")
        time_as_datetime = base_date + pd.to_timedelta(time[time_index], unit='s')
        
        # Преобразуем время в строку
        time_str = time_as_datetime.strftime('%Y-%m-%d %H:%M:%S')

        # Проверяем наличие переменных
        required_vars = ["lat", "lon", "trajReconstructed"]
        for var in required_vars:
            if var not in dataset:
                raise HTTPException(status_code=500, detail=f"Переменная '{var}' отсутствует в файле.")

        lat = dataset["lat"].values
        lon = dataset["lon"].values
        trajReconstructed = dataset["trajReconstructed"].values

        # Выбираем конкретный временной срез и уровень
        trajReconstructed_slice = trajReconstructed[0, time_index, level_index, :, :]

        # Диагностика данных
        print("Минимальное значение trajReconstructed:", np.nanmin(trajReconstructed_slice))
        print("Максимальное значение trajReconstructed:", np.nanmax(trajReconstructed_slice))
        print("Количество значений trajReconstructed > 0:", np.sum(trajReconstructed_slice > 0))

        # Получаем индексы, где trajReconstructed > 0
        valid_indices = np.where(trajReconstructed_slice > 0)

        # Создаем GeoJSON-объекты
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
            "time": time_str  # Добавляем время в ответ
        }

        return JSONResponse(content=geojson_data)
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    
    # Модель для входных данных
class UserLogin(BaseModel):
    login: str
    password: str

# Функция для проверки логина и пароля
def authenticate_user(login: str, password: str):
    conn = sqlite3.connect('users.db')
    cursor = conn.cursor()

    # Ищем пользователя в базе данных по логину и паролю
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
        "name": authenticated_user[1],  # Имя пользователя
        "role": authenticated_user[4]   # Роль пользователя
    }

@app.post("/logout")
async def logout():
    return {"message": "Вы вышли из системы"}