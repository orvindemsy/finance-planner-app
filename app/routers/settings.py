from decimal import Decimal, InvalidOperation

from fastapi import APIRouter, Depends, Form, Request
from sqlalchemy.orm import Session

from app.db.base import get_db
from app.db.models import BudgetDefault, Category, CategoryType
from app.routers.dashboard import DEFAULT_CURRENCY
from app.templating import templates

router = APIRouter(prefix="/settings")


def _rows_for_currency(db: Session, currency: str) -> list:
    categories = (
        db.query(Category)
        .filter(Category.is_active.is_(True), Category.type != CategoryType.TRANSFER)
        .order_by(Category.type, Category.name)
        .all()
    )
    defaults_by_category = {
        d.category_id: d.planned_amount
        for d in db.query(BudgetDefault).filter(BudgetDefault.currency == currency).all()
    }
    return [
        {"category": category, "planned": float(defaults_by_category.get(category.id, 0) or 0)}
        for category in categories
    ]


@router.get("")
def view_settings(request: Request, currency: str = DEFAULT_CURRENCY, db: Session = Depends(get_db)):
    rows = _rows_for_currency(db, currency)
    return templates.TemplateResponse(
        "settings.html",
        {"request": request, "currency": currency, "rows": rows},
    )


@router.post("/{category_id}")
def save_default(
    request: Request,
    category_id: int,
    currency: str = Form(DEFAULT_CURRENCY),
    planned_amount: str = Form(...),
    db: Session = Depends(get_db),
):
    try:
        amount_value = abs(Decimal(planned_amount or "0"))
    except InvalidOperation:
        amount_value = Decimal("0")

    default = (
        db.query(BudgetDefault)
        .filter(BudgetDefault.category_id == category_id, BudgetDefault.currency == currency)
        .first()
    )
    if default:
        default.planned_amount = amount_value
    else:
        default = BudgetDefault(category_id=category_id, currency=currency, planned_amount=amount_value)
        db.add(default)
    db.commit()

    rows = _rows_for_currency(db, currency)
    row = next(r for r in rows if r["category"].id == category_id)
    return templates.TemplateResponse(
        "_settings_row.html",
        {"request": request, "row": row, "currency": currency},
    )
