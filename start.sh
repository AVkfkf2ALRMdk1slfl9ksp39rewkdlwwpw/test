#!/bin/bash

# Fix hostname resolution for Erlang node (streamer@server.l)
if ! grep -q "server.l" /etc/hosts 2>/dev/null; then
    echo "127.0.0.1 server.l" >> /etc/hosts
fi

# Flussonic internal HTTP port
FLUSSONIC_PORT=8888
RAILWAY_PORT=${PORT:-8080}

# Install python3 for the proxy (lightweight, no extra packages needed)
if ! command -v python3 &>/dev/null; then
    apt-get update -qq && apt-get install -y -qq python3
fi

# Configure Flussonic to listen on internal port
echo "http $FLUSSONIC_PORT;" > /etc/flussonic/flussonic.conf
echo "rtmp 1935;" >> /etc/flussonic/flussonic.conf
echo "pulsedb /var/lib/flussonic;" >> /etc/flussonic/flussonic.conf
echo "session_log /var/lib/flussonic;" >> /etc/flussonic/flussonic.conf
echo "edit_auth admin admin;" >> /etc/flussonic/flussonic.conf
echo "iptv;" >> /etc/flussonic/flussonic.conf

# Start Flussonic in background
/opt/flussonic/bin/run -noinput &
FLUSSONIC_PID=$!

# Wait for Flussonic to be ready
sleep 3

# Start Python HTTP reverse proxy on Railway's PORT
echo "Starting proxy on port $RAILWAY_PORT -> Flussonic on port $FLUSSONIC_PORT"
exec python3 /app/proxy.py $FLUSSONIC_PORT $RAILWAY_PORT
