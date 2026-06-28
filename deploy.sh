#!/bin/bash
# GNote deployment helper script

echo "=== Starting GNote Deploy ==="

# Check if Docker is installed
if ! [ -x "$(command -v docker)" ]; then
  echo "Error: docker is not installed. Please install docker first." >&2
  exit 1
fi

# Check if docker-compose or docker compose is available
DOCKER_COMPOSE="docker compose"
if ! docker compose version &> /dev/null; then
  if command -v docker-compose &> /dev/null; then
    DOCKER_COMPOSE="docker-compose"
  else
    echo "Error: docker compose is not installed. Please install docker-compose first." >&2
    exit 1
  fi
fi

echo "Building docker images..."
$DOCKER_COMPOSE build

echo "Starting containers in detached mode..."
$DOCKER_COMPOSE up -d

echo "=== Deployment finished successfully! ==="
echo "GNote is now running on http://localhost:3001"
echo "Make sure to configure your reverse proxy (e.g. Nginx, Caddy) for HTTPS access."
