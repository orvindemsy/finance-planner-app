# syntax=docker/dockerfile:1
FROM --platform=$BUILDPLATFORM python:3.11-slim

ARG BUILDPLATFORM

WORKDIR /app
