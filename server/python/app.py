"""The jsctrls demo names API (specs/006-names-api) in Python, with FastAPI."""

import asyncio
import os
from dataclasses import asdict, dataclass
from threading import Lock

from fastapi import Depends, FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse


@dataclass
class Name:
    id: str
    name: str


class NameStore:
    """In-memory store, seeded with Ada, Grace and Katherine."""

    def __init__(self) -> None:
        self._names: dict[str, Name] = {}
        self._next_id = 1
        self._lock = Lock()
        for name in ("Ada", "Grace", "Katherine"):
            self.create(name)

    def list(self) -> list[Name]:
        with self._lock:
            names = list(self._names.values())
        # Numeric ids sort as numbers, so "10" comes after "9".
        return sorted(names, key=lambda n: (0, int(n.id), "") if n.id.isdigit() else (1, 0, n.id))

    def get(self, id: str) -> Name | None:
        with self._lock:
            return self._names.get(id)

    def create(self, name: str) -> Name:
        with self._lock:
            created = Name(id=str(self._next_id), name=name)
            self._next_id += 1
            self._names[created.id] = created
            return created

    def update(self, id: str, name: str) -> Name | None:
        with self._lock:
            existing = self._names.get(id)
            if existing is not None:
                existing.name = name
            return existing

    def delete(self, id: str) -> bool:
        with self._lock:
            return self._names.pop(id, None) is not None


def problem(status: int, detail: str) -> JSONResponse:
    """An RFC 9457 problem detail."""
    title = {400: "Bad Request", 404: "Not Found"}[status]
    return JSONResponse(
        {"type": "about:blank", "title": title, "status": status, "detail": detail},
        status_code=status,
        media_type="application/problem+json",
    )


def not_found(id: str) -> JSONResponse:
    return problem(404, f"Name not found: {id}")


async def read_name(request: Request) -> str | JSONResponse:
    """Trim and check the body's name. The contract wants 400 problems, not FastAPI's 422."""
    try:
        body = await request.json()
    except ValueError:
        return problem(400, "name: must not be blank")
    raw = body.get("name") if isinstance(body, dict) else None
    if not isinstance(raw, str) or not raw.strip():
        return problem(400, "name: must not be blank")
    if len(raw) > 100:
        return problem(400, "name: size must be between 0 and 100")
    return raw.strip()


def create_app(delay_ms: int = 300) -> FastAPI:
    app = FastAPI(title="jsctrls names API (Python)")
    store = NameStore()

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
        allow_methods=["GET", "POST", "PATCH", "DELETE"],
        allow_headers=["Content-Type"],
    )

    async def demo_delay() -> None:
        if delay_ms > 0:
            await asyncio.sleep(delay_ms / 1000)

    slow = [Depends(demo_delay)]

    @app.get("/actuator/health")
    async def health() -> dict[str, str]:
        return {"status": "UP"}

    @app.get("/api/names", dependencies=slow)
    async def list_names() -> list[dict[str, str]]:
        return [asdict(n) for n in store.list()]

    @app.get("/api/names/{id}", dependencies=slow)
    async def get_name(id: str):
        found = store.get(id)
        return asdict(found) if found else not_found(id)

    @app.post("/api/names", dependencies=slow, status_code=201)
    async def create_name(request: Request, response: Response):
        name = await read_name(request)
        if isinstance(name, JSONResponse):
            return name
        created = store.create(name)
        response.headers["Location"] = f"/api/names/{created.id}"
        return asdict(created)

    @app.patch("/api/names/{id}", dependencies=slow)
    async def update_name(id: str, request: Request):
        if store.get(id) is None:
            return not_found(id)
        name = await read_name(request)
        if isinstance(name, JSONResponse):
            return name
        updated = store.update(id, name)
        return asdict(updated) if updated else not_found(id)

    @app.delete("/api/names/{id}", dependencies=slow)
    async def delete_name(id: str):
        return Response(status_code=204) if store.delete(id) else not_found(id)

    return app


app = create_app(int(os.environ.get("DEMO_DELAY_MS", "300")))
