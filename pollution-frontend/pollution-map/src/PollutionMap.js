import { useEffect, useState } from "react";
import axios from "axios";
import L from 'leaflet';
import 'leaflet/dist/leaflet.css'; // Импорт стилей Leaflet
import 'leaflet.heat'; // Импорт библиотеки для тепловой карты

// Убедитесь, что иконки маркеров загружены корректно
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
    iconUrl: icon,
    shadowUrl: iconShadow,
    iconSize: [25, 41], // Размер иконки
    iconAnchor: [12, 41], // Точка привязки иконки
});

L.Marker.prototype.options.icon = DefaultIcon;

function PollutionMap() {
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [timeIndex, setTimeIndex] = useState(0);
    const [levelIndex, setLevelIndex] = useState(0);

    useEffect(() => {
        axios.get(`http://127.0.0.1:8000/pollution?time_index=${timeIndex}&level_index=${levelIndex}`)
            .then((response) => {
                setData(response.data.features);
                setLoading(false);
            })
            .catch((error) => {
                console.error("Ошибка при загрузке данных:", error);
                setError(error);
                setLoading(false);
            });
    }, [timeIndex, levelIndex]);

    // Инициализация тепловой карты
    useEffect(() => {
        if (data.length > 0) {
            const heatMapData = data.map(point => [
                point.geometry.coordinates[1],
                point.geometry.coordinates[0],
                point.properties.concentration
            ]);

            const map = L.map('map').setView([53.13, 107.61], 5);
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '© OpenStreetMap contributors'
            }).addTo(map);

            L.heatLayer(heatMapData, { radius: 25 }).addTo(map);

            return () => {
                map.remove(); // Очистка карты при размонтировании компонента
            };
        }
    }, [data]);

    if (loading) {
        return <p>Загрузка данных...</p>;
    }

    if (error) {
        return <p>Ошибка при загрузке данных: {error.message}</p>;
    }

    return (
        <div>
            <div>
                <label>Время: </label>
                <input
                    type="number"
                    value={timeIndex}
                    onChange={(e) => setTimeIndex(Number(e.target.value))}
                    min="0"
                    max="220"
                />
            </div>
            <div>
                <label>Уровень: </label>
                <input
                    type="number"
                    value={levelIndex}
                    onChange={(e) => setLevelIndex(Number(e.target.value))}
                    min="0"
                    max="9"
                />
            </div>
            <div id="map" style={{ height: "80vh", width: "200vh" }}></div> {/* Элемент с id="map" */}
        </div>
    );
}

export default PollutionMap;