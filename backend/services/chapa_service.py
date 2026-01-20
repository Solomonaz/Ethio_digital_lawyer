import requests
import os
import uuid    

CHAPA_SECRET_KEY = os.getenv("CHAPA_SECRET_KEY")
CHAPA_API_URL = "https://api.chapa.co/v1"

class ChapaService:
    @staticmethod
    def initialize_payment(email: str, amount: str, first_name: str, last_name: str, tx_ref: str, currency: str = "ETB", callback_url: str = None, return_url: str = None):
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
            "customization": {
                "title": "EthioLex Payment",
                "description": "Payment for EthioLex services"
            },
            "meta": {
                "hide_receipt": "true"
            }
        }

        try:
            response = requests.post(f"{CHAPA_API_URL}/transaction/initialize", json=payload, headers=headers)
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            print(f"Chapa Payment Error: {e}")
            if e.response:
                print(f"Response: {e.response.text}")
            return None

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
