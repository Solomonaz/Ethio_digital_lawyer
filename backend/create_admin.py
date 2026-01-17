import sqlite3
import os
from dotenv import load_dotenv
import bcrypt

# Load .env
load_dotenv()

DB_FILE = "ethiolex.db"
ADMIN_EMAIL = os.getenv("ADMIN_EMAIL", "admin@ethiolex.com")
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "admin123")

def create_admin():
    if not os.path.exists(DB_FILE):
        print(f"Database file {DB_FILE} not found!")
        return

    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()

    # Hash password
    password_hash = bcrypt.hashpw(ADMIN_PASSWORD.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
    admin_username = ADMIN_EMAIL.split('@')[0]  # "admin"

    # Check if admin user exists
    cursor.execute("SELECT id FROM users WHERE email = ?", (ADMIN_EMAIL,))
    existing = cursor.fetchone()

    if existing:
        # Update existing user to be admin
        cursor.execute("UPDATE users SET is_admin = 1, password_hash = ? WHERE email = ?", (password_hash, ADMIN_EMAIL))
        print(f"Updated existing user '{ADMIN_EMAIL}' to admin with new password.")
    else:
        # Create new admin user
        cursor.execute("""
            INSERT INTO users (username, email, password_hash, auth_provider, is_admin, balance) 
            VALUES (?, ?, ?, 'local', 1, 1000.0)
        """, (admin_username, ADMIN_EMAIL, password_hash))
        print(f"Created new admin user: {ADMIN_EMAIL}")

    conn.commit()
    conn.close()
    print(f"\n✅ Admin user ready!")
    print(f"   Email: {ADMIN_EMAIL}")
    print(f"   Password: {ADMIN_PASSWORD}")
    print(f"\n   Login at: http://localhost:5173")

if __name__ == "__main__":
    create_admin()
