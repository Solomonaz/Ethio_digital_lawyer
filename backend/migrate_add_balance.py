import sqlite3
import os

# Database file path
DB_FILE = "backend/ethiolex.db"

def migrate():
    if not os.path.exists(DB_FILE):
        print(f"Database file {DB_FILE} not found!")
        return

    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()

    try:
        # Add balance column
        print("Adding balance column...")
        cursor.execute("ALTER TABLE users ADD COLUMN balance FLOAT DEFAULT 0.0")
        conn.commit()
        print("Successfully added 'balance' column.")
    except sqlite3.OperationalError as e:
        if "duplicate column name" in str(e):
            print("Column 'balance' already exists.")
        else:
            print(f"Error adding column: {e}")
    finally:
        conn.close()

if __name__ == "__main__":
    migrate()
