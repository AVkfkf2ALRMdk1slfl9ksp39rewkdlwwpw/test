#!/bin/bash

# Fix hostname resolution for Erlang node (streamer@server.l)
if ! grep -q "server.l" /etc/hosts 2>/dev/null; then
    echo "127.0.0.1 server.l" >> /etc/hosts
fi

echo "PORT=$PORT"

# Start Flussonic on port 8888 in background
echo "http 8888;" > /etc/flussonic/flussonic.conf
echo "rtmp 1935;" >> /etc/flussonic/flussonic.conf
echo "pulsedb /var/lib/flussonic;" >> /etc/flussonic/flussonic.conf
echo "session_log /var/lib/flussonic;" >> /etc/flussonic/flussonic.conf
echo "edit_auth admin admin;" >> /etc/flussonic/flussonic.conf
echo "iptv;" >> /etc/flussonic/flussonic.conf

/opt/flussonic/bin/run -noinput &
sleep 5

echo "Flussonic started on 8888"

# Start socat TCP proxy on PORT (8080) -> Flussonic (8888)
PORT_TO_USE=${PORT:-8080}
echo "Starting TCP proxy: 0.0.0.0:$PORT_TO_USE -> 127.0.0.1:8888"
exec socat TCP-LISTEN:$PORT_TO_USE,fork,reuseaddr,range=127.0.0.1/32 TCP:127.0.0.1:8888
