#!/bin/bash
# Script de Despliegue Automático para DigitalOcean
set -e

echo "🚀 Iniciando despliegue de CLR BingX Trading Bot..."

# Actualizar e instalar Docker si no existe
if ! command -v docker &> /dev/null; then
    echo "📦 Instalando Docker y Docker Compose..."
    sudo apt-get update
    sudo apt-get install -y docker.io docker-compose
    sudo systemctl enable --now docker
fi

# Construir y levantar contenedores
echo "🔨 Construyendo e iniciando contenedores..."
sudo docker-compose up -d --build

echo "✅ ¡Despliegue completado exitosamente!"
echo "🌐 Accede al Dashboard en la IP de tu Droplet: http://$(curl -s ifconfig.me)"
