#!/bin/bash

# Fix hostname resolution for Erlang node (streamer@server.l)
if ! grep -q "server.l" /etc/hosts 2>/dev/null; then
    echo "127.0.0.1 server.l" >> /etc/hosts
fi

# Log the PORT for debugging
echo "PORT=$PORT"

PORT_TO_USE=${PORT:-8080}

# Start Flussonic in background on port 8888
echo "http 8888;" > /etc/flussonic/flussonic.conf
echo "rtmp 1935;" >> /etc/flussonic/flussonic.conf
echo "pulsedb /var/lib/flussonic;" >> /etc/flussonic/flussonic.conf
echo "session_log /var/lib/flussonic;" >> /etc/flussonic/flussonic.conf
echo "edit_auth admin admin;" >> /etc/flussonic/flussonic.conf
echo "iptv;" >> /etc/flussonic/flussonic.conf

/opt/flussonic/bin/run -noinput &
FLUSSONIC_PID=$!

sleep 3

# Use socat as TCP proxy (more reliable than Python for this use case)
echo "Starting socat proxy: 0.0.0.0:$PORT_TO_USE -> 127.0.0.1:8888"
exec socat TCP-LISTEN:$PORT_TO_USE,fork,reuseaddr TCP:127.0.0.1:8888
