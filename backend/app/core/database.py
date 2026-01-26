from sqlalchemy import create_engine, event
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import QueuePool, NullPool
from app.core.config import settings

# SQLite connection args
# check_same_thread=False is needed for FastAPI async endpoints
connect_args = {}
if "sqlite" in settings.DATABASE_URL:
    connect_args["check_same_thread"] = False

# Determine pool class based on database type
# For SQLite: Use NullPool to avoid connection sharing issues
# This creates a new connection for each request, avoiding concurrent access problems
if "sqlite" in settings.DATABASE_URL:
    pool_class = NullPool
    pool_kwargs = {}
else:
    pool_class = QueuePool
    pool_kwargs = {
        "pool_size": 5,
        "max_overflow": 10,
        "pool_pre_ping": True,
    }

engine = create_engine(
    settings.DATABASE_URL,
    connect_args=connect_args,
    poolclass=pool_class,
    **pool_kwargs,
    # Disable SQL echo - too verbose even for development
    # Set to True only when debugging specific SQL issues
    echo=False,
)

# SQLite performance optimizations
@event.listens_for(engine, "connect")
def set_sqlite_pragma(dbapi_connection, connection_record):
    """Apply SQLite performance optimizations on each connection."""
    if "sqlite" in settings.DATABASE_URL:
        cursor = dbapi_connection.cursor()
        # WAL mode for better concurrent reads
        cursor.execute("PRAGMA journal_mode=WAL")
        # Normal synchronous for balance of safety and speed
        cursor.execute("PRAGMA synchronous=NORMAL")
        # 16MB cache size (smaller to avoid memory issues)
        cursor.execute("PRAGMA cache_size=-16000")
        # Enable foreign keys
        cursor.execute("PRAGMA foreign_keys=ON")
        # Temp store in memory
        cursor.execute("PRAGMA temp_store=MEMORY")
        # Busy timeout to handle concurrent access
        cursor.execute("PRAGMA busy_timeout=5000")
        cursor.close()

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db():
    """Dependency for getting database session with proper lifecycle management."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
