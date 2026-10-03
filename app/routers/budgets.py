from datetime import date
from decimal import Decimal, InvalidOperation
from typing import Optional

from fastapi import APIRouter, Depends, Form, Request
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.db.base import get_db
from app.db.models import Account, Budget, Category, CategoryType, Transaction
from app.routers.dashboard import (
    DEFAULT_CURRENCY,
    SIGNED_AMOUNT,
    actual_for_type,
    effective_planned_by_category,
    parse_period,
    period_bounds,
    shift_period,
)
from app.templating import templates

router = APIRouter(prefix="/budgets")


def _rows_for_period(db: Session, period: date, currency: str) -> list:
    start, end = period_bounds(period)
    categories = (
        db.query(Category)
        .filter(Category.is_active.is_(True), Category.type != CategoryType.TRANSFER)
        .order_by(Category.type, Category.name)
        .all()
    )
    planned_by_category = effective_planned_by_category(db, period, currency)
    actual_by_category = dict(
        db.query(Transaction.category_id, func.coalesce(func.sum(SIGNED_AMOUNT), 0))
        .join(Account, Transaction.account_id == Account.id)
        .filter(Transaction.date >= start, Transaction.date <= end, Account.currency == currency)
        .group_by(Transaction.category_id)
        .all()
    )
    return [
        {
            "category": category,
            "planned": float(planned_by_category.get(category.id, 0) or 0),
            "actual": float(actual_for_type(category.type, actual_by_category.get(category.id, 0) or 0)),
        }
        for category in categories
    ]


@router.get("")
def view_budgets(
    request: Request,
    period: Optional[str] = None,
    currency: str = DEFAULT_CURRENCY,
    db: Session = Depends(get_db),
):
    current_period = parse_period(period)
    rows = _rows_for_period(db, current_period, currency)
    return templates.TemplateResponse(
        "budgets.html",
        {
            "request": request,
            "period_str": current_period.strftime("%Y-%m"),
            "prev_period_str": shift_period(current_period, -1).strftime("%Y-%m"),
            "next_period_str": shift_period(current_period, 1).strftime("%Y-%m"),
            "currency": currency,
            "rows": rows,
        },
    )


@router.post("/{category_id}")
def save_budget(
    request: Request,
    category_id: int,
    period: str = Form(...),
    currency: str = Form(DEFAULT_CURRENCY),
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
        .filter(
            Budget.category_id == category_id,
            Budget.period == current_period,
            Budget.currency == currency,
        )
        .first()
    )
    if budget:
        budget.planned_amount = amount_value
    else:
        budget = Budget(
            category_id=category_id,
            period=current_period,
            currency=currency,
            planned_amount=amount_value,
        )
        db.add(budget)
    db.commit()

    rows = _rows_for_period(db, current_period, currency)
    row = next(r for r in rows if r["category"].id == category_id)
    return templates.TemplateResponse(
        "_budget_row.html",
        {"request": request, "row": row, "period_str": current_period.strftime("%Y-%m"), "currency": currency},
    )
