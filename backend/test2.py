
from fastapi import FastAPI

app = FastAPI()

@app.get("/")
def root():
    return {"message": "Test works"}

@app.post("/auth/register")
def test_register():
    return {"message": "Register endpoint exists"}