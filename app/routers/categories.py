from fastapi import APIRouter, Depends, Form, Request
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session

from app.db.base import get_db
from app.db.models import Category, CategoryType
from app.templating import templates

router = APIRouter(prefix="/categories")


@router.get("")
def list_categories(request: Request, db: Session = Depends(get_db)):
    categories = db.query(Category).order_by(Category.type, Category.name).all()
    return templates.TemplateResponse("categories.html", {"request": request, "categories": categories})


@router.post("")
def create_category(
    name: str = Form(...),
    type: str = Form(...),
    db: Session = Depends(get_db),
):
    category = Category(name=name.strip(), type=CategoryType(type))
    db.add(category)
    db.commit()
    return RedirectResponse(url="/categories", status_code=303)


@router.post("/{category_id}/toggle")
def toggle_category(request: Request, category_id: int, db: Session = Depends(get_db)):
    category = db.get(Category, category_id)
    if category:
        category.is_active = not category.is_active
        db.commit()
    categories = db.query(Category).order_by(Category.type, Category.name).all()
    return templates.TemplateResponse("_categories_table.html", {"request": request, "categories": categories})
