"""Sirve el frontend compilado y la API bajo un mismo origen."""

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

from .database import ROOT
from .main import app as api_app, lifespan

app = FastAPI(docs_url=None, redoc_url=None, openapi_url=None, lifespan=lifespan)
app.mount("/api", api_app)
app.mount("/", StaticFiles(directory=ROOT / "frontend" / "dist", html=True), name="frontend")
