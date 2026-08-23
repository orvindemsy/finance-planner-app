from calendar import monthrange
from datetime import date
from typing import Optional, Tuple

from fastapi import APIRouter, Depends, Request
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.db.base import get_db
from app.db.models import Budget, Category, CategoryType, Transaction
from app.templating import templates

router = APIRouter()


def parse_period(period_str: Optional[str]) -> date:
    if period_str:
        try:
            year, month = map(int, period_str.split("-"))
            return date(year, month, 1)
        except (ValueError, TypeError):
            pass
    today = date.today()
    return date(today.year, today.month, 1)


def period_bounds(period: date) -> Tuple[date, date]:
    last_day = monthrange(period.year, period.month)[1]
    return period, date(period.year, period.month, last_day)


def shift_period(period: date, delta_months: int) -> date:
    month_index = period.month - 1 + delta_months
    year = period.year + month_index // 12
    month = month_index % 12 + 1
    return date(year, month, 1)


@router.get("/")
def dashboard(request: Request, period: Optional[str] = None, db: Session = Depends(get_db)):
    current_period = parse_period(period)
    start, end = period_bounds(current_period)

    def total_for(category_type: CategoryType) -> float:
        result = (
            db.query(func.coalesce(func.sum(Transaction.amount), 0))
            .join(Category)
            .filter(Category.type == category_type, Transaction.date >= start, Transaction.date <= end)
            .scalar()
        )
        return float(result or 0)

    income_total = total_for(CategoryType.INCOME)
    expense_total = total_for(CategoryType.EXPENSE)
    net = income_total - expense_total

    planned_expense = float(
        db.query(func.coalesce(func.sum(Budget.planned_amount), 0))
        .join(Category)
        .filter(Category.type == CategoryType.EXPENSE, Budget.period == current_period)
        .scalar()
        or 0
    )

    category_rows = (
        db.query(
            Category.id,
            Category.name,
            Category.type,
            func.coalesce(func.sum(Transaction.amount), 0).label("actual"),
        )
        .outerjoin(
            Transaction,
            (Transaction.category_id == Category.id)
            & (Transaction.date >= start)
            & (Transaction.date <= end),
        )
        .filter(Category.is_active.is_(True))
        .group_by(Category.id)
        .order_by(Category.type, Category.name)
        .all()
    )

    planned_by_category = {
        b.category_id: b.planned_amount
        for b in db.query(Budget).filter(Budget.period == current_period).all()
    }

    breakdown = [
        {
            "name": row.name,
            "type": row.type.value,
            "actual": float(row.actual or 0),
            "planned": float(planned_by_category.get(row.id, 0) or 0),
        }
        for row in category_rows
    ]

    recent_transactions = (
        db.query(Transaction)
        .order_by(Transaction.date.desc(), Transaction.id.desc())
        .limit(10)
        .all()
    )

    return templates.TemplateResponse(
        "dashboard.html",
        {
            "request": request,
            "period_str": current_period.strftime("%Y-%m"),
            "prev_period_str": shift_period(current_period, -1).strftime("%Y-%m"),
            "next_period_str": shift_period(current_period, 1).strftime("%Y-%m"),
            "income_total": income_total,
            "expense_total": expense_total,
            "net": net,
            "planned_expense": planned_expense,
            "expense_delta": expense_total - planned_expense,
            "breakdown": breakdown,
            "recent_transactions": recent_transactions,
        },
    )
