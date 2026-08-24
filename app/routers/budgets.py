from datetime import date
from decimal import Decimal, InvalidOperation
from typing import Optional

from fastapi import APIRouter, Depends, Form, Request
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.db.base import get_db
from app.db.models import Budget, Category, Transaction
from app.routers.dashboard import parse_period, period_bounds, shift_period
from app.templating import templates

router = APIRouter(prefix="/budgets")


def _rows_for_period(db: Session, period: date) -> list:
    start, end = period_bounds(period)
    categories = (
        db.query(Category)
        .filter(Category.is_active.is_(True))
        .order_by(Category.type, Category.name)
        .all()
    )
    planned_by_category = {
        b.category_id: b.planned_amount
        for b in db.query(Budget).filter(Budget.period == period).all()
    }
    actual_by_category = dict(
        db.query(Transaction.category_id, func.coalesce(func.sum(Transaction.amount), 0))
        .filter(Transaction.date >= start, Transaction.date <= end)
        .group_by(Transaction.category_id)
        .all()
    )
    return [
        {
            "category": category,
            "planned": float(planned_by_category.get(category.id, 0) or 0),
            "actual": float(actual_by_category.get(category.id, 0) or 0),
        }
        for category in categories
    ]


@router.get("")
def view_budgets(request: Request, period: Optional[str] = None, db: Session = Depends(get_db)):
    current_period = parse_period(period)
    rows = _rows_for_period(db, current_period)
    return templates.TemplateResponse(
        "budgets.html",
        {
            "request": request,
            "period_str": current_period.strftime("%Y-%m"),
            "prev_period_str": shift_period(current_period, -1).strftime("%Y-%m"),
            "next_period_str": shift_period(current_period, 1).strftime("%Y-%m"),
            "rows": rows,
        },
    )


@router.post("/{category_id}")
def save_budget(
    request: Request,
    category_id: int,
    period: str = Form(...),
    planned_amount: str = Form(...),
    db: Session = Depends(get_db),
):
    current_period = parse_period(period)
    try:
        amount_value = abs(Decimal(planned_amount or "0"))
    except InvalidOperation:
        amount_value = Decimal("0")

    budget = (
        db.query(Budget)
        .filter(Budget.category_id == category_id, Budget.period == current_period)
        .first()
    )
    if budget:
        budget.planned_amount = amount_value
    else:
        budget = Budget(category_id=category_id, period=current_period, planned_amount=amount_value)
        db.add(budget)
    db.commit()

    rows = _rows_for_period(db, current_period)
    row = next(r for r in rows if r["category"].id == category_id)
    return templates.TemplateResponse(
        "_budget_row.html",
        {"request": request, "row": row, "period_str": current_period.strftime("%Y-%m")},
    )
