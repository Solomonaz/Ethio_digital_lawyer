import sqlite3
import os

DB_FILE = "ethiolex.db"

def migrate():
    if not os.path.exists(DB_FILE):
        print(f"Database file {DB_FILE} not found! Will be created on server start.")
        return

    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()

    columns_to_add = [
        ("input_tokens", "INTEGER DEFAULT 0"),
        ("output_tokens", "INTEGER DEFAULT 0"),
        ("estimated_cost", "REAL DEFAULT 0.0")
    ]

    print("Migrating chat_messages table for cost tracking...")
    
    for col_name, col_type in columns_to_add:
        try:
            print(f"Adding '{col_name}' column...")
            cursor.execute(f"ALTER TABLE chat_messages ADD COLUMN {col_name} {col_type}")
            conn.commit()
            print(f"Successfully added '{col_name}' column.")
        except sqlite3.OperationalError as e:
            if "duplicate column name" in str(e):
                print(f"Column '{col_name}' already exists.")
            else:
                print(f"Error adding column '{col_name}': {e}")
    
    conn.close()
    print("Migration complete.")

if __name__ == "__main__":
    migrate()
