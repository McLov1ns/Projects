import React, { useState } from 'react';
import PollutionMap from './PollutionMap';
import './App.css';
import axios from 'axios';

function App() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [user, setUser] = useState(null);
  const [message, setMessage] = useState('');

  // Поля для создания нового аккаунта
  const [newName, setNewName] = useState('');
  const [newLogin, setNewLogin] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState('Employee');

  const openModal = () => setIsModalOpen(true);
  const closeModal = () => setIsModalOpen(false);
  const openCreateModal = () => setIsCreateModalOpen(true);
  const closeCreateModal = () => setIsCreateModalOpen(false);

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

  const handleLogout = async () => {
    try {
      const response = await axios.post('http://127.0.0.1:8000/logout');
      setUser(null);
      setMessage(response.data.message);
    } catch (error) {
      setMessage('Ошибка при выходе');
    }
  };

  const handleCreateAccount = async (e) => {
    e.preventDefault();
    try {
      const response = await axios.post('http://127.0.0.1:8000/create_user', {
        name: newName,
        login: newLogin,
        password: newPassword,
        role: newRole,
      });
      setMessage(response.data.message);
      closeCreateModal();
    } catch (error) {
      setMessage(error.response ? error.response.data.detail : 'Ошибка при создании пользователя');
    }
  };

  return (
    <div className="App">
      <h1>Карта загрязнения</h1>
      <PollutionMap />

      <div className="user-info">
        {user ? (
          <>
            <p>{user.name} ({user.role})</p>
            {user.role === 'Admin' && (
              <button onClick={openCreateModal}>Создать аккаунт</button>
            )}
            <button onClick={handleLogout}>Выйти</button>
          </>
        ) : (
          <button className="login-button" onClick={openModal}>Войти</button>
        )}
      </div>

      {/* Окно входа */}
      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h2>Войти</h2>
            <form onSubmit={handleLogin}>
              <div>
                <label>Логин</label>
                <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} required />
              </div>
              <div>
                <label>Пароль</label>
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
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

      {/* Окно создания аккаунта */}
      {isCreateModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h2>Создать аккаунт</h2>
            <form onSubmit={handleCreateAccount}>
              <div>
                <label>Имя</label>
                <input type="text" value={newName} onChange={(e) => setNewName(e.target.value)} required />
              </div>
              <div>
                <label>Логин</label>
                <input type="text" value={newLogin} onChange={(e) => setNewLogin(e.target.value)} required />
              </div>
              <div>
                <label>Пароль</label>
                <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required />
              </div>
              <div>
                <label>Роль</label>
                <select value={newRole} onChange={(e) => setNewRole(e.target.value)}>
                  <option value="Admin">Админ</option>
                  <option value="Employee">Сотрудник</option>
                </select>
              </div>
              <div>
                <button type="submit">Создать</button>
                <button type="button" onClick={closeCreateModal}>Закрыть</button>
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