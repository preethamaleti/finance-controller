import os
from pydantic_settings import BaseSettings
from pydantic import ConfigDict
from typing import Optional

class Settings(BaseSettings):
    PROJECT_NAME: str = "FINCTRL AI"
    API_V1_STR: str = "/api"
    DATABASE_URL: str = "sqlite:///./finctrl.db"
    
    # LLM Settings
    LLM_PROVIDER: str = "gemini"  # gemini, openai, anthropic, or rule_engine
    GEMINI_API_KEY: Optional[str] = os.getenv("GEMINI_API_KEY", "")
    OPENAI_API_KEY: Optional[str] = os.getenv("OPENAI_API_KEY", "")
    ANTHROPIC_API_KEY: Optional[str] = os.getenv("ANTHROPIC_API_KEY", "")
    LLM_MODEL_NAME: str = "gemini-2.5-flash"
    
    # HITL Thresholds (in INR)
    HITL_AUTO_THRESHOLD: float = 10000.0       # < 10,000 auto allowed
    HITL_RECOMMEND_THRESHOLD: float = 100000.0 # 10,000 - 100,000 review recommended
    # > 100,000 mandatory human review
    
    AI_INVESTIGATION_CONFIDENCE_THRESHOLD: float = 0.65
    
    model_config = ConfigDict(env_file=".env", extra="ignore")

settings = Settings()
