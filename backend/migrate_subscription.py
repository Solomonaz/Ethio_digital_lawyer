from sqlalchemy import create_engine, text
from database import DATABASE_URL

def migrate():
    engine = create_engine(DATABASE_URL)
    with engine.connect() as conn:
        print("Migrating database for subscription feature...")
        
        # 1. Add subscription_expires_at to users table
        try:
            conn.execute(text("ALTER TABLE users ADD COLUMN subscription_expires_at DATETIME"))
            print("Added subscription_expires_at to users table.")
        except Exception as e:
            if "duplicate column" in str(e).lower() or "operationalerror" in str(e).lower():
                print("Column subscription_expires_at likely already exists.")
            else:
                print(f"Error adding subscription_expires_at: {e}")

        # 2. Add payment_type to payments table
        try:
            conn.execute(text("ALTER TABLE payments ADD COLUMN payment_type VARCHAR DEFAULT 'recharge'"))
            print("Added payment_type to payments table.")
        except Exception as e:
            if "duplicate column" in str(e).lower() or "operationalerror" in str(e).lower():
                print("Column payment_type likely already exists.")
            else:
                print(f"Error adding payment_type: {e}")

        # 3. Insert default subscription price setting
        try:
            # Check if setting exists
            result = conn.execute(text("SELECT * FROM settings WHERE key = 'subscription_24h_price'")).fetchone()
            if not result:
                conn.execute(text(
                    "INSERT INTO settings (key, value, description, updated_at) VALUES (:key, :value, :desc, CURRENT_TIMESTAMP)"
                ), {"key": "subscription_24h_price", "value": "100", "desc": "Price for 24-hour subscription (ETB)"})
                print("Inserted default subscription_24h_price setting.")
            else:
                print("Setting subscription_24h_price already exists.")
        except Exception as e:
            print(f"Error inserting setting: {e}")

        conn.commit()
        print("Migration complete!")

if __name__ == "__main__":
    migrate()
