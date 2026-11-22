.PHONY: run-api run-web build-api build-web tidy seed-reset

run-api:
	cd backend && go run ./cmd/server

run-web:
	cd frontend && npm run dev -- --host 127.0.0.1 --port 5173

build-api:
	cd backend && go build -o bin/sheba ./cmd/server

build-web:
	cd frontend && npm run build

tidy:
	cd backend && go mod tidy

seed-reset:
	rm -f backend/sheba.db
	cd backend && go run ./cmd/server
