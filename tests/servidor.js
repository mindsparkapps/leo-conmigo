// Servidor de pruebas en Node (alternativa a tests/servidor.py): estáticos sin caché y con los tipos MIME correctos, más la
// «nube» compartida de /__nube/estado para probar con dos orígenes (ver tests/navegador/simular-aulas.js).
//
// Úsalo cuando necesites el service worker: el servidor de Python resetea conexiones cuando el precaché pide ~1200 archivos
// a la vez y el worker nunca llega a instalarse. Uso: node tests/servidor.js [puerto]
const http = require('http');
const fs = require('fs');
const path = require('path');

const RAIZ = path.resolve(__dirname, '..');
const PUERTO = Number(process.argv[2] || 8080);
const MIME = {
  '.js': 'text/javascript', '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.json': 'application/json',
  '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.woff2': 'font/woff2', '.avif': 'image/avif', '.webp': 'image/webp',
};
let nube = '{}';

http.createServer((req, res) => {
  const url = decodeURIComponent(req.url.split('?')[0]);
  if (url === '/__nube/estado') {
    const cabecera = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' };
    if (req.method === 'GET') { res.writeHead(200, cabecera); res.end(nube); return; }
    if (req.method === 'DELETE') { nube = '{}'; res.writeHead(200, cabecera); res.end('{}'); return; }
    const partes = [];
    req.on('data', (c) => partes.push(c));
    req.on('end', () => { nube = Buffer.concat(partes).toString(); res.writeHead(200, cabecera); res.end('{}'); });
    return;
  }
  let ruta = path.join(RAIZ, url);
  if (!ruta.startsWith(RAIZ)) { res.writeHead(403); res.end(); return; }
  if (fs.existsSync(ruta) && fs.statSync(ruta).isDirectory()) ruta = path.join(ruta, 'index.html');
  fs.readFile(ruta, (error, datos) => {
    if (error) { res.writeHead(404); res.end('no existe'); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(ruta)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(datos);
  });
}).listen(PUERTO, '127.0.0.1', () => console.log(`Sirviendo ${RAIZ} en http://127.0.0.1:${PUERTO}/`));
