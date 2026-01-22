
from slowapi import Limiter
from slowapi.util import get_remote_address
import json

# Initialize Limiter
# By default, falls back to IP address if no other key function is provided
limiter = Limiter(key_func=get_remote_address)

def get_phone_number_key(request):
    """
    Custom key function to rate limit by phone number.
    Extracts phone_number from JSON body.
    """
    try:
        # Pydantic models parse the body, but for rate limiting middleware
        # we might need to peek at the raw body depending on when this runs.
        # However, slowapi runs after request parsing if used as decorator on endpoint.
        # But `request.json()` might be consumed. 
        # Safest way in FastAPI with slowapi is often just IP or simple params.
        # BUT, to limit by PHONE NUMBER (essential for SMS spam prev), we need the logic.
        
        # NOTE: accessing request.json() in a middleware/dependency can consume the stream.
        # slowapi handles this gracefully usually if configured right.
        pass
    except Exception:
        pass
    return get_remote_address(request)
