import enum
import datetime as dt
from decimal import Decimal
from typing import Optional

from sqlalchemy import (
    Date,
    DateTime,
    Enum,
    ForeignKey,
    Numeric,
    String,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class CategoryType(str, enum.Enum):
    INCOME = "income"
    EXPENSE = "expense"
    SAVINGS = "savings"
    TRANSFER = "transfer"


class TransactionDirection(str, enum.Enum):
    INFLOW = "inflow"
    OUTFLOW = "outflow"


class TransactionStatus(str, enum.Enum):
    FINALIZED = "finalized"
    PENDING = "pending"


class Account(Base):
    __tablename__ = "accounts"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(120), unique=True, nullable=False)
    currency: Mapped[str] = mapped_column(String(3), nullable=False)
    is_active: Mapped[bool] = mapped_column(default=True, nullable=False)
    created_at: Mapped[dt.datetime] = mapped_column(DateTime, server_default=func.now())

    transactions: Mapped[list["Transaction"]] = relationship(back_populates="account")


class Category(Base):
    __tablename__ = "categories"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(120), unique=True, nullable=False)
    type: Mapped[CategoryType] = mapped_column(Enum(CategoryType), nullable=False)
    is_active: Mapped[bool] = mapped_column(default=True, nullable=False)
    created_at: Mapped[dt.datetime] = mapped_column(DateTime, server_default=func.now())

    transactions: Mapped[list["Transaction"]] = relationship(back_populates="category")
    budgets: Mapped[list["Budget"]] = relationship(back_populates="category")


class Transaction(Base):
    __tablename__ = "transactions"

    id: Mapped[int] = mapped_column(primary_key=True)
    date: Mapped[dt.date] = mapped_column(Date, nullable=False, index=True)
    amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    direction: Mapped[TransactionDirection] = mapped_column(Enum(TransactionDirection), nullable=False)
    status: Mapped[TransactionStatus] = mapped_column(
        Enum(TransactionStatus), nullable=False, default=TransactionStatus.FINALIZED
    )
    category_id: Mapped[int] = mapped_column(ForeignKey("categories.id"), nullable=False, index=True)
    account_id: Mapped[int] = mapped_column(ForeignKey("accounts.id"), nullable=False, index=True)
    description: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    source: Mapped[Optional[str]] = mapped_column(String(120), nullable=True)
    external_ref: Mapped[Optional[str]] = mapped_column(String(64), unique=True, nullable=True)
    created_at: Mapped[dt.datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[Optional[dt.datetime]] = mapped_column(DateTime, onupdate=func.now())

    category: Mapped["Category"] = relationship(back_populates="transactions")
    account: Mapped["Account"] = relationship(back_populates="transactions")


class Budget(Base):
    __tablename__ = "budgets"
    __table_args__ = (
        UniqueConstraint("category_id", "period", "currency", name="uq_budget_category_period_currency"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    category_id: Mapped[int] = mapped_column(ForeignKey("categories.id"), nullable=False, index=True)
    period: Mapped[dt.date] = mapped_column(Date, nullable=False)
    currency: Mapped[str] = mapped_column(String(3), nullable=False)
    planned_amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    notes: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    created_at: Mapped[dt.datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[Optional[dt.datetime]] = mapped_column(DateTime, onupdate=func.now())

    category: Mapped["Category"] = relationship(back_populates="budgets")


class BudgetDefault(Base):
    """Recurring monthly planned amount per category, used as a fallback for
    any period that has no explicit Budget row of its own."""

    __tablename__ = "budget_defaults"
    __table_args__ = (
        UniqueConstraint("category_id", "currency", name="uq_budget_default_category_currency"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    category_id: Mapped[int] = mapped_column(ForeignKey("categories.id"), nullable=False, index=True)
    currency: Mapped[str] = mapped_column(String(3), nullable=False)
    planned_amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    created_at: Mapped[dt.datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[Optional[dt.datetime]] = mapped_column(DateTime, onupdate=func.now())

    category: Mapped["Category"] = relationship()
