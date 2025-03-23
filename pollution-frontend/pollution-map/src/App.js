import React from 'react';
import PollutionMap from './PollutionMap'; // Импортируем компонент PollutionMap
import './App.css'; // Импортируем стили (если они есть)

function App() {
  return (
    <div className="App">
      <h1>Карта загрязнения</h1>
      <PollutionMap /> {/* Используем компонент PollutionMap */}
    </div>
  );
}

export default App;