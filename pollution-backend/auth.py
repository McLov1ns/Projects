from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import sqlite3

app = FastAPI()

# Модели данных
class UserLogin(BaseModel):
    login: str
    password: str

class UserCreate(BaseModel):
    name: str
    login: str
    password: str
    role: str

# Функция для проверки логина и пароля
def authenticate_user(login: str, password: str):
    conn = sqlite3.connect('users.db')
    cursor = conn.cursor()
    
    cursor.execute('SELECT * FROM users WHERE login = ? AND password = ?', (login, password))
    user = cursor.fetchone()
    
    conn.close()
    
    if user is None:
        raise HTTPException(status_code=401, detail="Неверный логин или пароль")
    return user

@app.post("/login")
async def login(user: UserLogin):
    authenticated_user = authenticate_user(user.login, user.password)
    return {
        "message": f"Добро пожаловать, {authenticated_user[1]}!",
        "name": authenticated_user[1],
        "role": authenticated_user[4]
    }

@app.post("/create_user")
async def create_user(user: UserCreate):
    conn = sqlite3.connect('users.db')
    cursor = conn.cursor()
    
    # Проверка на существование пользователя
    cursor.execute('SELECT * FROM users WHERE login = ?', (user.login,))
    existing_user = cursor.fetchone()
    
    if existing_user:
        conn.close()
        raise HTTPException(status_code=400, detail="Пользователь с таким логином уже существует")
    
    # Добавление нового пользователя в базу данных
    cursor.execute('''
    INSERT INTO users (name, login, password, role)
    VALUES (?, ?, ?, ?)
    ''', (user.name, user.login, user.password, user.role))
    
    conn.commit()
    conn.close()
    
    return {"message": f"Пользователь {user.name} успешно создан!"}