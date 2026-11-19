//! The jsctrls demo names API (specs/006-names-api) in Rust, with axum.

use std::collections::BTreeMap;
use std::sync::{Arc, Mutex};
use std::time::Duration;

use axum::body::Bytes;
use axum::extract::{Path, Request, State};
use axum::http::{HeaderValue, Method, StatusCode, header};
use axum::middleware::{self, Next};
use axum::response::{IntoResponse, Response};
use axum::routing::get;
use axum::{Json, Router};
use serde::Serialize;
use serde_json::{Value, json};
use tower_http::cors::CorsLayer;

#[derive(Clone, Serialize)]
pub struct Name {
    id: String,
    name: String,
}

/// Keyed by the numeric id, so a BTreeMap lists in id order for free.
struct Store {
    next_id: u64,
    names: BTreeMap<u64, Name>,
}

#[derive(Clone)]
struct AppState {
    store: Arc<Mutex<Store>>,
    delay: Duration,
}

/// Builds the app with the three seeded names and the given demo delay.
pub fn app(delay_ms: u64) -> Router {
    let mut store = Store {
        next_id: 1,
        names: BTreeMap::new(),
    };
    for name in ["Ada", "Grace", "Katherine"] {
        store.insert(name.to_string());
    }
    let state = AppState {
        store: Arc::new(Mutex::new(store)),
        delay: Duration::from_millis(delay_ms),
    };

    let cors = CorsLayer::new()
        .allow_origin([
            HeaderValue::from_static("http://localhost:5173"),
            HeaderValue::from_static("http://127.0.0.1:5173"),
        ])
        .allow_methods([Method::GET, Method::POST, Method::PATCH, Method::DELETE])
        .allow_headers([header::CONTENT_TYPE]);

    let names = Router::new()
        .route("/api/names", get(list).post(create))
        .route("/api/names/{id}", get(one).patch(update).delete(remove))
        .route_layer(middleware::from_fn_with_state(state.clone(), demo_delay))
        .with_state(state);

    Router::new()
        .route(
            "/actuator/health",
            get(|| async { Json(json!({ "status": "UP" })) }),
        )
        .merge(names)
        .layer(cors)
}

impl Store {
    fn insert(&mut self, name: String) -> Name {
        let id = self.next_id;
        self.next_id += 1;
        let created = Name {
            id: id.to_string(),
            name,
        };
        self.names.insert(id, created.clone());
        created
    }
}

async fn demo_delay(State(state): State<AppState>, request: Request, next: Next) -> Response {
    if !state.delay.is_zero() {
        tokio::time::sleep(state.delay).await;
    }
    next.run(request).await
}

async fn list(State(state): State<AppState>) -> Json<Vec<Name>> {
    Json(
        state
            .store
            .lock()
            .unwrap()
            .names
            .values()
            .cloned()
            .collect(),
    )
}

async fn one(State(state): State<AppState>, Path(id): Path<String>) -> Response {
    let store = state.store.lock().unwrap();
    match key(&id).and_then(|k| store.names.get(&k)) {
        Some(found) => Json(found.clone()).into_response(),
        None => not_found(&id),
    }
}

async fn create(State(state): State<AppState>, body: Bytes) -> Response {
    let name = match read_name(&body) {
        Ok(name) => name,
        Err(detail) => return problem(StatusCode::BAD_REQUEST, detail),
    };
    let created = state.store.lock().unwrap().insert(name);
    let location = format!("/api/names/{}", created.id);
    (
        StatusCode::CREATED,
        [(header::LOCATION, location)],
        Json(created),
    )
        .into_response()
}

async fn update(State(state): State<AppState>, Path(id): Path<String>, body: Bytes) -> Response {
    let mut store = state.store.lock().unwrap();
    let Some(found) = key(&id).and_then(|k| store.names.get_mut(&k)) else {
        return not_found(&id);
    };
    match read_name(&body) {
        Ok(name) => {
            found.name = name;
            Json(found.clone()).into_response()
        }
        Err(detail) => problem(StatusCode::BAD_REQUEST, detail),
    }
}

async fn remove(State(state): State<AppState>, Path(id): Path<String>) -> Response {
    let removed = key(&id).and_then(|k| state.store.lock().unwrap().names.remove(&k));
    match removed {
        Some(_) => StatusCode::NO_CONTENT.into_response(),
        None => not_found(&id),
    }
}

/// The store key for an id, only when the id is written exactly as we write it.
fn key(id: &str) -> Option<u64> {
    let k: u64 = id.parse().ok()?;
    (k.to_string() == id).then_some(k)
}

/// The trimmed name from a JSON body, or the detail for a 400 problem.
fn read_name(body: &[u8]) -> Result<String, &'static str> {
    let value: Value = serde_json::from_slice(body).unwrap_or(Value::Null);
    let raw = value.get("name").and_then(Value::as_str).unwrap_or("");
    if raw.trim().is_empty() {
        return Err("name: must not be blank");
    }
    if raw.chars().count() > 100 {
        return Err("name: size must be between 0 and 100");
    }
    Ok(raw.trim().to_string())
}

/// An RFC 9457 problem detail.
fn problem(status: StatusCode, detail: &str) -> Response {
    let body = json!({
        "type": "about:blank",
        "title": status.canonical_reason().unwrap_or("Error"),
        "status": status.as_u16(),
        "detail": detail,
    });
    (
        status,
        [(header::CONTENT_TYPE, "application/problem+json")],
        body.to_string(),
    )
        .into_response()
}

fn not_found(id: &str) -> Response {
    problem(StatusCode::NOT_FOUND, &format!("Name not found: {id}"))
}
