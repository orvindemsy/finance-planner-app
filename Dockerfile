# syntax=docker/dockerfile:1
FROM --platform=$BUILDPLATFORM python:3.11-slim

ARG BUILDPLATFORM

WORKDIR /app

COPY pyproject.toml poetry.lock /app/deps/

RUN pip install poetry && \
    cd deps/ && \
    poetry config virtualenvs.create false --local && \
    poetry install --no-root && \
    rm -rf /app/deps

COPY app/ /app/app/
COPY scripts/ /app/scripts/
COPY alembic/ /app/alembic/
COPY alembic.ini /app/alembic.ini

EXPOSE 8000

CMD ["sh", "-c", "alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port 8000"]
