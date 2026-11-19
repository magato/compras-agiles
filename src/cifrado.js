// Cifrado de los datos, para que en un repositorio público solo los usuarios autorizados
// puedan leerlos. Formato compatible con WebCrypto (el navegador los descifra):
//   AES-256-GCM, texto cifrado = base64( iv[12] | datos | tag[16] )
//   Llave de cada usuario = PBKDF2-SHA256(clave, sal aleatoria, 310.000 iteraciones)
const crypto = require('crypto');

const ITERACIONES = 310000;

function cifrar(llave, datos) {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', llave, iv);
  const buf = Buffer.isBuffer(datos) ? datos : Buffer.from(typeof datos === 'string' ? datos : JSON.stringify(datos));
  const ct = Buffer.concat([c.update(buf), c.final()]);
  return Buffer.concat([iv, ct, c.getAuthTag()]).toString('base64');
}

function descifrar(llave, b64) {
  const raw = Buffer.from(b64, 'base64');
  const iv = raw.subarray(0, 12), tag = raw.subarray(raw.length - 16), ct = raw.subarray(12, raw.length - 16);
  const d = crypto.createDecipheriv('aes-256-gcm', llave, iv);
  d.setAuthTag(tag);
  return Buffer.concat([d.update(ct), d.final()]);
}

// Lee el secret SITE_USUARIOS: una línea por usuario, "usuario:clave"
function leerUsuarios(texto) {
  return String(texto || '').split(/\r?\n/).map((l) => l.trim()).filter(Boolean).map((l) => {
    const i = l.indexOf(':');
    return i > 0 ? { usuario: l.slice(0, i).trim().toLowerCase(), clave: l.slice(i + 1).trim() } : null;
  }).filter((u) => u && u.usuario && u.clave);
}

const idUsuario = (usuario) => crypto.createHash('sha256').update('compras-agiles|' + usuario.toLowerCase()).digest('hex');

// Llave de datos estable mientras no cambien los usuarios/claves (así la sesión
// abierta en el navegador sigue sirviendo entre una actualización y otra)
const llaveDatos = (usuarios) =>
  crypto.createHash('sha256').update('datos|' + usuarios.map((u) => `${u.usuario}:${u.clave}`).sort().join('\n')).digest();

// Para cada usuario, guarda la llave de datos cifrada con una llave derivada de su clave
function llavesUsuarios(usuarios, llave) {
  return usuarios.map((u) => {
    const sal = crypto.randomBytes(16);
    const k = crypto.pbkdf2Sync(u.clave, sal, ITERACIONES, 32, 'sha256');
    return { id: idUsuario(u.usuario), sal: sal.toString('base64'), llave: cifrar(k, llave) };
  });
}

// Llave del estado interno (rama "estado"): derivada del ticket, que es secreto y estable
const llaveEstado = (ticket) => (ticket ? crypto.createHash('sha256').update('estado|' + ticket).digest() : null);

module.exports = { cifrar, descifrar, leerUsuarios, llaveDatos, llavesUsuarios, llaveEstado, ITERACIONES };
