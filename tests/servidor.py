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


class Manejador(server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()


if __name__ == '__main__':
    puerto = int(sys.argv[1]) if len(sys.argv) > 1 else 8080
    # Con hilos: un solo hilo reseteaba la conexión de los módulos grandes (three.js, 670 KB) si el navegador abría varias a la vez
    manejador = functools.partial(Manejador, directory=RAIZ)
    print(f'Sirviendo {RAIZ} en http://127.0.0.1:{puerto}/')
    # La cola por defecto es de 5 conexiones: el álbum pide unas 30 imágenes a la vez y el resto se reseteaba
    server.ThreadingHTTPServer.request_queue_size = 128
    server.ThreadingHTTPServer(('127.0.0.1', puerto), manejador).serve_forever()
