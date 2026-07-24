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

# Start Python HTTP proxy on PORT -> Flussonic on 8888
PORT_TO_USE=${PORT:-8080}
echo "Starting HTTP proxy on $PORT_TO_USE -> 8888"

python3 -c "
import socket, threading, sys, time

def handle_connection(client_socket, addr):
    # Connect to Flussonic
    try:
        server_socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        server_socket.connect(('127.0.0.1', 8888))
    except Exception as e:
        print(f'Failed to connect to Flussonic: {e}', flush=True)
        client_socket.close()
        return
    
    # Bidirectional forwarding
    def forward(src, dst):
        try:
            while True:
                data = src.recv(4096)
                if not data:
                    break
                dst.sendall(data)
        except:
            pass
        finally:
            try: dst.shutdown(socket.SHUT_WR)
            except: pass
    
    t1 = threading.Thread(target=forward, args=(client_socket, server_socket))
    t2 = threading.Thread(target=forward, args=(server_socket, client_socket))
    t1.daemon = True
    t2.daemon = True
    t1.start()
    t2.start()
    t1.join()
    t2.join()
    server_socket.close()
    client_socket.close()

server = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
server.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
server.bind(('0.0.0.0', $PORT_TO_USE))
server.listen(100)
print(f'Proxy listening on 0.0.0.0:$PORT_TO_USE', flush=True)

while True:
    client_socket, addr = server.accept()
    t = threading.Thread(target=handle_connection, args=(client_socket, addr))
    t.daemon = True
    t.start()
" &

sleep 2
echo "Proxy started, waiting..."
wait
