"""
Migration script to add email_verified and phone_verified fields to users table
"""
import sqlite3
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
    
    # Add email_verified column if it doesn't exist
    if 'email_verified' not in columns:
        print("Adding 'email_verified' column...")
        cursor.execute("ALTER TABLE users ADD COLUMN email_verified VARCHAR DEFAULT 'False'")
        print("[OK] Added 'email_verified' column")
    else:
        print("[OK] 'email_verified' column already exists")
    
    # Add phone_verified column if it doesn't exist
    if 'phone_verified' not in columns:
        print("Adding 'phone_verified' column...")
        cursor.execute("ALTER TABLE users ADD COLUMN phone_verified VARCHAR DEFAULT 'False'")
        print("[OK] Added 'phone_verified' column")
    else:
        print("[OK] 'phone_verified' column already exists")
    
    # Update existing users to have verified status (for backward compatibility)
    cursor.execute("UPDATE users SET email_verified = 'True' WHERE email_verified IS NULL OR email_verified = 'False'")
    cursor.execute("UPDATE users SET phone_verified = 'True' WHERE phone_verified IS NULL OR phone_verified = 'False'")
    
    # Commit changes
    conn.commit()
    print("\n[SUCCESS] Migration completed successfully!")
    
except Exception as e:
    conn.rollback()
    print(f"\n[ERROR] Migration failed: {e}")
    raise
finally:
    conn.close()

