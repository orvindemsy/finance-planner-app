from calendar import monthrange
from datetime import date
from typing import Optional, Tuple

from fastapi import APIRouter, Depends, Request
from sqlalchemy import and_, case, func
from sqlalchemy.orm import Session

from app.db.base import get_db
from app.db.models import (
    Account,
    Budget,
    BudgetDefault,
    Category,
    CategoryType,
    Transaction,
    TransactionDirection,
)
from app.services.fx import CURRENCY_SYMBOLS, get_usd_rates
from app.templating import templates

router = APIRouter()

DEFAULT_CURRENCY = "JPY"

# Positive when money came in, negative when it went out. Category type then
# decides whether "actual" (the budget-relevant figure) is this net directly
# (income) or its negation (expense/savings spend, net of any reimbursement).
SIGNED_AMOUNT = case(
    (Transaction.direction == TransactionDirection.INFLOW, Transaction.amount),
    else_=-Transaction.amount,
)


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


def actual_for_type(category_type: CategoryType, net):
    return net if category_type == CategoryType.INCOME else -net


def effective_planned_by_category(db: Session, period: date, currency: str) -> dict:
    """Planned amount per category for a period, falling back to the
    recurring BudgetDefault when no period-specific Budget row exists."""
    planned = {
        d.category_id: d.planned_amount
        for d in db.query(BudgetDefault).filter(BudgetDefault.currency == currency).all()
    }
    planned.update(
        {
            b.category_id: b.planned_amount
            for b in db.query(Budget).filter(Budget.period == period, Budget.currency == currency).all()
        }
    )
    return planned


@router.get("/")
def dashboard(
    request: Request,
    period: Optional[str] = None,
    currency: str = DEFAULT_CURRENCY,
    db: Session = Depends(get_db),
):
    current_period = parse_period(period)
    start, end = period_bounds(current_period)

    def total_for(category_type: CategoryType, date_start=None, date_end=None) -> float:
        query = db.query(func.coalesce(func.sum(SIGNED_AMOUNT), 0)).join(
            Category, Transaction.category_id == Category.id
        ).filter(
            Category.type == category_type,
            Transaction.account.has(Account.currency == currency),
        )
        if date_start is not None:
            query = query.filter(Transaction.date >= date_start)
        if date_end is not None:
            query = query.filter(Transaction.date <= date_end)
        net = query.scalar()
        return float(actual_for_type(category_type, net or 0))

    income_total = total_for(CategoryType.INCOME, start, end)
    expense_total = total_for(CategoryType.EXPENSE, start, end)

    # All-time figures, independent of the selected period. Money moved into
    # a SAVINGS category isn't counted as spending, so it stays reflected
    # here — this is a proxy for net worth (income kept, whether as cash or
    # invested), not true assets-minus-liabilities since account balances
    # aren't tracked.
    total_income = total_for(CategoryType.INCOME)
    total_expense = total_for(CategoryType.EXPENSE)
    net_worth = total_income - total_expense

    date_bounds = (
        db.query(func.min(Transaction.date), func.max(Transaction.date))
        .join(Account, Transaction.account_id == Account.id)
        .filter(Account.currency == currency)
        .first()
    )
    min_date, max_date = date_bounds if date_bounds else (None, None)
    first_period = date(min_date.year, min_date.month, 1) if min_date else current_period
    last_period = date(max_date.year, max_date.month, 1) if max_date else current_period

    available_months = []
    cursor = first_period
    while cursor <= last_period:
        available_months.append(cursor.strftime("%Y-%m"))
        cursor = shift_period(cursor, 1)

    period_str = current_period.strftime("%Y-%m")
    if period_str not in available_months:
        available_months.append(period_str)
        available_months.sort()
    current_month_index = available_months.index(period_str)

    planned_by_category = effective_planned_by_category(db, current_period, currency)

    category_rows = (
        db.query(
            Category.id,
            Category.name,
            Category.type,
            func.coalesce(func.sum(SIGNED_AMOUNT), 0).label("net"),
        )
        .outerjoin(
            Transaction,
            and_(
                Transaction.category_id == Category.id,
                Transaction.date >= start,
                Transaction.date <= end,
                Transaction.account.has(Account.currency == currency),
            ),
        )
        .filter(Category.is_active.is_(True), Category.type.in_([CategoryType.INCOME, CategoryType.EXPENSE]))
        .group_by(Category.id)
        .order_by(Category.name)
        .all()
    )

    breakdown = [
        {
            "name": row.name,
            "type": row.type.value,
            "actual": float(actual_for_type(row.type, row.net or 0)),
            "budget": float(planned_by_category.get(row.id, 0) or 0),
        }
        for row in category_rows
    ]
    expense_breakdown = [row for row in breakdown if row["type"] == CategoryType.EXPENSE.value]
    income_breakdown = [row for row in breakdown if row["type"] == CategoryType.INCOME.value]

    recent_transactions = (
        db.query(Transaction)
        .join(Account)
        .filter(Account.currency == currency)
        .order_by(Transaction.date.desc(), Transaction.id.desc())
        .limit(10)
        .all()
    )

    return templates.TemplateResponse(
        "dashboard.html",
        {
            "request": request,
            "period_str": period_str,
            "prev_period_str": shift_period(current_period, -1).strftime("%Y-%m"),
            "next_period_str": shift_period(current_period, 1).strftime("%Y-%m"),
            "available_months": available_months,
            "current_month_index": current_month_index,
            "currency": currency,
            "currency_symbol": CURRENCY_SYMBOLS.get(currency, currency),
            "total_income": total_income,
            "total_expense": total_expense,
            "net_worth": net_worth,
            "fx": get_usd_rates(),
            "income_total": income_total,
            "expense_total": expense_total,
            "expense_breakdown": expense_breakdown,
            "income_breakdown": income_breakdown,
            "recent_transactions": recent_transactions,
        },
    )
