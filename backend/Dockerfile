# Stage 1 : Build
FROM golang:1.26-alpine AS builder

WORKDIR /app

COPY go.mod go.sum ./
RUN go mod download

COPY . .

# Build static linux binary with no external dependencies
RUN CGO_ENABLED=0 GOOS=linux go build -o app .

# Stage 2 : Run
FROM alpine:latest

WORKDIR /app

# copy only binary
COPY --from=builder /app/app .

EXPOSE 8080

# run binary
ENTRYPOINT ["./app"]