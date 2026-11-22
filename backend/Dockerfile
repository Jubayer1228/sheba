# Cloud Run API image (SQLite + uploads under /tmp — demo/ephemeral; use Cloud SQL for production persistence)
FROM golang:1.26-bookworm AS builder
RUN apt-get update && apt-get install -y --no-install-recommends gcc libc6-dev && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV GOTOOLCHAIN=auto
COPY go.mod go.sum ./
RUN go mod download
COPY . .
ENV CGO_ENABLED=1 GOOS=linux
RUN go build -trimpath -ldflags="-s -w" -o /sheba ./cmd/server

FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=builder /sheba /app/sheba
RUN mkdir -p /tmp/uploads
ENV GIN_MODE=release \
    PORT=8080 \
    DATABASE_PATH=/tmp/sheba.db \
    UPLOAD_DIR=/tmp/uploads
EXPOSE 8080
CMD ["/app/sheba"]