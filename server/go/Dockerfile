FROM golang:1.24-alpine AS build
WORKDIR /src
COPY go.mod ./
COPY *.go ./
RUN CGO_ENABLED=0 go build -o /names-api .

FROM alpine:3.21
RUN apk add --no-cache curl
COPY --from=build /names-api /usr/local/bin/names-api
EXPOSE 8080
ENTRYPOINT ["names-api"]
