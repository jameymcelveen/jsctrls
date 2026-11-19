use axum::Router;
use axum::body::Body;
use axum::http::{Request, StatusCode, header};
use http_body_util::BodyExt;
use serde_json::{Value, json};
use tower::ServiceExt;

async fn call(
    app: &Router,
    method: &str,
    uri: &str,
    body: Option<&str>,
) -> (StatusCode, Value, Option<String>, String) {
    let request = Request::builder()
        .method(method)
        .uri(uri)
        .header(header::CONTENT_TYPE, "application/json")
        .body(
            body.map(|b| Body::from(b.to_string()))
                .unwrap_or_else(Body::empty),
        )
        .unwrap();
    let response = app.clone().oneshot(request).await.unwrap();
    let status = response.status();
    let location = response
        .headers()
        .get(header::LOCATION)
        .map(|v| v.to_str().unwrap().to_string());
    let kind = response
        .headers()
        .get(header::CONTENT_TYPE)
        .map(|v| v.to_str().unwrap().to_string())
        .unwrap_or_default();
    let bytes = response.into_body().collect().await.unwrap().to_bytes();
    let json = serde_json::from_slice(&bytes).unwrap_or(Value::Null);
    (status, json, location, kind)
}

#[tokio::test]
async fn lists_the_seeded_names_in_id_order() {
    let (status, body, _, _) = call(&names_api::app(0), "GET", "/api/names", None).await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(
        body,
        json!([{"id":"1","name":"Ada"},{"id":"2","name":"Grace"},{"id":"3","name":"Katherine"}])
    );
}

#[tokio::test]
async fn creates_a_trimmed_name_with_a_location() {
    let (status, body, location, _) = call(
        &names_api::app(0),
        "POST",
        "/api/names",
        Some(r#"{"name":"  Iris  "}"#),
    )
    .await;
    assert_eq!(status, StatusCode::CREATED);
    assert_eq!(location.as_deref(), Some("/api/names/4"));
    assert_eq!(body, json!({"id":"4","name":"Iris"}));
}

#[tokio::test]
async fn invalid_names_are_400_problems() {
    let app = names_api::app(0);
    let too_long = format!(r#"{{"name":"{}"}}"#, "a".repeat(101));
    for body in [
        r#"{"name":"   "}"#,
        "{}",
        "not json",
        r#"{"name":7}"#,
        too_long.as_str(),
    ] {
        let (status, json, _, kind) = call(&app, "POST", "/api/names", Some(body)).await;
        assert_eq!(status, StatusCode::BAD_REQUEST, "{body}");
        assert!(kind.starts_with("application/problem+json"));
        assert_eq!(json["title"], "Bad Request");
    }
}

#[tokio::test]
async fn missing_ids_are_404_problems() {
    let app = names_api::app(0);
    for method in ["GET", "PATCH", "DELETE"] {
        let (status, json, _, _) = call(
            &app,
            method,
            "/api/names/missing",
            Some(r#"{"name":"Ada"}"#),
        )
        .await;
        assert_eq!(status, StatusCode::NOT_FOUND, "{method}");
        assert_eq!(json["detail"], "Name not found: missing");
    }
}

#[tokio::test]
async fn ids_sort_numerically() {
    let app = names_api::app(0);
    for _ in 0..7 {
        call(&app, "POST", "/api/names", Some(r#"{"name":"x"}"#)).await;
    }
    let (_, body, _, _) = call(&app, "GET", "/api/names", None).await;
    assert_eq!(body.as_array().unwrap().last().unwrap()["id"], "10");
}

#[tokio::test]
async fn patch_then_delete() {
    let app = names_api::app(0);
    let (status, body, _, _) =
        call(&app, "PATCH", "/api/names/2", Some(r#"{"name":"Grace H"}"#)).await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(body["name"], "Grace H");
    let (status, _, _, _) = call(&app, "DELETE", "/api/names/2", None).await;
    assert_eq!(status, StatusCode::NO_CONTENT);
    let (status, _, _, _) = call(&app, "GET", "/api/names/2", None).await;
    assert_eq!(status, StatusCode::NOT_FOUND);
}
