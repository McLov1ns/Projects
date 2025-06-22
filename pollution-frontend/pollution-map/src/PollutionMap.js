import { useEffect, useRef, useState } from "react";
import axios from "axios";
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

function PollutionMap({ isAuthenticated }) {
    const mapRef = useRef(null);
    const overlayRef = useRef(null);
    const [timeIndex, setTimeIndex] = useState(1);
    const [levelIndex, setLevelIndex] = useState(0);
    const [currentTime, setCurrentTime] = useState("");
    const [maxTimeIndex, setMaxTimeIndex] = useState(220);
    const [speciesList, setSpeciesList] = useState([]);
    const [selectedSpecies, setSelectedSpecies] = useState("");
    const [dataTypes, setDataTypes] = useState([]);
    const [selectedDataType, setSelectedDataType] = useState("trajReconstructed");
    const [availableDatasets, setAvailableDatasets] = useState([]);
    const [selectedDataset, setSelectedDataset] = useState("res_annotated_all.nc");
    const [isPlaying, setIsPlaying] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const playIntervalRef = useRef(null);
    const abortControllerRef = useRef(null);

    // Функция для загрузки списка наборов данных
    const fetchDatasets = async () => {
        try {
            const response = await axios.get("http://127.0.0.1:8000/available_datasets");
            setAvailableDatasets(response.data.datasets);
        } catch (err) {
            console.error("Ошибка загрузки списка наборов данных:", err);
        }
    };

    // Инициализация карты
    useEffect(() => {
        if (!isAuthenticated) return;

        const map = L.map("map").setView([45, 10], 5);
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
            attribution: "© OpenStreetMap contributors"
        }).addTo(map);

        mapRef.current = map;
        loadInitialData();
        fetchDatasets(); // Загружаем список наборов данных при монтировании

        return () => {
            if (mapRef.current) {
                mapRef.current.remove();
            }
        };
    }, [isAuthenticated]);

    // Обработчик загрузки файла
    const handleFileUpload = async (event) => {
        const file = event.target.files[0];
        if (!file) return;

        if (!file.name.endsWith('.nc')) {
            return;
        }

        setIsLoading(true);

        try {
            const formData = new FormData();
            formData.append("file", file);

            const response = await axios.post("http://127.0.0.1:8000/upload_dataset", formData, {
                headers: { "Content-Type": "multipart/form-data" }
            });

            if (response.data.success) {
                setTimeout(fetchDatasets, 500); // Даем время файловой системе
                const uploadedName = response.data.filename || file.name;
                setSelectedDataset(uploadedName);
                await handleDatasetChange(uploadedName);
            }
        } catch (err) {
            console.error("Ошибка при загрузке файла:", err);
        } finally {
            setIsLoading(false);
        }
    };

    // Обработчик изменения набора данных
    const handleDatasetChange = async (dataset) => {
        setIsLoading(true);
        try {
            if (isPlaying) {
                clearInterval(playIntervalRef.current);
                setIsPlaying(false);
            }
            if (abortControllerRef.current) {
                abortControllerRef.current.abort();
            }
            const response = await axios.post(`http://127.0.0.1:8000/set_dataset/${dataset}`);
            if (response.data.success) {
                setSelectedDataset(dataset);
                await loadInitialData(true);
                setTimeIndex(1);
                setLevelIndex(0);
            }
        } catch (err) {
            console.error("Ошибка смены набора данных:", err);
        } finally {
            setIsLoading(false);
        }
    };

    // Функция загрузки начальных данных
    const loadInitialData = async (resetView = false) => {
        try {
            const [boundsRes, speciesRes, dataTypesRes, timeRes] = await Promise.all([
                axios.get("http://127.0.0.1:8000/pollution/bounds"),
                axios.get("http://127.0.0.1:8000/pollution/species"),
                axios.get("http://127.0.0.1:8000/pollution/data_types"),
                axios.get(`http://127.0.0.1:8000/pollution/time?time_index=${timeIndex}`)
            ]);

            const bounds = boundsRes.data;
            const mapBounds = L.latLngBounds(
                [bounds.lat_min, bounds.lon_min],
                [bounds.lat_max, bounds.lon_max]
            );
            mapRef.current.fitBounds(mapBounds, {
                padding: [50, 50],
                maxZoom: 10,
                animate: resetView
            });

            const species = speciesRes.data.species_names;
            setSpeciesList(species);
            if (species.length > 0) {
                setSelectedSpecies(species[0]);
            }

            const types = dataTypesRes.data.data_types;
            setDataTypes(types);
            if (types.includes("trajReconstructed")) {
                setSelectedDataType("trajReconstructed");
            } else if (types.length > 0) {
                setSelectedDataType(types[0]);
            }

            setCurrentTime(timeRes.data.time);
            setMaxTimeIndex(timeRes.data.max_time_index);

            updatePollutionLayer();
        } catch (err) {
            console.error("Ошибка загрузки данных:", err);
        }
    };

    // Обновление слоя загрязнений
    const updatePollutionLayer = async () => {
        if (!isAuthenticated || !mapRef.current || !selectedSpecies || !selectedDataType || isLoading) return;

        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }
        
        const controller = new AbortController();
        abortControllerRef.current = controller;

        try {
            const imageUrl = `http://127.0.0.1:8000/pollution/image?time_index=${timeIndex}&level_index=${levelIndex}&species=${selectedSpecies}&data_type=${selectedDataType}`;

            const boundsRes = await axios.get('http://127.0.0.1:8000/pollution/bounds', { 
                signal: controller.signal 
            });
            
            const bounds = boundsRes.data;
            const mapBounds = [[bounds.lat_min, bounds.lon_min], [bounds.lat_max, bounds.lon_max]];

            const preloadImage = new Image();
            preloadImage.src = imageUrl;

            await new Promise((resolve, reject) => {
                preloadImage.onload = resolve;
                preloadImage.onerror = reject;
            });

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
        } catch (err) {
            if (!axios.isCancel(err)) {
                console.error("Ошибка загрузки карты:", err);
            }
        }
    };

    useEffect(() => {
        updatePollutionLayer();
    }, [timeIndex, levelIndex, selectedSpecies, selectedDataType, selectedDataset]);

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

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
            {isLoading && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: 'rgba(0,0,0,0.5)',
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    zIndex: 2000,
                    color: 'white',
                    fontSize: '1.5rem'
                }}>
                    Загрузка данных...
                </div>
            )}
            
            <div style={{ position: 'relative', flexGrow: 1 }}>
                <div id="map" style={{ height: '100%', width: '100%' }}>
                    {!isAuthenticated && (
                        <div style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            right: 0,
                            bottom: 0,
                            display: 'flex',
                            justifyContent: 'center',
                            alignItems: 'center',
                            backgroundColor: 'rgba(240,240,240,0.9)',
                            zIndex: 1000,
                            fontSize: '1.2rem',
                            color: '#555',
                            textAlign: 'center',
                            padding: '20px'
                        }}>
                            Пожалуйста, войдите в систему для просмотра карты загрязнений
                        </div>
                    )}
                </div>
                
                {isAuthenticated && (
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
                            <div style={{ marginBottom: '5px', fontWeight: '500' }}>Загрузить файл .nc:</div>
                            <input
                                type="file"
                                accept=".nc"
                                onChange={handleFileUpload}
                                disabled={isLoading}
                                style={{
                                    width: '100%',
                                    padding: '5px',
                                    borderRadius: '4px',
                                    border: '1px solid #ddd'
                                }}
                            />
                        </div>

                        <div style={{ marginBottom: '15px' }}>
                            <div style={{ marginBottom: '5px', fontWeight: '500' }}>Набор данных:</div>
                            <select
                                value={selectedDataset}
                                onChange={(e) => handleDatasetChange(e.target.value)}
                                disabled={isLoading}
                                style={{ 
                                    width: '100%',
                                    padding: '5px',
                                    borderRadius: '4px',
                                    border: '1px solid #ddd'
                                }}
                            >
                                {availableDatasets.map((dataset) => (
                                    <option key={dataset} value={dataset}>{dataset}</option>
                                ))}
                            </select>
                        </div>
                        
                        <div style={{ marginBottom: '15px' }}>
                            <div style={{ marginBottom: '5px', fontWeight: '500' }}>Время: {currentTime}</div>
                            <input
                                type="range"
                                value={timeIndex}
                                onChange={handleTimeSliderChange}
                                min="1"
                                max={maxTimeIndex}
                                style={{ width: '100%' }}
                                disabled={isLoading}
                            />
                            <button 
                                onClick={togglePlay} 
                                disabled={isLoading}
                                style={{ 
                                    marginTop: '8px',
                                    padding: '5px 10px',
                                    background: isPlaying ? '#e74c3c' : '#2ecc71',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '4px',
                                    cursor: 'pointer',
                                    width: '100%',
                                    opacity: isLoading ? 0.5 : 1
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
                                max="31"
                                style={{ width: '100%' }}
                            />
                        </div>
                        <div style={{ marginBottom: '15px' }}>
                            <div style={{ marginBottom: '5px', fontWeight: '500' }}>Тип данных:</div>
                            <select
                                value={selectedDataType}
                                onChange={(e) => setSelectedDataType(e.target.value)}
                                style={{ 
                                    width: '100%',
                                    padding: '5px',
                                    borderRadius: '4px',
                                    border: '1px solid #ddd'
                                }}
                            >
                                {dataTypes.map((type) => (
                                    <option key={type} value={type}>{type}</option>
                                ))}
                            </select>
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
                )}
            </div>
        </div>
    );
}

export default PollutionMap;