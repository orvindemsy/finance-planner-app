from fastapi.templating import Jinja2Templates

from app.config import BASE_DIR

templates = Jinja2Templates(directory=str(BASE_DIR / "app" / "templates"))


def money(value) -> str:
    """Format a number as XXX,XXX,XXX.XX."""
    return f"{float(value):,.2f}"


templates.env.filters["money"] = money
