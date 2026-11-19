// Sirve la carpeta public/ en http://localhost:8080 para ver el sitio en tu computador.
const http = require('http');
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..', 'public');
const tipos = { '.html': 'text/html; charset=utf-8', '.json': 'application/json', '.js': 'text/javascript', '.css': 'text/css' };

http.createServer((req, res) => {
  const ruta = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  let f = path.join(root, ruta.endsWith('/') ? ruta + 'index.html' : ruta);
  if (!f.startsWith(root) || !fs.existsSync(f)) { res.writeHead(404); return res.end('No encontrado'); }
  res.writeHead(200, { 'Content-Type': tipos[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
}).listen(8080, () => console.log('Sitio en http://localhost:8080'));
