from fastapi import FastAPI, HTTPException, Depends
from pydantic import BaseModel
import sqlite3

app = FastAPI()

# Модель для входных данных
class UserLogin(BaseModel):
    login: str
    password: str

# Функция для проверки логина и пароля
def authenticate_user(login: str, password: str):
    conn = sqlite3.connect('users.db')
    cursor = conn.cursor()
    
    # Ищем пользователя в базе данных по логину и паролю
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
        "name": authenticated_user[1],  # Имя пользователя
        "role": authenticated_user[4]   # Роль пользователя
    }

@app.post("/logout")
async def logout():
    return {"message": "Вы вышли из системы"}