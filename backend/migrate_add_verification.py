"""
Migration script to add phone verification fields to users table.
Run this script once to update the database schema.
"""
from sqlalchemy import text
from database import engine

def migrate():
    with engine.connect() as conn:
        # Add is_verified column
        try:
            conn.execute(text("ALTER TABLE users ADD COLUMN is_verified BOOLEAN DEFAULT FALSE"))
            print("Added is_verified column")
        except Exception as e:
            print(f"is_verified column may already exist: {e}")
        
        # Add verification_code column
        try:
            conn.execute(text("ALTER TABLE users ADD COLUMN verification_code VARCHAR"))
            print("Added verification_code column")
        except Exception as e:
            print(f"verification_code column may already exist: {e}")
        
        # Add verification_code_expires column
        try:
            conn.execute(text("ALTER TABLE users ADD COLUMN verification_code_expires DATETIME"))
            print("Added verification_code_expires column")
        except Exception as e:
            print(f"verification_code_expires column may already exist: {e}")
        
        conn.commit()
        print("Migration complete!")

if __name__ == "__main__":
    migrate()
