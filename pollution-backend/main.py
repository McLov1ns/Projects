from fastapi import FastAPI, HTTPException, Depends
import numpy as np
import xarray as xr
from pydantic import BaseModel
import sqlite3
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Можно ограничить конкретным доменом
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def load_dataset():
    return xr.open_dataset("res_annotated.nc")

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

# Остальной код для /pollution
@app.get("/pollution")
async def get_pollution_data(time_index: int = 0, level_index: int = 0):
    try:
        dataset = load_dataset()  # Используем кэшированный датасет
        
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
            "features": features
        }

        return JSONResponse(content=geojson_data)
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))