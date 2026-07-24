#!/bin/bash

# Fix hostname resolution for Erlang node (streamer@server.l)
if ! grep -q "server.l" /etc/hosts 2>/dev/null; then
    echo "127.0.0.1 server.l" >> /etc/hosts
fi

echo "PORT=$PORT"

# Flussonic internal port
echo "http 8888;" > /etc/flussonic/flussonic.conf
echo "rtmp 1935;" >> /etc/flussonic/flussonic.conf
echo "pulsedb /var/lib/flussonic;" >> /etc/flussonic/flussonic.conf
echo "session_log /var/lib/flussonic;" >> /etc/flussonic/flussonic.conf
echo "edit_auth admin admin;" >> /etc/flussonic/flussonic.conf
echo "iptv;" >> /etc/flussonic/flussonic.conf

# Start Flussonic in background
/opt/flussonic/bin/run -noinput &
sleep 3

# Start proxies on multiple ports to figure out which one Railway uses
PORT_TO_USE=${PORT:-8080}
echo "Starting socat proxy on $PORT_TO_USE -> 127.0.0.1:8888"

# Start socat on PORT
socat TCP-LISTEN:$PORT_TO_USE,fork,reuseaddr TCP:127.0.0.1:8888 &

# Also start on common Railway ports as fallback
socat TCP-LISTEN:3000,fork,reuseaddr TCP:127.0.0.1:8888 &
socat TCP-LISTEN:80,fork,reuseaddr TCP:127.0.0.1:8888 &

# Keep the main process alive
wait
