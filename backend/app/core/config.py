import os
from pydantic_settings import BaseSettings, SettingsConfigDict
from dotenv import load_dotenv

def read_env_val(key: str, default: str = "") -> str:
    """Dynamically reads the freshest value from .env file."""
    if os.path.exists(".env"):
        load_dotenv(".env", override=True)
    return os.getenv(key, default)

class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    PROJECT_NAME: str = "Quantum Telemetry, Monitoring & Resource Management Platform"
    VERSION: str = "1.0.0"
    API_V1_STR: str = "/api/v1"
    SECRET_KEY: str = ""
    
    # Database (In-Memory SQLite by default)
    DATABASE_URL: str = "sqlite:///:memory:"
    
    # Collection Intervals (in seconds)
    INTERVAL_BACKEND_STATUS: int = 120    # 2 mins
    INTERVAL_QUEUE_INFO: int = 60         # 1 min
    INTERVAL_BACKEND_PROPERTIES: int = 600 # 10 mins
    INTERVAL_CALIBRATION: int = 600       # 10 mins
    INTERVAL_CONNECTIVITY: int = 3600     # 1 hour
    INTERVAL_JOB_STATUS: int = 30         # 30 seconds
    
    # Default Thresholds
    T1_CRITICAL_US: float = 40.0
    T1_WARNING_US: float = 70.0
    T2_CRITICAL_US: float = 30.0
    T2_WARNING_US: float = 50.0
    READOUT_ERROR_CRITICAL: float = 0.08
    READOUT_ERROR_WARNING: float = 0.03
    CALIBRATION_STALE_HOURS: float = 24.0
    QUEUE_CRITICAL_JOBS: int = 50

    @property
    def ENABLE_MOCK_DATA(self) -> bool:
        val = read_env_val("ENABLE_MOCK_DATA", "true").lower().strip()
        return val in ["true", "1", "yes", "t"]

    @property
    def ADMIN_USERNAME(self) -> str:
        return read_env_val("ADMIN_USERNAME", "admin")

    @property
    def ADMIN_PASSWORD(self) -> str:
        return read_env_val("ADMIN_PASSWORD", "quantum2026")

    @property
    def USER_USERNAME(self) -> str:
        return read_env_val("USER_USERNAME", "user_researcher")

    @property
    def USER_PASSWORD(self) -> str:
        return read_env_val("USER_PASSWORD", "quantum2026")

    @property
    def IBM_QUANTUM_TOKEN(self) -> str:
        return read_env_val("IBM_QUANTUM_TOKEN", "")

    @property
    def IBM_QUANTUM_URL(self) -> str:
        return read_env_val("IBM_QUANTUM_URL", "https://auth.quantum-computing.ibm.com/api")

    @property
    def RIGETTI_API_KEY(self) -> str:
        return read_env_val("RIGETTI_API_KEY", "")

    @property
    def IONQ_API_KEY(self) -> str:
        return read_env_val("IONQ_API_KEY", "")

    @property
    def ONPREM_QPU_URL(self) -> str:
        return read_env_val("ONPREM_QPU_URL", "")

settings = Settings()
