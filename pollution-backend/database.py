import sqlite3

def create_database():
    # Подключаемся к базе данных (если базы нет, она будет создана)
    conn = sqlite3.connect('users.db')
    cursor = conn.cursor()

    # Создаем таблицу пользователей (если она не существует)
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        login TEXT NOT NULL UNIQUE,
        password TEXT NOT NULL,
        role TEXT NOT NULL
    )
    ''')

    # Добавляем две записи (если они еще не существуют)
    cursor.execute('''
    INSERT OR IGNORE INTO users (name, login, password, role)
    VALUES 
    ('Roman', 'admin', 'admin123', 'Admin'),
    ('Petya', 'employee', 'employee123', 'Employee')
    ''')

    # Сохраняем изменения и закрываем соединение
    conn.commit()
    print("Database and table are set up!")
    conn.close()

# Выполняем создание базы данных и добавление записей
create_database()