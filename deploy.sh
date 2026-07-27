#!/bin/bash
# Script de Despliegue Automático para DigitalOcean
set -e

echo "🚀 Iniciando despliegue de CLR BingX Trading Bot..."

# Actualizar e instalar Docker si no existe
if ! command -v docker &> /dev/null; then
    echo "📦 Instalando Docker..."
    sudo apt-get update
    sudo apt-get install -y docker.io
    sudo systemctl enable --now docker
fi

echo "📦 Instalando docker-compose v2 (moderno)..."
sudo curl -L "https://github.com/docker/compose/releases/download/v2.24.5/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose
sudo ln -sf /usr/local/bin/docker-compose /usr/bin/docker-compose

# Crear archivo de paginación (Swap) si no existe (evita errores de falta de memoria al compilar el Frontend)
if [ ! -f /swapfile ]; then
    echo "💾 Creando archivo Swap de 1GB para evitar errores de memoria (SIGKILL)..."
    sudo fallocate -l 1G /swapfile
    sudo chmod 600 /swapfile
    sudo mkswap /swapfile
    sudo swapon /swapfile
    echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
fi

# Construir y levantar contenedores
echo "🔨 Construyendo e iniciando contenedores..."
sudo docker-compose up -d --build

echo "✅ ¡Despliegue completado exitosamente!"
echo "🌐 Accede al Dashboard en la IP de tu Droplet: http://$(curl -s ifconfig.me)"
