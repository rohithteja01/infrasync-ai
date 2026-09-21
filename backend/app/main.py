from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.api.health import router as health_router
from app.api.ingestion import router as ingestion_router
from app.api.execution import router as execution_router
from app.api.validation import router as validation_router
from app.api.schedule_update import router as schedule_update_router
from app.api.institutional_memory_api import router as institutional_memory_router
from app.api.system_integration import router as system_integration_router
from app.api.reports import router as reports_router
from app.api.files import router as files_router
from app.api.auth import router as auth_router
from app.db.migrate_project_files import init_project_files_table
from app.db.migrate_user_profiles import init_user_profiles_table

app = FastAPI(
    title=settings.PROJECT_NAME,
    description="OIL AI Copilot - AI-powered infrastructure project planning-to-execution platform API",
    version="0.1.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

@app.on_event("startup")
def on_startup():
    init_project_files_table()
    init_user_profiles_table()

# Configure CORS for frontend access
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS if settings.CORS_ORIGINS else ["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register API routes
app.include_router(health_router, prefix=settings.API_V1_STR)
app.include_router(files_router, prefix=f"{settings.API_V1_STR}/files", tags=["Project Files"])
app.include_router(ingestion_router, prefix=f"{settings.API_V1_STR}/ingestion")
app.include_router(execution_router, prefix=f"{settings.API_V1_STR}/execution")
app.include_router(validation_router, prefix=f"{settings.API_V1_STR}/validation")
app.include_router(schedule_update_router, prefix=f"{settings.API_V1_STR}/schedule")
app.include_router(institutional_memory_router, prefix=f"{settings.API_V1_STR}/institutional-memory")
app.include_router(system_integration_router, prefix=f"{settings.API_V1_STR}/system")
app.include_router(reports_router, prefix=f"{settings.API_V1_STR}/reports", tags=["Reports"])
app.include_router(auth_router, prefix=f"{settings.API_V1_STR}/auth", tags=["Authentication"])



@app.get("/", tags=["Root"])
def root():
    return {
        "message": f"Welcome to {settings.PROJECT_NAME} Backend API",
        "health_check": f"{settings.API_V1_STR}/health",
        "documentation": "/docs"
    }
