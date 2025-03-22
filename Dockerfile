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
