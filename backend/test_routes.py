
from main import app

print("Available routes:")
for route in app.routes:
    print(f"  {route.methods} {route.path}")