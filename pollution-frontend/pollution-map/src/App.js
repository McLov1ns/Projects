import React, { useState } from 'react';
import PollutionMap from './PollutionMap'; // Импортируем компонент PollutionMap
import './App.css'; // Импортируем стили
import axios from 'axios';

function App() {
  // Состояния для управления модальным окном и логином
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [user, setUser] = useState(null); // Состояние для хранения информации о пользователе
  const [message, setMessage] = useState('');

  // Функция для открытия модального окна
  const openModal = () => {
    setIsModalOpen(true);
  };

  // Функция для закрытия модального окна
  const closeModal = () => {
    setIsModalOpen(false);
  };

  // Функция для обработки отправки формы логина
  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      const response = await axios.post('http://127.0.0.1:8000/login', {
        login: username,
        password: password,
      });
      setUser({ name: response.data.name, role: response.data.role });
      setMessage(response.data.message);
      closeModal();
    } catch (error) {
      setMessage(error.response ? error.response.data.detail : 'Ошибка при входе');
    }
  };

  // Функция для выхода
  const handleLogout = async () => {
    try {
      const response = await axios.post('http://127.0.0.1:8000/logout');
      setUser(null);  // Очистка состояния пользователя
      setMessage(response.data.message);
    } catch (error) {
      setMessage('Ошибка при выходе');
    }
  };

  return (
    <div className="App">
      <h1>Карта загрязнения</h1>
      <PollutionMap /> {/* Используем компонент PollutionMap */}

      {/* Если пользователь вошел, показываем его имя и кнопку "Выйти" */}
      {user ? (
        <div>
          <p>Добро пожаловать, {user.name} ({user.role})</p>
          <button onClick={handleLogout}>Выйти</button>
        </div>
      ) : (
        // Если пользователь не вошел, показываем кнопку для входа
        <button className="login-button" onClick={openModal}>Войти</button>
      )}

      {/* Модальное окно */}
      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h2>Войти</h2>
            <form onSubmit={handleLogin}>
              <div>
                <label>Логин</label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                />
              </div>
              <div>
                <label>Пароль</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
              <div>
                <button type="submit">Войти</button>
                <button type="button" onClick={closeModal}>Закрыть</button>
              </div>
            </form>
            {message && <p>{message}</p>}
          </div>
        </div>
      )}
    </div>
  );
}

export default App;