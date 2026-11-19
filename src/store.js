// Persistencia en un archivo. Si hay ticket, el archivo se guarda CIFRADO (db.enc),
// porque se respalda en la rama "estado" de un repositorio público.
const fs = require('fs');
const path = require('path');
const cfg = require('./config');
const { cifrar, descifrar, llaveEstado } = require('./cifrado');

const llave = llaveEstado(cfg.mp.ticket);
const archivoPlano = cfg.dataFile;
const archivoCifrado = cfg.dataFile.replace(/\.json$/, '') + '.enc';

const empty = () => ({
  compras: {}, // código Compra Ágil -> datos normalizados
  ordenes: {}, // código OC -> datos de la orden de compra
  ocInicializado: false,
  historialOC: { hasta: null }, // día más antiguo ya descargado del historial (AAAA-MM-DD)
  proveedor: null, // { rut, codigo, nombre }
  ultimaSyncCompleta: null,
  ultimoCambio: null, // marca para la sincronización incremental
  ultimaSync: null,
  ultimaRevisionOC: null,
  detallesHoy: { fecha: '', n: 0 },
});

let db = empty();
try {
  let leido = null;
  if (llave && fs.existsSync(archivoCifrado)) {
    try { leido = JSON.parse(descifrar(llave, fs.readFileSync(archivoCifrado, 'utf8')).toString('utf8')); }
    catch { console.warn('[store] El estado cifrado no se pudo abrir (¿cambió el ticket?). Se parte de cero.'); }
  } else if (fs.existsSync(archivoPlano)) {
    leido = JSON.parse(fs.readFileSync(archivoPlano, 'utf8')); // versión anterior, sin cifrar
  }
  if (leido) {
    delete leido.licitaciones; // versión anterior del sistema
    db = { ...empty(), ...leido };
  }
} catch (e) {
  console.error('[store] No se pudo leer la base, se parte vacía:', e.message);
}

let timer = null;
function save(now = false) {
  const write = () => {
    timer = null;
    fs.mkdirSync(path.dirname(archivoPlano), { recursive: true });
    const destino = llave ? archivoCifrado : archivoPlano;
    const tmp = destino + '.tmp';
    fs.writeFileSync(tmp, llave ? cifrar(llave, db) : JSON.stringify(db));
    fs.renameSync(tmp, destino);
    if (llave && fs.existsSync(archivoPlano)) fs.rmSync(archivoPlano); // no dejar copias sin cifrar
  };
  if (now) {
    if (timer) clearTimeout(timer);
    return write();
  }
  if (!timer) timer = setTimeout(write, 2000);
}

module.exports = { get db() { return db; }, save, archivoCifrado };
