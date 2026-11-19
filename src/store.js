// Persistencia simple en un archivo JSON (suficiente para ~10.000 compras ágiles).
const fs = require('fs');
const path = require('path');
const { dataFile } = require('./config');

const empty = () => ({
  compras: {}, // código Compra Ágil -> datos normalizados
  ordenes: {}, // código OC -> datos de la OC detectada
  ocInicializado: false,
  proveedor: null, // { rut, codigo, nombre }
  ultimaSyncCompleta: null,
  ultimoCambio: null, // marca para la sincronización incremental
  ultimaSync: null,
  ultimaRevisionOC: null,
  detallesHoy: { fecha: '', n: 0 },
});

let db = empty();
try {
  if (fs.existsSync(dataFile)) {
    const leido = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
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
    fs.mkdirSync(path.dirname(dataFile), { recursive: true });
    const tmp = dataFile + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(db));
    fs.renameSync(tmp, dataFile);
  };
  if (now) {
    if (timer) clearTimeout(timer);
    return write();
  }
  if (!timer) timer = setTimeout(write, 2000);
}

module.exports = { get db() { return db; }, save };
