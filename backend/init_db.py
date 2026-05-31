"""
Initialize the database: create tables and seed a default admin user.

Run with: python init_db.py
"""
import os
from app.core.database import Base, engine, SessionLocal
from app.models.models import User, Workflow, Execution
from app.core.security import get_password_hash


def init_db():
    """Create all database tables."""
    Base.metadata.create_all(bind=engine)
    print("✅ Database tables created successfully!")


def seed_admin():
    """Create a default admin user if none exists."""
    db = SessionLocal()
    try:
        existing = db.query(User).filter(User.username == "admin").first()
        if existing:
            print("ℹ️  Admin user already exists — skipping seed.")
            return

        admin_email = os.getenv("ADMIN_EMAIL", "admin@example.com")
        admin_password = os.getenv("ADMIN_PASSWORD", "admin123")

        admin = User(
            email=admin_email,
            username="admin",
            hashed_password=get_password_hash(admin_password),
            is_active=True,
            is_superuser=True,
        )
        db.add(admin)
        db.commit()
        print(f"✅ Default admin user created  →  email: {admin_email}  password: {admin_password}")
        print("   ⚠️  Change the password immediately in production!")
    finally:
        db.close()


if __name__ == "__main__":
    init_db()
    seed_admin()
