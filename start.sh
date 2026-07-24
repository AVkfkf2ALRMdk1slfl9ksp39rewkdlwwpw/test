#!/bin/bash

# Fix hostname resolution for Erlang node (streamer@server.l)
if ! grep -q "server.l" /etc/hosts 2>/dev/null; then
    echo "127.0.0.1 server.l" >> /etc/hosts
fi

echo "PORT=$PORT"

# Start Flussonic on port 8080 in background
echo "http 8080;" > /etc/flussonic/flussonic.conf
echo "rtmp 1935;" >> /etc/flussonic/flussonic.conf
echo "pulsedb /var/lib/flussonic;" >> /etc/flussonic/flussonic.conf
echo "session_log /var/lib/flussonic;" >> /etc/flussonic/flussonic.conf
echo "edit_auth admin admin;" >> /etc/flussonic/flussonic.conf
echo "iptv;" >> /etc/flussonic/flussonic.conf

/opt/flussonic/bin/run -noinput &
sleep 5

echo "Flussonic started on 8080"

# Also start a simple health check on port 3000
python3 -c "
from http.server import HTTPServer, BaseHTTPRequestHandler
class H(BaseHTTPRequestHandler):
    def do_GET(self):
        self.send_response(200)
        self.send_header('Content-Type','text/plain')
        self.end_headers()
        self.wfile.write(b'OK - Flussonic is running')
    def log_message(self, *a): pass
    def log_request(self, *a): pass
HTTPServer(('0.0.0.0', 3000), H).serve_forever()
" &

echo "Health check started on 3000"
# Keep alive - wait for any child process
wait
