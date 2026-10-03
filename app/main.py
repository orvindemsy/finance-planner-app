from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

from app.config import BASE_DIR
from app.routers import accounts, budgets, categories, dashboard, settings, transactions

app = FastAPI(title="Budget Tracker")

app.mount("/static", StaticFiles(directory=str(BASE_DIR / "app" / "static")), name="static")

app.include_router(dashboard.router)
app.include_router(transactions.router)
app.include_router(budgets.router)
app.include_router(categories.router)
app.include_router(accounts.router)
app.include_router(settings.router)
