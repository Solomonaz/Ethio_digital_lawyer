import requests

BASE_URL = "http://127.0.0.1:8000"

def verify_config():
    try:
        response = requests.get(f"{BASE_URL}/config")
        if response.status_code == 200:
            config = response.json()
            print(f"GET /config SUCCESS: {config}")
        else:
            print(f"GET /config FAILED: {response.status_code} - {response.text}")
    except Exception as e:
        print(f"Verification failed: {e}")

if __name__ == "__main__":
    verify_config()
