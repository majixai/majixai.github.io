import sqlite3

def get_db_connection():
    conn = sqlite3.connect('texas_holdem.db')
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db_connection()
    conn.execute('DROP TABLE IF EXISTS players')
    conn.execute('CREATE TABLE players (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, chips INTEGER NOT NULL)')
    conn.execute('DROP TABLE IF EXISTS game')
    conn.execute('CREATE TABLE game (id INTEGER PRIMARY KEY AUTOINCREMENT, community_cards TEXT, pot INTEGER, current_bet INTEGER)')
    conn.close()
