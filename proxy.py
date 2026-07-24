#!/usr/bin/env python3
"""Simple HTTP reverse proxy for Railway compatibility"""
import http.server
import urllib.request
import urllib.error
import sys
import socket

FLUSSONIC_PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8888
PROXY_PORT = int(sys.argv[2]) if len(sys.argv) > 2 else 8080

class ProxyHandler(http.server.BaseHTTPRequestHandler):
    def do_GET(self):
        self._proxy_request('GET')
    
    def do_POST(self):
        self._proxy_request('POST')
    
    def do_PUT(self):
        self._proxy_request('PUT')
    
    def do_DELETE(self):
        self._proxy_request('DELETE')
    
    def do_HEAD(self):
        self._proxy_request('HEAD')
    
    def do_OPTIONS(self):
        self._proxy_request('OPTIONS')
    
    def _proxy_request(self, method):
        url = f"http://127.0.0.1:{FLUSSONIC_PORT}{self.path}"
        headers = {k: v for k, v in self.headers.items() if k.lower() not in ('host', 'connection')}
        headers['Host'] = f'127.0.0.1:{FLUSSONIC_PORT}'
        
        content_length = int(self.headers.get('Content-Length', 0))
        body = self.rfile.read(content_length) if content_length > 0 else None
        
        try:
            req = urllib.request.Request(url, data=body, method=method, headers=headers)
            resp = urllib.request.urlopen(req, timeout=30)
            self.send_response(resp.status)
            for header, value in resp.getheaders():
                if header.lower() not in ('transfer-encoding', 'connection'):
                    self.send_header(header, value)
            self.end_headers()
            if resp.readable():
                self.wfile.write(resp.read())
        except urllib.error.HTTPError as e:
            self.send_response(e.code)
            for header, value in e.headers.items():
                if header.lower() not in ('transfer-encoding', 'connection'):
                    self.send_header(header, value)
            self.end_headers()
            if e.readable():
                self.wfile.write(e.read())
        except Exception as e:
            self.send_response(502)
            self.send_header('Content-Type', 'text/plain')
            self.end_headers()
            self.wfile.write(f'Bad Gateway: {str(e)}'.encode())
    
    def log_message(self, format, *args):
        pass  # Suppress logs for cleaner output

if __name__ == '__main__':
    server = http.server.HTTPServer(('0.0.0.0', PROXY_PORT), ProxyHandler)
    print(f"Proxy listening on port {PROXY_PORT} -> Flussonic on port {FLUSSONIC_PORT}")
    server.serve_forever()
