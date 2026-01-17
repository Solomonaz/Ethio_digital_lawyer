"""
Database migration script to fix data type issues:
1. Convert string booleans to actual Boolean type for is_admin, is_staff
2. Convert email_verified and phone_verified logic (NULL = verified, string = code)
3. Convert payment amount from String to Float

IMPORTANT: Backup your database before running this migration!
"""
import sqlite3
import os
from datetime import datetime

DB_PATH = "ethiolex.db"

def backup_database():
    """Create a backup of the database before migration"""
    backup_path = f"ethiolex_backup_{datetime.now().strftime('%Y%m%d_%H%M%S')}.db"

    if os.path.exists(DB_PATH):
        import shutil
        shutil.copy2(DB_PATH, backup_path)
        print(f"✓ Database backed up to: {backup_path}")
        return backup_path
    else:
        print(f"WARNING: Database file {DB_PATH} not found!")
        return None

def migrate_users_table(conn):
    """Migrate users table to fix boolean and verification field types"""
    cursor = conn.cursor()

    print("\n=== Migrating Users Table ===")

    # Step 1: Create new table with correct schema
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS users_new (
            id INTEGER PRIMARY KEY,
            username TEXT UNIQUE NOT NULL,
            name TEXT,
            email TEXT UNIQUE,
            email_verified TEXT,  -- NULL means verified, string means pending code
            phone_number TEXT,
            phone_verified TEXT,  -- NULL means verified, string means pending code
            password_hash TEXT NOT NULL,
            auth_provider TEXT DEFAULT 'local',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            balance REAL DEFAULT 0.0,
            is_admin INTEGER DEFAULT 0,  -- SQLite uses INTEGER for BOOLEAN (0=False, 1=True)
            is_staff INTEGER DEFAULT 0   -- SQLite uses INTEGER for BOOLEAN (0=False, 1=True)
        )
    """)

    # Step 2: Check if old table exists
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='users'")
    if cursor.fetchone():
        print("✓ Found existing users table")

        # Step 3: Migrate data with transformations
        cursor.execute("""
            INSERT INTO users_new (
                id, username, name, email, email_verified, phone_number,
                phone_verified, password_hash, auth_provider, created_at,
                balance, is_admin, is_staff
            )
            SELECT
                id, username, name, email,
                CASE
                    WHEN email_verified = 'True' THEN NULL
                    ELSE email_verified
                END as email_verified,
                phone_number,
                CASE
                    WHEN phone_verified = 'True' THEN NULL
                    ELSE phone_verified
                END as phone_verified,
                password_hash, auth_provider, created_at, balance,
                CASE
                    WHEN is_admin = 'True' THEN 1
                    ELSE 0
                END as is_admin,
                CASE
                    WHEN is_staff = 'True' THEN 1
                    ELSE 0
                END as is_staff
            FROM users
        """)

        rows_migrated = cursor.rowcount
        print(f"✓ Migrated {rows_migrated} users")

        # Step 4: Drop old table and rename new one
        cursor.execute("DROP TABLE users")
        cursor.execute("ALTER TABLE users_new RENAME TO users")
        print("✓ Users table schema updated")
    else:
        # No existing table, just rename the new one
        cursor.execute("ALTER TABLE users_new RENAME TO users")
        print("✓ Created new users table with correct schema")

def migrate_payments_table(conn):
    """Migrate payments table to fix amount type (String -> Float)"""
    cursor = conn.cursor()

    print("\n=== Migrating Payments Table ===")

    # Step 1: Create new table with correct schema
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS payments_new (
            id INTEGER PRIMARY KEY,
            user_id INTEGER NOT NULL,
            amount REAL NOT NULL,  -- Changed from TEXT to REAL (Float)
            currency TEXT DEFAULT 'ETB',
            email TEXT NOT NULL,
            first_name TEXT,
            last_name TEXT,
            tx_ref TEXT UNIQUE NOT NULL,
            status TEXT DEFAULT 'pending',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
    """)

    # Step 2: Check if old table exists
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='payments'")
    if cursor.fetchone():
        print("✓ Found existing payments table")

        # Step 3: Migrate data with type conversion
        cursor.execute("""
            INSERT INTO payments_new (
                id, user_id, amount, currency, email, first_name,
                last_name, tx_ref, status, created_at
            )
            SELECT
                id, user_id,
                CAST(amount AS REAL) as amount,  -- Convert string to float
                currency, email, first_name, last_name,
                tx_ref, status, created_at
            FROM payments
        """)

        rows_migrated = cursor.rowcount
        print(f"✓ Migrated {rows_migrated} payments")

        # Step 4: Drop old table and rename new one
        cursor.execute("DROP TABLE payments")
        cursor.execute("ALTER TABLE payments_new RENAME TO payments")
        print("✓ Payments table schema updated")
    else:
        # No existing table, just rename the new one
        cursor.execute("ALTER TABLE payments_new RENAME TO payments")
        print("✓ Created new payments table with correct schema")

def verify_migration(conn):
    """Verify the migration was successful"""
    cursor = conn.cursor()

    print("\n=== Verifying Migration ===")

    # Check users table
    cursor.execute("PRAGMA table_info(users)")
    users_columns = {row[1]: row[2] for row in cursor.fetchall()}

    print("\nUsers table columns:")
    for col, dtype in users_columns.items():
        if col in ['is_admin', 'is_staff', 'email_verified', 'phone_verified', 'balance']:
            print(f"  {col}: {dtype}")

    # Check payments table
    cursor.execute("PRAGMA table_info(payments)")
    payments_columns = {row[1]: row[2] for row in cursor.fetchall()}

    print("\nPayments table columns:")
    if 'amount' in payments_columns:
        print(f"  amount: {payments_columns['amount']}")

    # Sample data check
    cursor.execute("SELECT COUNT(*) FROM users")
    user_count = cursor.fetchone()[0]
    print(f"\n✓ Total users: {user_count}")

    cursor.execute("SELECT COUNT(*) FROM payments")
    payment_count = cursor.fetchone()[0]
    print(f"✓ Total payments: {payment_count}")

def main():
    """Run the migration"""
    print("=" * 60)
    print("DATABASE MIGRATION SCRIPT")
    print("Fixing data type issues in ethiolex.db")
    print("=" * 60)

    # Backup first
    backup_path = backup_database()
    if not backup_path and os.path.exists(DB_PATH):
        print("\nERROR: Failed to create backup!")
        return

    if not os.path.exists(DB_PATH):
        print(f"\nWARNING: Database file {DB_PATH} does not exist.")
        print("This is OK if you're starting fresh - the new schema will be created.")
        print("Run the application to create the database with the correct schema.")
        return

    try:
        # Connect to database
        conn = sqlite3.connect(DB_PATH)
        conn.execute("PRAGMA foreign_keys = OFF")  # Disable FK constraints during migration

        # Run migrations
        migrate_users_table(conn)
        migrate_payments_table(conn)

        # Verify
        verify_migration(conn)

        # Commit changes
        conn.commit()
        print("\n" + "=" * 60)
        print("✓ MIGRATION COMPLETED SUCCESSFULLY!")
        print("=" * 60)

    except Exception as e:
        print(f"\n✗ MIGRATION FAILED: {e}")
        print(f"Your original database is backed up at: {backup_path}")
        conn.rollback()
        raise
    finally:
        if conn:
            conn.execute("PRAGMA foreign_keys = ON")  # Re-enable FK constraints
            conn.close()

if __name__ == "__main__":
    main()
