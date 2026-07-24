#!/bin/bash

# Fix hostname resolution for Erlang node (streamer@server.l)
# This must be done at runtime since /etc/hosts is read-only during build on Railway
if ! grep -q "server.l" /etc/hosts 2>/dev/null; then
    echo "127.0.0.1 server.l" >> /etc/hosts
fi

PORT_TO_USE=${PORT:-80}
echo "http $PORT_TO_USE;" > /etc/flussonic/flussonic.conf
echo "rtmp 1935;" >> /etc/flussonic/flussonic.conf
echo "pulsedb /var/lib/flussonic;" >> /etc/flussonic/flussonic.conf
echo "session_log /var/lib/flussonic;" >> /etc/flussonic/flussonic.conf
echo "edit_auth admin admin;" >> /etc/flussonic/flussonic.conf
echo "iptv;" >> /etc/flussonic/flussonic.conf

# Run Flussonic with -noinput to prevent interactive console
exec /opt/flussonic/bin/run -noinput
