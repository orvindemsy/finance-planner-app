import os
from pathlib import Path

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"

load_dotenv(BASE_DIR / ".env")


def get_database_url() -> str:
    return os.environ.get("DATABASE_URL", f"sqlite:///{DATA_DIR / 'budget.db'}")
