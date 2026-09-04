import os
from pydantic_settings import BaseSettings
from pydantic import ConfigDict
from typing import Optional

class Settings(BaseSettings):
    PROJECT_NAME: str = "FINCTRL AI"
    API_V1_STR: str = "/api"
    DATABASE_URL: str = "sqlite:///./finctrl.db"
    
    # LLM Settings
    LLM_PROVIDER: str = "gemini"  # gemini, groq, openai, anthropic, or rule_engine
    GEMINI_API_KEY: Optional[str] = os.getenv("GEMINI_API_KEY", "")
    GROQ_API_KEY: Optional[str] = os.getenv("GROQ_API_KEY", "")
    GROQ_MODEL_NAME: str = os.getenv("GROQ_MODEL_NAME", "llama-3.3-70b-versatile")
    OLLAMA_BASE_URL: str = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
    OPENAI_API_KEY: Optional[str] = os.getenv("OPENAI_API_KEY", "")
    ANTHROPIC_API_KEY: Optional[str] = os.getenv("ANTHROPIC_API_KEY", "")
    LLM_MODEL_NAME: str = "gemini-2.5-flash"
    
    # HITL Thresholds (in INR)
    HITL_AUTO_THRESHOLD: float = 10000.0       # < 10,000 auto allowed
    HITL_RECOMMEND_THRESHOLD: float = 100000.0 # 10,000 - 100,000 review recommended
    # > 100,000 mandatory human review
    
    AI_INVESTIGATION_CONFIDENCE_THRESHOLD: float = 0.65
    
    # Razorpay Integration
    RAZORPAY_KEY_ID: Optional[str] = os.getenv("RAZORPAY_KEY_ID", "rzp_test_buildathon_mock")
    RAZORPAY_KEY_SECRET: Optional[str] = os.getenv("RAZORPAY_KEY_SECRET", "rzp_secret_buildathon_mock")
    RAZORPAY_WEBHOOK_SECRET: str = os.getenv("RAZORPAY_WEBHOOK_SECRET", "finctrl_razorpay_webhook_secret_2026")
    
    model_config = ConfigDict(env_file=".env", extra="ignore")

settings = Settings()
