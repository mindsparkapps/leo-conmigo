"""Servidor de pruebas: archivos estáticos sin caché del navegador y con los tipos MIME correctos.

El http.server de Python en Windows sirve .js como text/plain y no pone Cache-Control, así que el navegador
reutiliza módulos viejos después de editarlos. Uso: python tests/servidor.py [puerto]
"""
import functools
import mimetypes
import os
import sys
from http import server

mimetypes.add_type('text/javascript', '.js')
mimetypes.add_type('application/manifest+json', '.webmanifest')
mimetypes.add_type('font/woff2', '.woff2')
mimetypes.add_type('image/svg+xml', '.svg')

RAIZ = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))


# «Nube» compartida para probar con DOS orígenes (adulto en localhost, alumno en 127.0.0.1): el navegador no deja que
# se hablen entre sí, así que cada página guarda aquí el estado de su Drive simulado (tests/drive-falso.js) y lo
# vuelve a leer antes de cada petición. GET /__nube/estado lo lee, POST lo guarda y DELETE lo borra.
ESTADO_NUBE = {'datos': b'{}'}


class Manejador(server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()

    def _nube(self):
        return self.path.split('?')[0] == '/__nube/estado'

    def _responder(self, codigo, cuerpo=b''):
        self.send_response(codigo)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(cuerpo)))
        self.end_headers()
        self.wfile.write(cuerpo)

    def do_GET(self):
        if self._nube():
            self._responder(200, ESTADO_NUBE['datos'])
        else:
            super().do_GET()

    def do_POST(self):
        if not self._nube():
            self.send_error(404)
            return
        ESTADO_NUBE['datos'] = self.rfile.read(int(self.headers.get('Content-Length', 0)))
        self._responder(200, b'{}')

    def do_DELETE(self):
        if not self._nube():
            self.send_error(404)
            return
        ESTADO_NUBE['datos'] = b'{}'
        self._responder(200, b'{}')

    def log_message(self, formato, *args):
        if '/__nube/' not in str(args[0] if args else ''):
            super().log_message(formato, *args)


if __name__ == '__main__':
    puerto = int(sys.argv[1]) if len(sys.argv) > 1 else 8080
    # Con hilos: un solo hilo reseteaba la conexión de los módulos grandes (three.js, 670 KB) si el navegador abría varias a la vez
    manejador = functools.partial(Manejador, directory=RAIZ)
    print(f'Sirviendo {RAIZ} en http://127.0.0.1:{puerto}/')
    # La cola por defecto es de 5 conexiones: el álbum pide unas 30 imágenes a la vez y el resto se reseteaba
    server.ThreadingHTTPServer.request_queue_size = 128
    server.ThreadingHTTPServer(('127.0.0.1', puerto), manejador).serve_forever()
