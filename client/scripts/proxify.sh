#!/usr/bin/env bash

set -e

# ---------------------------------------
# Parameter handling
# ---------------------------------------

if [ "$#" -lt 4 ]; then
  echo "Usage:"
  echo "  $0 <device.crt> <device.key> <https_ip_or_domain> [port] <http_backend_ip_or_domain>"
  echo ""
  echo "Examples:"
  echo "  Default port 443:"
  echo "    $0 device.crt device.key 192.168.1.10 192.168.1.50"
  echo ""
  echo "  Custom port:"
  echo "    $0 device.crt device.key 192.168.1.10 8443 192.168.1.50"
  exit 1
fi

CRT_PATH="$1"
KEY_PATH="$2"
HTTPS_SOURCE="$3"

# Detect optional port
if [[ "$4" =~ ^[0-9]+$ ]]; then
  PORT="$4"
  HTTP_BACKEND="$5"
else
  PORT=443
  HTTP_BACKEND="$4"
fi

if [ -z "$HTTP_BACKEND" ]; then
  echo "ERROR: Missing backend HTTP destination."
  exit 1
fi

# ---------------------------------------
# Validate certificate files
# ---------------------------------------

if [ ! -f "$CRT_PATH" ]; then
  echo "ERROR: Certificate file not found: $CRT_PATH"
  exit 1
fi

if [ ! -f "$KEY_PATH" ]; then
  echo "ERROR: Key file not found: $KEY_PATH"
  exit 1
fi

# ---------------------------------------
# Check if port is already in use
# ---------------------------------------

CONTAINER_NAME="device_https_proxy"  # container name
IMAGE_NAME="nginx:stable"            # nginx image

# Check if any process is listening on the port
PORT_USED=$(sudo ss -tulpn | grep ":$PORT " || true)

if [ -n "$PORT_USED" ]; then
    # Port is in use — check if it's our container
    CONTAINER_ON_PORT=$(docker ps --filter "name=$CONTAINER_NAME" --format "{{.Names}} {{.Ports}}" \
        | grep ":$PORT->443" || true)

    if [ -n "$CONTAINER_ON_PORT" ]; then
        echo "Port $PORT is already used by container $CONTAINER_NAME — continuing."
    else
        echo "ERROR: Port $PORT is already in use by another process:"
        echo "$PORT_USED"
        exit 1
    fi
else
    echo "Port $PORT is free"
fi

# ---------------------------------------
# Directory setup
# ---------------------------------------

BASE_DIR="$HOME/reverse-proxy"
CONF_DIR="$BASE_DIR/nginx/conf"
CERT_DIR="$BASE_DIR/nginx/certs"

mkdir -p "$CONF_DIR"
mkdir -p "$CERT_DIR"

# ---------------------------------------
# Copy certificates
# ---------------------------------------

cp "$CRT_PATH" "$CERT_DIR/device.crt"
cp "$KEY_PATH" "$CERT_DIR/device.key"

chmod 644 "$CERT_DIR/device.crt"
chmod 600 "$CERT_DIR/device.key"

# ---------------------------------------
# Create nginx config
# Compatible with IP-based certificates
# ---------------------------------------

cat > "$CONF_DIR/device.conf" <<EOF
server {
    listen 443 ssl;
    server_name $HTTPS_SOURCE;

    ssl_certificate /etc/nginx/certs/device.crt;
    ssl_certificate_key /etc/nginx/certs/device.key;

    ssl_protocols TLSv1.2 TLSv1.3;

    location / {
        proxy_pass http://$HTTP_BACKEND;

        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;

        # Remove backend framing protection
        #proxy_hide_header X-Frame-Options;
        #proxy_hide_header Content-Security-Policy;
        
        # Allow HA to embed
        #add_header X-Frame-Options "ALLOWALL";
        
        # Do NOT alter X-Frame-Options or CSP — allow embedding
        proxy_pass_request_headers on;
    }
}
EOF

# ---------------------------------------
# Create docker-compose.yml
# ---------------------------------------

cat > "$BASE_DIR/docker-compose.yml" <<EOF
services:
  nginx-proxy:
    image: $IMAGE_NAME
    container_name: $CONTAINER_NAME
    restart: unless-stopped
    ports:
      - "$PORT:443"
    volumes:
      - ./nginx/conf:/etc/nginx/conf.d:ro
      - ./nginx/certs:/etc/nginx/certs:ro
EOF

# ---------------------------------------
# Start container
# ---------------------------------------

cd "$BASE_DIR"
docker compose up -d --force-recreate

# ---------------------------------------
# Final output
# ---------------------------------------

if [ "$PORT" -eq 443 ]; then
  ACCESS_URL="https://$HTTPS_SOURCE"
else
  ACCESS_URL="https://$HTTPS_SOURCE:$PORT"
fi

echo ""
echo "==============================================="
echo "Reverse proxy successfully started"
echo ""
echo "Access your device at:"
echo "  $ACCESS_URL"
echo ""
echo "Notes:"
echo " - Certificate must contain IP SAN matching $HTTPS_SOURCE"
echo " - Your internal CA must be trusted on client devices"
echo " - Backend device must be reachable via http://$HTTP_BACKEND"
echo "==============================================="
