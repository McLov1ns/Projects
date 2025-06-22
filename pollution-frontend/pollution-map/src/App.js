import React, { useState, useEffect } from 'react';
import PollutionMap from './PollutionMap';
import './App.css';
import axios from 'axios';

function App() {
  // Состояния для модальных окон
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isUsersModalOpen, setIsUsersModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  // Данные пользователя
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [user, setUser] = useState(null);
  const [message, setMessage] = useState('');
  const [users, setUsers] = useState([]);
  const [editingUser, setEditingUser] = useState(null);

  // Поля для создания нового аккаунта
  const [newName, setNewName] = useState('');
  const [newLogin, setNewLogin] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState('Employee');

  // Функции открытия/закрытия модальных окон
  const openModal = () => setIsModalOpen(true);
  const closeModal = () => setIsModalOpen(false);
  const openCreateModal = () => setIsCreateModalOpen(true);
  const closeCreateModal = () => setIsCreateModalOpen(false);
  const openUsersModal = () => setIsUsersModalOpen(true);
  const closeUsersModal = () => setIsUsersModalOpen(false);
  const openEditModal = (user) => {
    setEditingUser(user);
    setEditName(user.name);
    setEditLogin(user.login);
    setEditRole(user.role);
    setEditPassword('');
    setIsEditModalOpen(true);
};
  const closeEditModal = () => setIsEditModalOpen(false);

  // Данные для редактирования пользователя
  const [editName, setEditName] = useState('');
  const [editLogin, setEditLogin] = useState('');
  const [editPassword, setEditPassword] = useState('');
  const [editRole, setEditRole] = useState('Employee');

  // Загрузка списка пользователей
  const fetchUsers = async () => {
    try {
        const response = await axios.get('http://127.0.0.1:8000/users');
        setUsers(response.data); // Теперь включает id
    } catch (error) {
        setMessage(error.response ? error.response.data.detail : 'Ошибка при загрузке пользователей');
    }
};

  // Автоматическая загрузка пользователей при открытии окна
  useEffect(() => {
    if (user?.role === 'Admin' && isUsersModalOpen) {
      fetchUsers();
    }
  }, [isUsersModalOpen, user]);

  // Обработчики действий
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
    // Получаем последний ID из базы данных
    const lastIdResponse = await axios.get('http://127.0.0.1:8000/last_user_id');
    const nextId = lastIdResponse.data.last_id + 1;

    // Создаем пользователя
    const response = await axios.post('http://127.0.0.1:8000/create_user', {
      id: nextId,  // Добавляем вычисленный ID
      name: newName,
      login: newLogin,
      password: newPassword,
      role: newRole,
    });
    
    setMessage(response.data.message);
    setNewName('');
    setNewLogin('');
    setNewPassword('');
    setNewRole('Employee');
    closeCreateModal();
    if (isUsersModalOpen) fetchUsers(); // Обновляем список если открыт
  } catch (error) {
    setMessage(error.response ? error.response.data.detail : 'Ошибка при создании пользователя');
  }
  };

  const handleDeleteUser = async (userLogin) => {
  try {
    await axios.delete(`http://127.0.0.1:8000/users/${userLogin}`);
    setMessage('Пользователь успешно удален');
    fetchUsers();
  } catch (error) {
    setMessage(error.response ? error.response.data.detail : 'Ошибка при удалении пользователя');
  }
};

  const handleUpdateUser = async (e) => {
    e.preventDefault();
    try {
        await axios.put(`http://127.0.0.1:8000/users/${editingUser.id}`, {
            name: editName,
            login: editLogin,
            password: editPassword || undefined,
            role: editRole,
        });
        setMessage('Пользователь успешно обновлен');
        closeEditModal();
        fetchUsers();
    } catch (error) {
        setMessage(error.response ? error.response.data.detail : 'Ошибка при обновлении пользователя');
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
              {user.role === 'Admin' && (
                <>
                  <button onClick={openUsersModal}>Просмотр пользователей</button>
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

      {/* Модальное окно списка пользователей */}
      {isUsersModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ width: '80%', maxWidth: '800px' }}>
            <h2>Список пользователей</h2>
            <div className="users-table-container">
              <table className="users-table">
                <thead>
                  <tr>
                    <th>Имя</th>
                    <th>Логин</th>
                    <th>Роль</th>
                    <th>Действия</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user, index) => (
                    <tr key={user.id}>
                      <td>{user.name}</td>
                      <td>{user.login}</td>
                      <td>{user.role}</td>
                      <td>
                        <button onClick={() => openEditModal(user)}>Редактировать</button>
                        <button onClick={() => handleDeleteUser(user.login)}>Удалить</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button onClick={closeUsersModal}>Закрыть</button>
          </div>
        </div>
      )}

      {/* Модальное окно редактирования пользователя */}
      {isEditModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h2>Редактировать пользователя</h2>
            <form onSubmit={handleUpdateUser}>
              <div>
                <label>Имя</label>
                <input type="text" value={editName} onChange={(e) => setEditName(e.target.value)} required />
              </div>
              <div>
                <label>Логин</label>
                <input type="text" value={editLogin} onChange={(e) => setEditLogin(e.target.value)} required />
              </div>
              <div>
                <label>Новый пароль (оставьте пустым, чтобы не менять)</label>
                <input type="password" value={editPassword} onChange={(e) => setEditPassword(e.target.value)} />
              </div>
              <div>
                <label>Роль</label>
                <select value={editRole} onChange={(e) => setEditRole(e.target.value)}>
                  <option value="Admin">Админ</option>
                  <option value="Employee">Сотрудник</option>
                </select>
              </div>
              <div>
                <button type="submit">Сохранить</button>
                <button type="button" onClick={closeEditModal}>Закрыть</button>
              </div>
            </form>
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