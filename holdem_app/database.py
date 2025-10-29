import sqlite3
import os

def get_db_connection():
    db_path = os.path.join(os.path.dirname(__file__), 'holdem.db')
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db_connection()
    conn.execute('DROP TABLE IF EXISTS players')
    conn.execute('CREATE TABLE players (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, chips INTEGER NOT NULL)')
    conn.execute('DROP TABLE IF EXISTS game')
    conn.execute('CREATE TABLE game (id INTEGER PRIMARY KEY AUTOINCREMENT, community_cards TEXT, pot INTEGER, current_bet INTEGER)')
    conn.close()
