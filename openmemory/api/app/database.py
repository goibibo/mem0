import os

from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

# load .env file (make sure you have DATABASE_URL set)
load_dotenv()

# Check environment
ENV = os.getenv("ENV", "prod").lower()

# Configure database based on environment
if ENV == "dev":
    # Development: Use SQLite
    DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./openmemory.db")
    engine = create_engine(
        DATABASE_URL,
        connect_args={"check_same_thread": False}  # Needed for SQLite
    )
else:
    # Production: Use MySQL
    # Get MySQL connection parameters from environment variables
    MYSQL_HOST = os.getenv("MYSQL_HOST", "172.16.117.113")
    MYSQL_PORT = os.getenv("MYSQL_PORT", "3306")
    MYSQL_USER = os.getenv("MYSQL_USER", "root")
    MYSQL_PASSWORD = os.getenv("MYSQL_PASSWORD", "")
    MYSQL_DATABASE = os.getenv("MYSQL_DATABASE", "openmemory")
    
    # Allow DATABASE_URL to override if provided
    DATABASE_URL = os.getenv(
        "DATABASE_URL", 
        f"mysql+pymysql://{MYSQL_USER}:{MYSQL_PASSWORD}@{MYSQL_HOST}:{MYSQL_PORT}/{MYSQL_DATABASE}?charset=utf8mb4"
    )
    
    # Create engine with MySQL-specific connection args
    engine = create_engine(
        DATABASE_URL,
        pool_pre_ping=True,  # Verify connections before using them
        pool_recycle=3600,   # Recycle connections after 1 hour
        connect_args={
            "connect_timeout": 10,
            "charset": "utf8mb4"
        }
    )

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Base class for models
Base = declarative_base()

# Dependency for FastAPI
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
