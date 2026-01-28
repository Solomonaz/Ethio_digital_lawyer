import requests
import os
import uuid    

CHAPA_SECRET_KEY = os.getenv("CHAPA_SECRET_KEY")
CHAPA_API_URL = "https://api.chapa.co/v1"

class ChapaService:
    @staticmethod
    def initialize_payment(email: str, amount: str, first_name: str, last_name: str, tx_ref: str, currency: str = "ETB", callback_url: str = None, return_url: str = None, customization: dict = None):
        headers = {
            "Authorization": f"Bearer {CHAPA_SECRET_KEY}",
            "Content-Type": "application/json"
        }
        
        payload = {
            "amount": amount,
            "currency": currency,
            "email": email,
            "first_name": first_name,
            "last_name": last_name,
            "tx_ref": tx_ref,
            "callback_url": callback_url,
            "return_url": return_url,
            "customization": customization or {
                "title": "EthioLex Pay",
                "description": "Payment for EthioLex services"
            },
            "meta": {
                "hide_receipt": "true"
            }
        }
        
        # Remove None values
        payload = {k: v for k, v in payload.items() if v is not None}
        
        print(f"[CHAPA DEBUG] Payload: {payload}")

        try:
            response = requests.post(f"{CHAPA_API_URL}/transaction/initialize", json=payload, headers=headers, timeout=30)
            try:
                # Try to parse error details if any
                if not response.ok:
                    print(f"[CHAPA ERROR BODY] {response.text}")
                    return {"status": "error", "message": response.text}
            except:
                pass
                
            response.raise_for_status()
            return response.json()
        except requests.exceptions.Timeout as e:
            print(f"Chapa Payment Timeout: {e}")
            return {"status": "error", "message": "Connection to Chapa timed out. Please try again."}
        except requests.exceptions.ConnectionError as e:
            print(f"Chapa Connection Error: {e}")
            return {"status": "error", "message": "Could not connect to Chapa. Please check your internet connection."}
        except requests.exceptions.RequestException as e:
            print(f"Chapa Payment Error: {e}")
            error_msg = str(e)
            if e.response:
                print(f"Response: {e.response.text}")
                error_msg = e.response.text
            return {"status": "error", "message": error_msg}

    @staticmethod
    def verify_payment(tx_ref: str):
        headers = {
            "Authorization": f"Bearer {CHAPA_SECRET_KEY}"
        }
        
        try:
            response = requests.get(f"{CHAPA_API_URL}/transaction/verify/{tx_ref}", headers=headers)
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            print(f"Chapa Verification Error: {e}")
            return None
