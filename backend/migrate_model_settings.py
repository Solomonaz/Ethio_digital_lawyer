import sqlite3
import os

DB_FILE = "ethiolex.db"

def migrate():
    if not os.path.exists(DB_FILE):
        print(f"Database file {DB_FILE} not found! Will be created on server start.")
        return

    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()

    # Default Settings
    # Input: $2.00 / 1M tokens -> Assuming $1 = 120 ETB -> 240 ETB
    # Output: $12.00 / 1M tokens -> Assuming $1 = 120 ETB -> 1440 ETB
    # User can update these in Admin Dashboard later.
    
    settings = [
        ("model_name", "gemini-3-pro-preview", "Active AI Model Name"),
        ("cost_input_1m", "240.0", "Cost in ETB per 1 Million Input Tokens"),
        ("cost_output_1m", "1440.0", "Cost in ETB per 1 Million Output Tokens")
    ]

    print("Migrating settings table for dynamic pricing...")
    
    for key, value, description in settings:
        try:
            print(f"Adding setting '{key}'...")
            # Try to insert, ignore if exists (to preserve existing values if run again)
            cursor.execute("INSERT OR IGNORE INTO settings (key, value, description) VALUES (?, ?, ?)", (key, value, description))
            conn.commit()
            print(f"Successfully ensured setting '{key}'.")
        except sqlite3.OperationalError as e:
            print(f"Error adding setting '{key}': {e}")
    
    conn.close()
    print("Migration complete.")

if __name__ == "__main__":
    migrate()
