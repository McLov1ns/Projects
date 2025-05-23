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
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadFile, setUploadFile] = useState(null);

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

  const handleFileUpload = async (e) => {
    e.preventDefault();
    if (!uploadFile) return;

    const formData = new FormData();
    formData.append('file', uploadFile);

    try {
      const response = await axios.post('http://127.0.0.1:8000/upload_dataset', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      setMessage(response.data.message);
      // Обновляем список файлов
      const datasetsRes = await axios.get('http://127.0.0.1:8000/available_datasets');
      setAvailableDatasets(datasetsRes.data.datasets);
      setShowUploadModal(false);
    } catch (error) {
      setMessage(error.response?.data?.detail || 'Ошибка загрузки файла');
    }
  };

  return (
    <div className="app-container">
      <header className="app-header">
        <h1>Карта загрязнения</h1>
        <div className="user-info">
          {user ? (
            <>
              <p>{user.name} ({user.role})</p>
              {user?.role === 'Admin' && (
                <>
                  <button onClick={() => setShowUploadModal(true)}>Загрузить файл</button>
                  <button onClick={openCreateModal}>Создать аккаунт</button>
                </>
              )}
              <button onClick={handleLogout}>Выйти</button>
            </>
          ) : (
            <button className="login-button" onClick={openModal}>Войти</button>
          )}
        </div>
      </header>

      <div className="map-container">
        <PollutionMap isAuthenticated={!!user}/>
      </div>

      {showUploadModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h2>Загрузка файла .nc</h2>
            <form onSubmit={handleFileUpload}>
              <div style={{ marginBottom: '15px' }}>
                <input 
                  type="file" 
                  accept=".nc"
                  onChange={(e) => setUploadFile(e.target.files[0])}
                  style={{ width: '100%' }}
                />
              </div>
              <div>
                <button 
                  type="submit"
                  style={{
                    padding: '8px 15px',
                    background: '#2ecc71',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    marginRight: '10px'
                  }}
                >
                  Загрузить
                </button>
                <button 
                  type="button" 
                  onClick={() => setShowUploadModal(false)}
                  style={{
                    padding: '8px 15px',
                    background: '#e74c3c',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer'
                  }}
                >
                  Отмена
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

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

      <footer className="footer">
        <p>© 2025 Карта загрязнения. Все права защищены.</p>
      </footer>
    </div>
  );
}
export default App;