FROM composer:2 AS deps
WORKDIR /app
COPY composer.json composer.lock ./
RUN composer install --no-dev --no-interaction --optimize-autoloader --ignore-platform-reqs --no-scripts
COPY src ./src
RUN composer dump-autoload --no-dev --optimize

FROM php:8.5-cli
RUN apt-get update && apt-get install -y --no-install-recommends curl && rm -rf /var/lib/apt/lists/* \
    && useradd --uid 10001 names
WORKDIR /app
COPY --from=deps /app/vendor ./vendor
COPY src ./src
COPY public ./public
USER names
ENV SERVER_PORT=8080 NAMES_STORE=/tmp/names.json
EXPOSE 8080
CMD ["sh", "-c", "exec php -S 0.0.0.0:${SERVER_PORT} public/index.php"]
