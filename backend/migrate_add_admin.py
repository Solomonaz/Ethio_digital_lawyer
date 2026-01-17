import sqlite3
import os

DB_FILE = "ethiolex.db"

def migrate():
    if not os.path.exists(DB_FILE):
        print(f"Database file {DB_FILE} not found.")
        return

    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()

    try:
        # Check if columns exist
        cursor.execute("PRAGMA table_info(users)")
        columns = [info[1] for info in cursor.fetchall()]
        
        if "is_admin" not in columns:
            print("Adding is_admin column...")
            cursor.execute("ALTER TABLE users ADD COLUMN is_admin TEXT DEFAULT 'False'")
            
        if "is_staff" not in columns:
            print("Adding is_staff column...")
            cursor.execute("ALTER TABLE users ADD COLUMN is_staff TEXT DEFAULT 'False'")

        conn.commit()
        print("Migration completed successfully.")
        
    except Exception as e:
        print(f"Migration failed: {e}")
        conn.rollback()
    finally:
        conn.close()

if __name__ == "__main__":
    migrate()
