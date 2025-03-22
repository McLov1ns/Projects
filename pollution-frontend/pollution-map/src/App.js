import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import { useEffect, useState, useMemo } from "react";
import axios from "axios";
import L from 'leaflet';
import 'leaflet/dist/leaflet.css'; // Импорт стилей Leaflet

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

    useEffect(() => {
        axios.get("http://127.0.0.1:8000/pollution")
            .then((response) => {
                setData(response.data.features);
                setLoading(false);
            })
            .catch((error) => {
                console.error("Ошибка при загрузке данных:", error);
                setError(error);
                setLoading(false);
            });
    }, []);
    // Удаление лого
    useEffect(() => {
        const removeLeafletFlag = () => {
            const leafletFlag = document.querySelector('.leaflet-attribution-flag');
            if (leafletFlag) {
                leafletFlag.remove();
                observer.disconnect();
            }
        };
        const observer = new MutationObserver((mutations) => {
            removeLeafletFlag();
        });
        observer.observe(document.body, { childList: true, subtree: true });
        removeLeafletFlag();

        return () => observer.disconnect();
    }, []);


    const markers = useMemo(() => {
        return data.map((point, index) => (
            <Marker
                key={index}
                position={[point.geometry.coordinates[1], point.geometry.coordinates[0]]}
            >
                <Popup>Концентрация: {point.properties.concentration} mg/m³</Popup>
            </Marker>
        ));
    }, [data]);

    if (loading) {
        return <p>Загрузка данных...</p>;
    }

    if (error) {
        return <p>Ошибка при загрузке данных: {error.message}</p>;
    }

    return (
        <MapContainer center={[53.13, 107.61]} zoom={5} style={{ height: "80vh", width: "200vh" }}>
            <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            />
            {data.length > 0 ? markers : <p>Данные отсутствуют.</p>}
        </MapContainer>
    );
}

export default PollutionMap;