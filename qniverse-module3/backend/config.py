import os
from dotenv import load_dotenv

load_dotenv()

class Config:
    HOST = os.getenv('HOST', '0.0.0.0')
    PORT = int(os.getenv('PORT', 8000))
    DEBUG = os.getenv('DEBUG', 'False').lower() == 'true'
    EXECUTION_TIMEOUT = int(os.getenv('EXECUTION_TIMEOUT', 300))
    MEMORY_LIMIT_MB = int(os.getenv('MEMORY_LIMIT_MB', 512))
    MAX_QUBITS = int(os.getenv('MAX_QUBITS', 25))
    CORS_ORIGINS = [
        "http://localhost:3000",
        "http://localhost:8080",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:8080",
    ]
    AVAILABLE_BACKENDS = ["qasm_simulator", "statevector_simulator", "unitary_simulator"]

config = Config()