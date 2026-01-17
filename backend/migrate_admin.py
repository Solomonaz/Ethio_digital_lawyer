import sqlite3
import os

DB_FILE = "ethiolex.db"

def migrate():
    if not os.path.exists(DB_FILE):
        print(f"Database file {DB_FILE} not found!")
        return

    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()

    # Add is_admin column to users table
    try:
        print("Adding is_admin column to users table...")
        cursor.execute("ALTER TABLE users ADD COLUMN is_admin INTEGER DEFAULT 0")
        conn.commit()
        print("Successfully added 'is_admin' column.")
    except sqlite3.OperationalError as e:
        if "duplicate column name" in str(e):
            print("Column 'is_admin' already exists.")
        else:
            print(f"Error: {e}")

    # Create settings table
    try:
        print("Creating settings table...")
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS settings (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                key TEXT UNIQUE NOT NULL,
                value TEXT NOT NULL,
                description TEXT,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        conn.commit()
        print("Settings table created.")
    except sqlite3.OperationalError as e:
        print(f"Error creating settings table: {e}")

    # Insert default search_cost setting
    try:
        print("Inserting default search_cost setting...")
        cursor.execute("""
            INSERT OR IGNORE INTO settings (key, value, description) 
            VALUES ('search_cost', '30', 'Cost in ETB per search/consultation')
        """)
        conn.commit()
        print("Default search_cost setting added.")
    except sqlite3.OperationalError as e:
        print(f"Error: {e}")

    # Create first admin user (set existing user as admin)
    try:
        print("Setting first user as admin...")
        cursor.execute("UPDATE users SET is_admin = 1 WHERE id = 1")
        conn.commit()
        print("First user set as admin.")
    except sqlite3.OperationalError as e:
        print(f"Error: {e}")

    conn.close()
    print("Migration complete!")

if __name__ == "__main__":
    migrate()
