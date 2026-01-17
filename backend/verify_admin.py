import sqlite3
import os

DB_FILE = "ethiolex.db"

def verify_admin():
    if not os.path.exists(DB_FILE):
        print(f"Database file {DB_FILE} not found.")
        return

    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()

    try:
        cursor.execute("SELECT username, email, is_admin FROM users WHERE email='admin@ethiolex.com'")
        user = cursor.fetchone()
        
        if user:
            print(f"Admin User Found: {user}")
        else:
            print("Admin User NOT Found.")
            
    except Exception as e:
        print(f"Verification failed: {e}")
    finally:
        conn.close()

if __name__ == "__main__":
    verify_admin()
