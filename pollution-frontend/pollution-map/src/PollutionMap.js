import { useEffect, useRef, useState } from "react";
import axios from "axios";
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';


function PollutionMap() {
    const mapRef = useRef(null); // Храним карту
    const overlayRef = useRef(null); // Храним текущий overlay
    const [timeIndex, setTimeIndex] = useState(0);
    const [levelIndex, setLevelIndex] = useState(0);
    const [currentTime, setCurrentTime] = useState("");
    const [maxTimeIndex, setMaxTimeIndex] = useState(220);  // Начальный максимальный индекс времени
    
    // Один раз создаём карту
    useEffect(() => {
        if (mapRef.current) return;

        const map = L.map("map").setView([53.13, 107.61], 5);
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
            attribution: "© OpenStreetMap contributors"
        }).addTo(map);

        mapRef.current = map;
    }, []);

    // Обновляем слой при изменении параметров
    useEffect(() => {
        if (!mapRef.current) return;
    
        const controller = new AbortController(); //создаём контроллер отмены
        const imageUrl = `http://127.0.0.1:8000/pollution/image?time_index=${timeIndex}&level_index=${levelIndex}`;
    
        axios.get('http://127.0.0.1:8000/pollution/bounds', { signal: controller.signal })
            .then(response => {
                const { lat_min, lat_max, lon_min, lon_max } = response.data;
                const bounds = [[lat_min, lon_min], [lat_max, lon_max]];

                const preloadImage = new Image();
                preloadImage.src = imageUrl;

                preloadImage.onload = () => {
                    if (overlayRef.current) {
                        mapRef.current.removeLayer(overlayRef.current);
                    }

                    const overlay = L.imageOverlay(imageUrl, bounds, { opacity: 0.6 });
                    overlay.addTo(mapRef.current);
                    overlayRef.current = overlay;
                };
            })
            .catch((err) => {
                if (axios.isCancel(err)) {
                    console.log("Запрос отменён");
                } else {
                    console.error("Ошибка загрузки:", err);
                }
            });
    
        return () => {
            controller.abort(); // 💣 отменяем предыдущий запрос при следующем запуске useEffect
        };
    }, [timeIndex, levelIndex]);  

    // Получаем время и максимальный индекс времени
    useEffect(() => {
        const fetchTime = async () => {
            try {
                const response = await axios.get(`http://127.0.0.1:8000/pollution/time?time_index=${timeIndex}`);
                setCurrentTime(response.data.time);  // Сохраняем время в стейт
                setMaxTimeIndex(response.data.max_time_index);  // Обновляем максимальный индекс времени
            } catch (error) {
                console.error("Ошибка получения времени:", error);
            }
        };

        fetchTime();
    }, [timeIndex]);

    return (
        <div>
            <div>
                <label>Время: {currentTime}</label>
                <input
                    type="range"
                    value={timeIndex}
                    onChange={(e) => setTimeIndex(Number(e.target.value))}
                    min="0"
                    max={maxTimeIndex}  // Используем динамически полученный максимальный индекс времени
                />
            </div>
            <div>
                <label>Вещество: {levelIndex}</label>
                <input
                    type="range"
                    value={levelIndex}
                    onChange={(e) => setLevelIndex(Number(e.target.value))}
                    min="0"
                    max="9"
                />
            </div>
            <div id="map" style={{ height: "80vh", width: "100%" }}></div>
        </div>
    );
}

export default PollutionMap;
