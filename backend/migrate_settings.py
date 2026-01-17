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
        # Create table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS system_settings (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL,
                description TEXT
            )
        ''')
        
        # Insert default search cost if not exists
        cursor.execute("SELECT value FROM system_settings WHERE key='search_cost'")
        if not cursor.fetchone():
            print("Inserting default search_cost=30.0")
            cursor.execute("INSERT INTO system_settings (key, value, description) VALUES ('search_cost', '30.0', 'Cost per search in ETB')")
            
        conn.commit()
        print("Migration for system_settings completed.")
        
    except Exception as e:
        print(f"Migration failed: {e}")
        conn.rollback()
    finally:
        conn.close()

if __name__ == "__main__":
    migrate()
