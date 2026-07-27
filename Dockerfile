# ==========================================
# STAGE 1: Build Frontend (React + Vite)
# ==========================================
FROM node:18-alpine AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# ==========================================
# STAGE 2: Python Backend & Nginx Server
# ==========================================
FROM python:3.11-slim
WORKDIR /app

# Instalar Nginx, Supervisor y herramientas de sistema
RUN apt-get update && apt-get install -y --no-install-recommends \
    nginx \
    supervisor \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Instalar dependencias backend
COPY backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Copiar código del backend
COPY backend/ ./backend

# Copiar dist del frontend compilado a Nginx
COPY --from=frontend-builder /app/frontend/dist /usr/share/nginx/html

# Configuración Nginx para Proxy de FastAPI y Frontend React
RUN echo 'server { \
    listen 80; \
    server_name _; \
    location / { \
        root /usr/share/nginx/html; \
        index index.html; \
        try_files $uri $uri/ /index.html; \
    } \
    location /api { \
        proxy_pass http://127.0.0.1:8000; \
        proxy_set_header Host $host; \
        proxy_set_header X-Real-IP $remote_addr; \
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for; \
        proxy_set_header X-Forwarded-Proto $scheme; \
    } \
}' > /etc/nginx/sites-available/default

# Configurar Supervisor para correr Nginx y FastAPI juntos
RUN echo '[supervisord] \n\
nodaemon=true \n\
\n\
[program:fastapi] \n\
command=python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 \n\
directory=/app/backend \n\
autostart=true \n\
autorestart=true \n\
\n\
[program:nginx] \n\
command=nginx -g "daemon off;" \n\
autostart=true \n\
autorestart=true \n\
' > /etc/supervisor/conf.d/supervisord.conf

EXPOSE 80

CMD ["/usr/bin/supervisord", "-c", "/etc/supervisor/conf.d/supervisord.conf"]
