FROM rust:1-slim-trixie AS build
WORKDIR /src
COPY Cargo.toml Cargo.lock ./
COPY src ./src
RUN cargo build --release --locked

FROM debian:trixie-slim
RUN apt-get update && apt-get install -y --no-install-recommends curl && rm -rf /var/lib/apt/lists/* \
    && useradd --uid 10001 names
COPY --from=build /src/target/release/names-api /usr/local/bin/names-api
USER names
ENV SERVER_PORT=8080
EXPOSE 8080
CMD ["names-api"]
