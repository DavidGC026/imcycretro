#!/usr/bin/env python3
"""Loopback-only fake Apps Script used with a synthetic local bridge fixture."""
import json
import sys
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path

fixture = json.loads(Path(sys.argv[1]).read_text())
assert fixture['synthetic'] is True


class SheetHandler(BaseHTTPRequestHandler):
    def log_message(self, *_args):
        pass

    def do_POST(self):
        size = int(self.headers.get('content-length', 0))
        if size > 2 * 1024 * 1024:
            self.send_error(413)
            return
        payload = json.loads(self.rfile.read(size))
        if payload.pop('token', None) != fixture['sheetToken']:
            self.send_error(403)
            return
        with Path(fixture['sheetCallsFile']).open('a') as output:
            output.write(json.dumps(payload) + '\n')
        success = Path(fixture['modeFile']).read_text().strip() == 'ok'
        self.send_response(200 if success else 502)
        self.send_header('Content-Type', 'application/json')
        self.end_headers()
        self.wfile.write(json.dumps({'ok': success, 'filas': len(payload.get('registros', []))}).encode())


HTTPServer(('127.0.0.1', 4389), SheetHandler).serve_forever()
