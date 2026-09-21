from pathlib import Path
from typing import List, Union, Optional
from pydantic import AnyHttpUrl, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    PROJECT_NAME: str = "OIL AI Copilot"
    API_V1_STR: str = "/api"
    HOST: str = "0.0.0.0"
    PORT: int = 8000
    
    # Database Settings
    DATABASE_URL: str = ""

    # Supabase Storage Settings
    SUPABASE_URL: Optional[str] = None
    SUPABASE_SERVICE_ROLE_KEY: Optional[str] = None
    SUPABASE_STORAGE_BUCKET: str = "infrasync-project-files"

    # AI Configuration (Free & Local)
    AI_PROVIDER: str = "auto"
    OLLAMA_BASE_URL: str = "http://localhost:11434"
    OLLAMA_MODEL: str = "gemma4:26b"
    OLLAMA_TIMEOUT_SECONDS: float = 1.5

    # CORS Settings
    CORS_ORIGINS: Union[str, List[str]] = ["http://localhost:5173", "http://127.0.0.1:5173"]

    @field_validator("CORS_ORIGINS", mode="before")
    def assemble_cors_origins(cls, v: Union[str, List[str]]) -> List[str]:
        origins = []
        if isinstance(v, str) and not v.startswith("["):
            origins = [i.strip() for i in v.split(",") if i.strip()]
        elif isinstance(v, list):
            origins = [str(i).strip() for i in v if str(i).strip()]
        elif isinstance(v, str) and v.startswith("["):
            import json
            try:
                origins = [str(i).strip() for i in json.loads(v) if str(i).strip()]
            except Exception:
                origins = []

        # Always preserve local development origins for pairing with frontend dev server
        default_local = ["http://localhost:5173", "http://127.0.0.1:5173"]
        for loc in default_local:
            if loc not in origins:
                origins.append(loc)

        # Disallow wildcard '*' because allow_credentials=True requires explicit origins
        return [o for o in origins if o != "*"]

    model_config = SettingsConfigDict(
        env_file=str(Path(__file__).resolve().parent.parent.parent / ".env") if (Path(__file__).resolve().parent.parent.parent / ".env").exists() else ".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore"
    )


settings = Settings()
