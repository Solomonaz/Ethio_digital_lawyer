import requests
import os

TELEGRAM_GATEWAY_API_TOKEN = os.getenv("TELEGRAM_GATEWAY_API_TOKEN")
TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN")
# If using the Gateway API
GATEWAY_URL = "https://gatewayapi.telegram.org/sendVerificationMessage"

class TelegramService:
    @staticmethod
    def send_verification_code(phone_number: str, code: str):
        """
        Sends a verification code to the specified phone number.
        This implementation assumes we are using the Telegram Gateway API for seamless phone verification.
        """
        if not TELEGRAM_GATEWAY_API_TOKEN:
            print("Telegram Gateway Token not found. Skipping real SMS/Message.")
            print(f"Deployment Simulation: Code {code} sent to {phone_number}")
            return True

        headers = {
            "Authorization": f"Bearer {TELEGRAM_GATEWAY_API_TOKEN}",
            "Content-Type": "application/json"
        }
        
        payload = {
            "phone_number": phone_number,
            "code": code,
            "ttl": 300, # 5 minutes
            "callback_url": "" 
        }

        try:
            response = requests.post(GATEWAY_URL, json=payload, headers=headers)
            response.raise_for_status()
            result = response.json()
            if result.get("ok"):
                return True
            else:
                print(f"Telegram Gateway Error: {result.get('error')}")
                return False
        except requests.exceptions.RequestException as e:
            print(f"Telegram Service Connection Error: {e}")
            return False

    @staticmethod
    def send_message_via_bot(chat_id: str, text: str):
        """
        Fallback/Alternative: Send message via Bot API if we have a chat_id.
        Not used for initial phone registration usually, as we don't have chat_id yet.
        """
        if not TELEGRAM_BOT_TOKEN:
            return False
            
        url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage"
        payload = {
            "chat_id": chat_id,
            "text": text
        }
        try:
            requests.post(url, json=payload)
            return True
        except Exception as e:
            print(f"Bot Send Error: {e}")
            return False
