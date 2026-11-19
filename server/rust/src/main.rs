use std::env;

fn env_or<T: std::str::FromStr>(name: &str, default: T) -> T {
    env::var(name)
        .ok()
        .and_then(|v| v.parse().ok())
        .unwrap_or(default)
}

#[tokio::main]
async fn main() {
    let port: u16 = env_or("SERVER_PORT", 8081);
    let delay_ms: u64 = env_or("DEMO_DELAY_MS", 300);
    let listener = tokio::net::TcpListener::bind(("0.0.0.0", port))
        .await
        .expect("bind");
    println!("names API (rust) on http://127.0.0.1:{port}");
    axum::serve(listener, names_api::app(delay_ms))
        .await
        .expect("serve");
}
