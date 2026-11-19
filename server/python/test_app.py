import pytest
from fastapi.testclient import TestClient

from app import create_app


@pytest.fixture
def client() -> TestClient:
    return TestClient(create_app(delay_ms=0))


def test_lists_the_seeded_names_in_id_order(client: TestClient) -> None:
    response = client.get("/api/names")
    assert response.status_code == 200
    assert response.json() == [
        {"id": "1", "name": "Ada"},
        {"id": "2", "name": "Grace"},
        {"id": "3", "name": "Katherine"},
    ]


def test_creates_a_trimmed_name_with_a_location(client: TestClient) -> None:
    response = client.post("/api/names", json={"name": "  Iris  "})
    assert response.status_code == 201
    assert response.headers["location"] == "/api/names/4"
    assert response.json() == {"id": "4", "name": "Iris"}


@pytest.mark.parametrize("body", [{"name": "   "}, {}, {"name": "a" * 101}, {"name": 7}])
def test_invalid_names_are_400_problems(client: TestClient, body: dict) -> None:
    response = client.post("/api/names", json=body)
    assert response.status_code == 400
    assert response.headers["content-type"].startswith("application/problem+json")
    assert response.json()["title"] == "Bad Request"


def test_non_json_is_a_400_problem(client: TestClient) -> None:
    response = client.post("/api/names", content=b"not json", headers={"Content-Type": "application/json"})
    assert response.status_code == 400


@pytest.mark.parametrize("method", ["GET", "PATCH", "DELETE"])
def test_missing_ids_are_404_problems(client: TestClient, method: str) -> None:
    response = client.request(method, "/api/names/missing", json={"name": "Ada"})
    assert response.status_code == 404
    assert response.json()["detail"] == "Name not found: missing"


def test_ids_sort_numerically(client: TestClient) -> None:
    for _ in range(7):
        client.post("/api/names", json={"name": "x"})
    assert client.get("/api/names").json()[-1]["id"] == "10"
