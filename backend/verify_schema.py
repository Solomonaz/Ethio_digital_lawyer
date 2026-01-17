import sqlite3
import os

DB_FILE = "backend/ethiolex.db"

def verify_db():
    if not os.path.exists(DB_FILE):
        print(f"Database file {DB_FILE} not found!")
        return

    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()

    try:
        print("Checking columns in 'users' table...")
        cursor.execute("PRAGMA table_info(users)")
        columns = [info[1] for info in cursor.fetchall()]
        print(f"Columns: {columns}")
        
        if "balance" in columns:
            print("SUCCESS: 'balance' column exists.")
        else:
            print("FAILURE: 'balance' column MISSING.")
            
        print("\nChecking first user record...")
        cursor.execute("SELECT * FROM users LIMIT 1")
        user = cursor.fetchone()
        print(f"User: {user}")
        
    except Exception as e:
        print(f"Error checking DB: {e}")
    finally:
        conn.close()

if __name__ == "__main__":
    verify_db()
