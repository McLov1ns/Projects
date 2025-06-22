from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import sqlite3
from typing import List
from fastapi import Depends
from passlib.context import CryptContext

router = APIRouter()
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

class UserLogin(BaseModel):
    login: str
    password: str

class UserCreate(BaseModel):
    id: int = None  # Делаем необязательным
    name: str
    login: str
    password: str
    role: str

class UserResponse(BaseModel):
    id: int
    name: str
    login: str
    role: str

class UserUpdate(BaseModel):
    name: str
    login: str
    password: str = None  # Необязательное поле
    role: str


# Функция для проверки логина и пароля
def authenticate_user(login: str, password: str):
    conn = sqlite3.connect('users.db')
    cursor = conn.cursor()
    cursor.execute('SELECT * FROM users WHERE login = ?', (login,))
    user = cursor.fetchone()
    conn.close()

    if user is None or not pwd_context.verify(password, user[3]):
        raise HTTPException(status_code=401, detail="Неверный логин или пароль")
    return user

@router.post("/login")
async def login(user: UserLogin):
    authenticated_user = authenticate_user(user.login, user.password)
    return {
        "message": f"Добро пожаловать, {authenticated_user[1]}!",
        "name": authenticated_user[1],
        "role": authenticated_user[4]
    }

@router.post("/create_user")
async def create_user(user: UserCreate):
    conn = sqlite3.connect('users.db')
    cursor = conn.cursor()
    
    # Проверка существующего пользователя
    cursor.execute('SELECT * FROM users WHERE login = ?', (user.login,))
    if cursor.fetchone():
        conn.close()
        raise HTTPException(status_code=400, detail="Пользователь с таким логином уже существует")

    hashed_password = pwd_context.hash(user.password)
    
    # Если ID не указан, используем автоинкремент
    if user.id is None:
        cursor.execute('''
            INSERT INTO users (name, login, password, role)
            VALUES (?, ?, ?, ?)
        ''', (user.name, user.login, hashed_password, user.role))
    else:
        cursor.execute('''
            INSERT INTO users (id, name, login, password, role)
            VALUES (?, ?, ?, ?, ?)
        ''', (user.id, user.name, user.login, hashed_password, user.role))
    
    conn.commit()
    conn.close()
    return {"message": f"Пользователь {user.name} успешно создан!"}

@router.get("/last_user_id")
async def get_last_user_id():
    conn = sqlite3.connect('users.db')
    cursor = conn.cursor()
    cursor.execute('SELECT MAX(id) FROM users')
    last_id = cursor.fetchone()[0]
    conn.close()
    return {"last_id": last_id if last_id else 0}


@router.get("/users", response_model=List[UserResponse])
async def get_users():
    conn = sqlite3.connect('users.db')
    cursor = conn.cursor()
    cursor.execute('SELECT id, name, login, role FROM users')  # Включаем id
    users = cursor.fetchall()
    conn.close()
    
    return [{"id": u[0], "name": u[1], "login": u[2], "role": u[3]} for u in users]

@router.delete("/users/{user_login}")
async def delete_user(user_login: str):
    conn = sqlite3.connect('users.db')
    cursor = conn.cursor()
    cursor.execute('DELETE FROM users WHERE login = ?', (user_login,))
    conn.commit()
    affected_rows = cursor.rowcount
    conn.close()
    
    if affected_rows == 0:
        raise HTTPException(status_code=404, detail="Пользователь не найден")
    return {"message": "Пользователь успешно удален"}

@router.put("/users/{user_id}")
async def update_user(user_id: int, user_data: UserUpdate):
    conn = sqlite3.connect('users.db')
    cursor = conn.cursor()
    
    # Проверяем существование пользователя
    cursor.execute('SELECT * FROM users WHERE id = ?', (user_id,))
    existing_user = cursor.fetchone()
    if not existing_user:
        conn.close()
        raise HTTPException(status_code=404, detail="Пользователь не найден")
    
    # Проверяем уникальность логина
    if user_data.login != existing_user[2]:
        cursor.execute('SELECT * FROM users WHERE login = ?', (user_data.login,))
        if cursor.fetchone():
            conn.close()
            raise HTTPException(status_code=400, detail="Логин уже занят")
    
    # Обновляем пароль только если он указан
    if user_data.password:
        hashed_password = pwd_context.hash(user_data.password)
        cursor.execute('''
            UPDATE users 
            SET name = ?, login = ?, password = ?, role = ?
            WHERE id = ?
        ''', (user_data.name, user_data.login, hashed_password, user_data.role, user_id))
    else:
        cursor.execute('''
            UPDATE users 
            SET name = ?, login = ?, role = ?
            WHERE id = ?
        ''', (user_data.name, user_data.login, user_data.role, user_id))
    
    conn.commit()
    conn.close()
    return {"message": "Пользователь успешно обновлен"}