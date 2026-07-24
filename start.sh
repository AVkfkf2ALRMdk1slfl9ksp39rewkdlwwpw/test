#!/bin/bash

# Fix hostname resolution for Erlang node (streamer@server.l)
if ! grep -q "server.l" /etc/hosts 2>/dev/null; then
    echo "127.0.0.1 server.l" >> /etc/hosts
fi

echo "PORT=$PORT"

# Flussonic internal port (NOT exposed to Railway proxy)
FLUSSONIC_PORT=9999

echo "http $FLUSSONIC_PORT;" > /etc/flussonic/flussonic.conf
echo "rtmp 1935;" >> /etc/flussonic/flussonic.conf
echo "pulsedb /var/lib/flussonic;" >> /etc/flussonic/flussonic.conf
echo "session_log /var/lib/flussonic;" >> /etc/flussonic/flussonic.conf
echo "edit_auth admin admin;" >> /etc/flussonic/flussonic.conf
echo "iptv;" >> /etc/flussonic/flussonic.conf

# Start Flussonic in background
/opt/flussonic/bin/run -noinput &
sleep 3

# Start socat proxy on Railway's PORT (8080)
PORT_TO_USE=${PORT:-8080}
echo "Starting socat proxy on $PORT_TO_USE -> 127.0.0.1:$FLUSSONIC_PORT"
socat TCP-LISTEN:$PORT_TO_USE,fork,reuseaddr TCP:127.0.0.1:$FLUSSONIC_PORT &

# Also start on port 80 as Railway might use that
socat TCP-LISTEN:80,fork,reuseaddr TCP:127.0.0.1:$FLUSSONIC_PORT &

# Keep alive
wait
