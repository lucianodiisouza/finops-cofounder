# Etapa 1: build do frontend
FROM node:24-alpine AS frontend-build
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# Etapa 2: build do backend
FROM golang:1-alpine AS backend-build
WORKDIR /app/backend
COPY backend/go.mod backend/go.sum ./
RUN go mod download
COPY backend/ ./
RUN CGO_ENABLED=0 go build -o /server ./cmd/server

# Etapa 3: runtime — binário e arquivos do frontend lado a lado sob o WORKDIR
FROM alpine:3
RUN apk add --no-cache ca-certificates
WORKDIR /app
COPY --from=backend-build /server ./server
COPY --from=frontend-build /app/frontend/build/client ./frontend/dist
EXPOSE 80
ENV PORT=80
CMD ["./server"]
