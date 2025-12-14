"""
Migration script to add name, email, and phone_number fields to users table
"""
import sqlite3
import os
from pathlib import Path

# Database file path
db_path = Path(__file__).parent / "ethiolex.db"

if not db_path.exists():
    print(f"Database file {db_path} not found. Skipping migration.")
    exit(0)

print(f"Connecting to database: {db_path}")
conn = sqlite3.connect(str(db_path))
cursor = conn.cursor()

try:
    # Check if columns already exist
    cursor.execute("PRAGMA table_info(users)")
    columns = [row[1] for row in cursor.fetchall()]
    
    # Add name column if it doesn't exist
    if 'name' not in columns:
        print("Adding 'name' column...")
        cursor.execute("ALTER TABLE users ADD COLUMN name VARCHAR")
        print("[OK] Added 'name' column")
    else:
        print("[OK] 'name' column already exists")
    
    # Add email column if it doesn't exist
    if 'email' not in columns:
        print("Adding 'email' column...")
        cursor.execute("ALTER TABLE users ADD COLUMN email VARCHAR")
        # Create index for email
        try:
            cursor.execute("CREATE UNIQUE INDEX IF NOT EXISTS ix_users_email ON users(email)")
            print("[OK] Added 'email' column with unique index")
        except sqlite3.OperationalError as e:
            if "already exists" not in str(e).lower():
                print(f"  Note: Index creation: {e}")
            cursor.execute("ALTER TABLE users ADD COLUMN email VARCHAR")
            print("[OK] Added 'email' column")
    else:
        print("[OK] 'email' column already exists")
    
    # Add phone_number column if it doesn't exist
    if 'phone_number' not in columns:
        print("Adding 'phone_number' column...")
        cursor.execute("ALTER TABLE users ADD COLUMN phone_number VARCHAR")
        print("[OK] Added 'phone_number' column")
    else:
        print("[OK] 'phone_number' column already exists")
    
    # Commit changes
    conn.commit()
    print("\n[SUCCESS] Migration completed successfully!")
    
except Exception as e:
    conn.rollback()
    print(f"\n[ERROR] Migration failed: {e}")
    raise
finally:
    conn.close()

