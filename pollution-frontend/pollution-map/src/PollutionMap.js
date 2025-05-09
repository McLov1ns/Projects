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
    const abortControllerRef = useRef(null);
    const initialBoundsSet = useRef(false);

    // Инициализация карты
    useEffect(() => {
        if (mapRef.current) return;

        const map = L.map("map").setView([45, 10], 5);
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
            attribution: "© OpenStreetMap contributors"
        }).addTo(map);

        mapRef.current = map;
        loadInitialData();
    }, []);

    const loadInitialData = async () => {
        try {
            const [boundsRes, speciesRes] = await Promise.all([
                axios.get("http://127.0.0.1:8000/pollution/bounds"),
                axios.get("http://127.0.0.1:8000/pollution/species")
            ]);

            const bounds = boundsRes.data;
            const mapBounds = L.latLngBounds(
                [bounds.lat_min, bounds.lon_min],
                [bounds.lat_max, bounds.lon_max]
            );
            
            // Устанавливаем границы только при первой загрузке
            if (!initialBoundsSet.current) {
                mapRef.current.fitBounds(mapBounds, {
                    padding: [50, 50],
                    maxZoom: 10
                });
                initialBoundsSet.current = true;
            }

            const species = speciesRes.data.species_names;
            setSpeciesList(species);
            if (species.length > 0) {
                setSelectedSpecies(species[0]);
            }
        } catch (err) {
            console.error("Ошибка загрузки данных:", err);
        }
    };

    // Обновление слоя загрязнений
    useEffect(() => {
        if (!mapRef.current || !selectedSpecies) return;

        // Отменяем предыдущий запрос
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }
        
        const controller = new AbortController();
        abortControllerRef.current = controller;

        const imageUrl = `http://127.0.0.1:8000/pollution/image?time_index=${timeIndex}&level_index=${levelIndex}&species=${selectedSpecies}`;

        axios.get('http://127.0.0.1:8000/pollution/bounds', { signal: controller.signal })
            .then(response => {
                const bounds = response.data;
                const mapBounds = [[bounds.lat_min, bounds.lon_min], [bounds.lat_max, bounds.lon_max]];

                const preloadImage = new Image();
                preloadImage.src = imageUrl;

                preloadImage.onload = () => {
                    if (controller.signal.aborted) return;

                    if (overlayRef.current) {
                        mapRef.current.removeLayer(overlayRef.current);
                    }

                    const overlay = L.imageOverlay(imageUrl, mapBounds, {
                        opacity: 0.6,
                        interactive: false
                    });
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

    // Остальной код без изменений
    const handleTimeSliderChange = (e) => {
        setTimeIndex(Number(e.target.value));
    };

    const togglePlay = () => {
        if (isPlaying) {
            clearInterval(playIntervalRef.current);
            playIntervalRef.current = null;
        } else {
            playIntervalRef.current = setInterval(() => {
                setTimeIndex(prev => (prev >= maxTimeIndex ? 1 : prev + 1));
            }, 300);
        }
        setIsPlaying(!isPlaying);
    };

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
        <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
            <div style={{ position: 'relative', flexGrow: 1 }}>
                <div id="map" style={{ height: '100%', width: '100%' }}></div>
                
                <div style={{
                    position: 'absolute',
                    top: '20px',
                    right: '20px',
                    zIndex: 1000,
                    background: 'rgba(255,255,255,0.9)',
                    padding: '15px',
                    borderRadius: '8px',
                    boxShadow: '0 0 15px rgba(0,0,0,0.2)',
                    width: '280px'
                }}>
                    <div style={{ marginBottom: '15px' }}>
                        <div style={{ marginBottom: '5px', fontWeight: '500' }}>Время: {currentTime}</div>
                        <input
                            type="range"
                            value={timeIndex}
                            onChange={handleTimeSliderChange}
                            min="1"
                            max={maxTimeIndex}
                            style={{ width: '100%' }}
                        />
                        <button 
                            onClick={togglePlay} 
                            style={{ 
                                marginTop: '8px',
                                padding: '5px 10px',
                                background: isPlaying ? '#e74c3c' : '#2ecc71',
                                color: 'white',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                width: '100%'
                            }}
                        >
                            {isPlaying ? '⏸ Остановить' : '▶ Автовоспроизведение'}
                        </button>
                    </div>
                    <div style={{ marginBottom: '15px' }}>
                        <div style={{ marginBottom: '5px', fontWeight: '500' }}>Уровень: {levelIndex}</div>
                        <input
                            type="range"
                            value={levelIndex}
                            onChange={(e) => setLevelIndex(Number(e.target.value))}
                            min="0"
                            max="9"
                            style={{ width: '100%' }}
                        />
                    </div>
                    <div>
                        <div style={{ marginBottom: '5px', fontWeight: '500' }}>Вещество:</div>
                        <select
                            value={selectedSpecies}
                            onChange={(e) => setSelectedSpecies(e.target.value)}
                            style={{ 
                                width: '100%',
                                padding: '5px',
                                borderRadius: '4px',
                                border: '1px solid #ddd'
                            }}
                        >
                            {speciesList.map((specie) => (
                                <option key={specie} value={specie}>{specie}</option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default PollutionMap;