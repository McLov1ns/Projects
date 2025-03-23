from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import xarray as xr
import numpy as np
from fastapi.responses import JSONResponse
from functools import lru_cache

app = FastAPI()

# Настройка CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # Разрешить запросы с этого домена
    allow_credentials=True,
    allow_methods=["*"],  # Разрешить все методы (GET, POST, и т.д.)
    allow_headers=["*"],  # Разрешить все заголовки
)

# Кэшируем загрузку данных
@lru_cache(maxsize=1)
def load_dataset():
    return xr.open_dataset("res_annotated.nc")

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