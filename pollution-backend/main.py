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
    # Указываем путь к тестовому файлу
    return xr.open_dataset("test_data.nc")

@app.get("/pollution")
async def get_pollution_data():
    try:
        dataset = load_dataset()  # Используем кэшированный датасет
        
        # Проверяем наличие переменных
        required_vars = ["xDomPoints", "yDomPoints", "maskedTrajRef"]
        for var in required_vars:
            if var not in dataset:
                raise HTTPException(status_code=500, detail=f"Переменная '{var}' отсутствует в файле.")

        lon = dataset["xDomPoints"].values
        lat = dataset["yDomPoints"].values
        fiRef = dataset["maskedTrajRef"].values

        # Диагностика данных
        print("Минимальное значение fiRef:", np.min(fiRef))
        print("Максимальное значение fiRef:", np.max(fiRef))
        print("Количество значений fiRef > 0:", np.sum(fiRef > 0))

        # Получаем индексы, где fiRef > 0
        valid_indices = np.where(fiRef > 0)

        # Создаем GeoJSON-объекты
        features = [
            {
                "type": "Feature",
                "geometry": {"type": "Point", "coordinates": [float(lon[j]), float(lat[i])]},
                "properties": {"concentration": float(fiRef[i, j])},
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