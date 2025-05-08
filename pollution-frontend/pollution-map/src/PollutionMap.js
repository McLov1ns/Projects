import { useEffect, useRef, useState } from "react";
import axios from "axios";
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

function PollutionMap() {
    const mapRef = useRef(null);
    const overlayRef = useRef(null);
    const [timeIndex, setTimeIndex] = useState(1);
    const [levelIndex, setLevelIndex] = useState(0);
    const [currentTime, setCurrentTime] = useState("");
    const [maxTimeIndex, setMaxTimeIndex] = useState(220);
    const [speciesList, setSpeciesList] = useState([]);
    const [selectedSpecies, setSelectedSpecies] = useState("");
    const [isPlaying, setIsPlaying] = useState(false);
    const playIntervalRef = useRef(null);

    // Создание карты (один раз)
    useEffect(() => {
        if (mapRef.current) return;
    
        axios.get("http://127.0.0.1:8000/pollution/bounds")
            .then((response) => {
                const { lat_min, lat_max, lon_min, lon_max } = response.data;
                const centerLat = (lat_min + lat_max) / 2;
                const centerLon = (lon_min + lon_max) / 2;
    
                const container = document.getElementById("map");
                if (container && container._leaflet_id) {
                    container._leaflet_id = null;
                }
    
                const map = L.map("map").setView([centerLat, centerLon], 5);
                L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
                    attribution: "© OpenStreetMap contributors"
                }).addTo(map);
    
                mapRef.current = map;
            })
            .catch((err) => {
                console.error("Ошибка получения границ:", err);
            });
    }, []);
    
    // Загрузка списка веществ
    useEffect(() => {
        axios.get("http://127.0.0.1:8000/pollution/species")
            .then((res) => {
                const species = res.data.species_names;
                setSpeciesList(species);
                setSelectedSpecies(species[0]);
            })
            .catch((err) => {
                console.error("Ошибка получения списка веществ:", err);
            });
    }, []);

    // Очистка интервала при размонтировании
    useEffect(() => {
        return () => {
            if (playIntervalRef.current) {
                clearInterval(playIntervalRef.current);
            }
        };
    }, []);

    const togglePlay = () => {
        if (isPlaying) {
            if (playIntervalRef.current) {
                clearInterval(playIntervalRef.current);
                playIntervalRef.current = null;
            }
        } else {
            playIntervalRef.current = setInterval(() => {
                setTimeIndex(prev => {
                    const newIndex = prev + 1;
                    if (newIndex > maxTimeIndex) {
                        clearInterval(playIntervalRef.current);
                        setIsPlaying(false);
                        return 1; // Сброс к началу
                    }
                    return newIndex;
                });
            }, 1000);
        }
        setIsPlaying(!isPlaying);
    };

    // Обновление слоя при изменении параметров
    useEffect(() => {
        if (!mapRef.current || !selectedSpecies) return;

        const controller = new AbortController();
        const imageUrl = `http://127.0.0.1:8000/pollution/image?time_index=${timeIndex}&level_index=${levelIndex}&species=${selectedSpecies}`;

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
                if (!axios.isCancel(err)) {
                    console.error("Ошибка загрузки карты:", err);
                }
            });

        return () => {
            controller.abort();
        };
    }, [timeIndex, levelIndex, selectedSpecies]);

    // Получение текущего времени
    useEffect(() => {
        const fetchTime = async () => {
            try {
                const response = await axios.get(`http://127.0.0.1:8000/pollution/time?time_index=${timeIndex}`);
                setCurrentTime(response.data.time);
                setMaxTimeIndex(response.data.max_time_index);
            } catch (error) {
                console.error("Ошибка получения времени:", error);
            }
        };

        fetchTime();
    }, [timeIndex]);

    return (
        <div style={{ position: 'relative' }}>
            <div className="map-controls">
                <div>
                    <label>Время: {currentTime}</label>
                    <input
                        type="range"
                        value={timeIndex}
                        onChange={(e) => setTimeIndex(Number(e.target.value))}
                        min="1"
                        max={maxTimeIndex}
                    />
                    <button onClick={togglePlay}>
                        {isPlaying ? '⏸' : '▶'}
                    </button>
                </div>
                <div>
                    <label>Уровень: {levelIndex}</label>
                    <input
                        type="range"
                        value={levelIndex}
                        onChange={(e) => setLevelIndex(Number(e.target.value))}
                        min="0"
                        max="9"
                    />
                </div>
                <div>
                    <label htmlFor="species-select">Вещество:</label>
                    <select
                        id="species-select"
                        value={selectedSpecies}
                        onChange={(e) => setSelectedSpecies(e.target.value)}
                    >
                        {speciesList.map((specie) => (
                            <option key={specie} value={specie}>{specie}</option>
                        ))}
                    </select>
                </div>
            </div>
            <div id="map" style={{ height: "80vh", width: "100%" }}></div>
        </div>
    );
}

export default PollutionMap;