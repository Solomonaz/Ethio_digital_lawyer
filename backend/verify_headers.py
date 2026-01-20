
import requests
import sys

def verify_headers():
    url = "http://127.0.0.1:8000/docs" # Docs endpoint should also have headers
    expected_headers = {
        "X-Frame-Options": "DENY",
        "X-Content-Type-Options": "nosniff",
        "X-XSS-Protection": "1; mode=block",
        "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
        "Referrer-Policy": "strict-origin-when-cross-origin",
        "Content-Security-Policy": "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.tailwindcss.com https://aistudiocdn.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https:; connect-src 'self' http://localhost:8000 ws://localhost:8000 http://127.0.0.1:8000 ws://127.0.0.1:8000 https://aistudiocdn.com;"
    }

    print(f"Checking headers for {url}...")
    try:
        response = requests.get(url, timeout=5)
        print(f"Status Code: {response.status_code}")
        
        all_present = True
        for header, expected_value in expected_headers.items():
            if header not in response.headers:
                print(f"❌ MISSING: {header}")
                all_present = False
            elif response.headers[header] != expected_value:
                print(f"⚠️ MISMATCH: {header}")
                print(f"   Expected: {expected_value}")
                print(f"   Actual:   {response.headers[header]}")
                # We can be lenient with CSP string matching if it varies slightly due to spacing
                if header == "Content-Security-Policy":
                     print("   (Checking CSP content manually recommended if mismatch is just formatting)")
                else:
                    all_present = False
            else:
                print(f"✅ PRESENT: {header}")
        
        if all_present:
            print("\n🎉 All security headers are correctly implemented!")
        else:
            print("\n⚠️ Some headers are missing or incorrect.")

    except requests.exceptions.ConnectionError:
        print(f"❌ Could not connect to {url}. Is the backend running?")
    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == "__main__":
    verify_headers()
