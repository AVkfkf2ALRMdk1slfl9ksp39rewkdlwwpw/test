#!/bin/bash

# Fix hostname resolution for Erlang node (streamer@server.l)
if ! grep -q "server.l" /etc/hosts 2>/dev/null; then
    echo "127.0.0.1 server.l" >> /etc/hosts
fi

echo "PORT=$PORT"

# Start Flussonic on port 8888
echo "http 8888;" > /etc/flussonic/flussonic.conf
echo "rtmp 1935;" >> /etc/flussonic/flussonic.conf
echo "pulsedb /var/lib/flussonic;" >> /etc/flussonic/flussonic.conf
echo "session_log /var/lib/flussonic;" >> /etc/flussonic/flussonic.conf
echo "edit_auth admin admin;" >> /etc/flussonic/flussonic.conf
echo "iptv;" >> /etc/flussonic/flussonic.conf

/opt/flussonic/bin/run -noinput &
sleep 3

# Start socat proxy on PORT (Railway default) AND on common ports as fallback
PORT_TO_USE=${PORT:-8080}
echo "Starting proxy on $PORT_TO_USE -> 127.0.0.1:8888"

# Also start a simple healthcheck endpoint on port 3000 just in case
python3 -c "
from http.server import HTTPServer, BaseHTTPRequestHandler
class H(BaseHTTPRequestHandler):
    def do_GET(self):
        self.send_response(200)
        self.send_header('Content-Type','text/plain')
        self.end_headers()
        self.wfile.write(b'OK')
    def log_message(self, *a): pass
HTTPServer(('0.0.0.0', 3000), H).serve_forever()
" &

# Start socat on PORT
exec socat TCP-LISTEN:$PORT_TO_USE,fork,reuseaddr TCP:127.0.0.1:8888
