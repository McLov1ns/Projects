import sqlite3
from passlib.context import CryptContext

# Создаем объект CryptContext для работы с хэшированием
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def create_database():
    conn = sqlite3.connect('users.db')
    cursor = conn.cursor()

    cursor.execute('''
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        login TEXT NOT NULL UNIQUE,
        password TEXT NOT NULL,
        role TEXT NOT NULL
    )
    ''')

    # Хэшируем пароли перед добавлением
    hashed_admin_password = pwd_context.hash("admin123")
    hashed_employee_password = pwd_context.hash("employee123")

    cursor.execute('''
    INSERT OR IGNORE INTO users (name, login, password, role)
    VALUES
    ('Roman', 'admin', ?, 'Admin'),
    ('Petya', 'employee', ?, 'Employee')
    ''', (hashed_admin_password, hashed_employee_password))

    conn.commit()
    conn.close()

    print("Database and table are set up!")

# Выполняем создание базы данных и добавление записей
create_database()