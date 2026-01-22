
import requests
import time

BASE_URL = "http://127.0.0.1:8000"

def get_auth_token():
    # Helper to get a token (assuming valid credentials exist or creating a test user)
    # For now, let's assume we can register a temp user or use an existing one
    # Note: This test might fail if the user already exists, so we handle it.
    
    email = f"ratetest_{int(time.time())}@example.com"
    password = "password123"
    
    try:
        # 1. Register
        reg_data = {
            "name": "Rate Test User",
            "email": email,
            "phone_number": f"0911{str(int(time.time()))[-6:]}", # Random phone
            "password": password
        }
        requests.post(f"{BASE_URL}/auth/register", json=reg_data)
        
        # 2. Login
        login_data = {
            "email": email,
            "password": password
        }
        res = requests.post(f"{BASE_URL}/auth/token", json=login_data)
        if res.status_code == 200:
            return res.json()["access_token"], reg_data["phone_number"]
    except Exception as e:
        print(f"Auth setup failed: {e}")
    
    return None, None

def verify_rate_limits():
    print("🚀 Starting Rate Limit Verification...")
    
    token, phone = get_auth_token()
    if not token:
        print("❌ Could not get auth token. backend might be down or registration failed.")
        return

    headers = {"Authorization": f"Bearer {token}"}
    
    print(f"Authenticated as test user. Phone: {phone}")
    
    # --- TEST 1: Request Verification Code (Limit: 3/hour) ---
    print("\n--- Testing /auth/request-verification (Limit: 3/hour) ---")
    url = f"{BASE_URL}/auth/request-verification"
    data = {"phone_number": phone}
    
    for i in range(1, 6):
        res = requests.post(url, json=data, headers=headers)
        print(f"Request {i}: Status {res.status_code}")
        
        if res.status_code == 429:
            print("✅ Rate limit successfully triggered (429 Too Many Requests)!")
            break
        elif res.status_code != 200 and res.status_code != 429:
             print(f"⚠️ Unexpected status: {res.status_code} - {res.text}")
    
    if res.status_code != 429:
        print("❌ Failed to trigger rate limit for verification request.")

    # --- TEST 2: Verify Phone Code (Limit: 5/minute) ---
    print("\n--- Testing /auth/verify-phone (Limit: 5/minute) ---")
    verify_url = f"{BASE_URL}/auth/verify-phone"
    # We use a dummy code to trigger failures (which should still count towards rate limit)
    # The rate limiter works on the endpoint hit, regardless of business logic success/fail usually,
    # unless specifically configured otherwise.
    verify_data = {"phone_number": phone, "code": "000000"} 
    
    for i in range(1, 8):
        res = requests.post(verify_url, json=verify_data, headers=headers)
        print(f"Request {i}: Status {res.status_code}")
        
        if res.status_code == 429:
            print("✅ Rate limit successfully triggered (429 Too Many Requests)!")
            break
        
    if res.status_code != 429:
        print("❌ Failed to trigger rate limit for code verification.")

if __name__ == "__main__":
    verify_rate_limits()
