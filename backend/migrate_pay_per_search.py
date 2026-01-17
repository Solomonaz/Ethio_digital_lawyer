import sqlite3
import os

DB_FILE = "ethiolex.db"

def migrate():
    if not os.path.exists(DB_FILE):
        print(f"Database file {DB_FILE} not found! Will be created on server start.")
        return

    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()

    try:
        # Add balance column to users table
        print("Adding balance column to users table...")
        cursor.execute("ALTER TABLE users ADD COLUMN balance REAL DEFAULT 0.0")
        conn.commit()
        print("Successfully added 'balance' column.")
    except sqlite3.OperationalError as e:
        if "duplicate column name" in str(e):
            print("Column 'balance' already exists.")
        else:
            print(f"Error adding column: {e}")
    
    try:
        # Create payments table
        print("Creating payments table...")
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS payments (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                amount REAL NOT NULL,
                tx_ref TEXT UNIQUE NOT NULL,
                status TEXT DEFAULT 'pending',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id)
            )
        """)
        conn.commit()
        print("Successfully created 'payments' table.")
    except sqlite3.OperationalError as e:
        print(f"Error creating payments table: {e}")
    
    finally:
        conn.close()

if __name__ == "__main__":
    migrate()
