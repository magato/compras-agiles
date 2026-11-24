// Genera los archivos que publica GitHub Pages (public/data/*). Todo va CIFRADO:
//   acceso.json      → lo único público: permite que cada usuario abra los datos con su clave
//   compras.enc      → Compras Ágiles abiertas
//   ordenes.enc      → órdenes de compra de tu empresa
//   estado.enc       → estado del sistema
//   detalle/X.enc    → detalle de cada Compra Ágil (descripción, productos, entrega)
//   disparo.enc      → permiso para que el botón "Actualizar ahora" lance la actualización
// Si no hay usuarios configurados (secret SITE_USUARIOS) no se publica ningún dato.
const fs = require('fs');
const path = require('path');
const cfg = require('./config');
const store = require('./store');
const api = require('./mp');
const { estado: estadoSync } = require('./sync');
const { crearFiltro } = require('./exclusiones');
const { cifrar, llaveDatos, llavesUsuarios, ITERACIONES } = require('./cifrado');

const archivo = (codigo) => codigo.replace(/[^A-Za-z0-9-]/g, '_') + '.enc';

function publicar() {
  const db = store.db;
  const dir = path.join(cfg.publicDir, 'data');
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(path.join(dir, 'detalle'), { recursive: true });

  if (!cfg.usuarios.length) {
    fs.writeFileSync(path.join(dir, 'acceso.json'), JSON.stringify({ sinUsuarios: true }));
    return { compras: 0, ordenes: 0, sinUsuarios: true };
  }
  const llave = llaveDatos(cfg.usuarios);
  const escribir = (nombre, datos) => fs.writeFileSync(path.join(dir, nombre), cifrar(llave, datos));

  const ahora = new Date().toLocaleString('sv-SE', { timeZone: 'America/Santiago' }).replace(' ', 'T');
  const items = [];
  const filtro = crearFiltro(cfg.excluirPalabras);
  const marcadas = { total: 0, porPalabra: {} };
  for (const c of Object.values(db.compras)) {
    if (c.fechaCierre && c.fechaCierre < ahora) continue;
    const d = c.detalle;
    // Palabra vetada encontrada (el botón del sitio oculta estas compras)
    const vetada = filtro.excluye(c);
    if (vetada) { marcadas.total++; marcadas.porPalabra[vetada] = (marcadas.porPalabra[vetada] || 0) + 1; }
    items.push({
      codigo: c.codigo, nombre: c.nombre, organismo: c.organismo, unidad: c.unidad,
      regionId: c.regionId, region: c.region, montoCLP: c.montoCLP,
      fechaPublicacion: c.fechaPublicacion, fechaCierre: c.fechaCierre,
      sectores: c.sectores, convocatoria: c.convocatoria, documentos: c.documentos, url: c.url,
      texto: d ? `${d.descripcion.slice(0, 300)} ${d.productos.map((p) => p.nombre).join(' ')}`.trim() : '',
      det: !!d,
      ...(vetada ? { vetada } : {}),
    });
    if (d) escribir(path.join('detalle', archivo(c.codigo)), d);
  }
  const generado = new Date().toISOString();
  escribir('compras.enc', { generado, palabrasVetadas: filtro.palabras, items });

  const ordenes = Object.values(db.ordenes).filter((o) => o.codigo);
  escribir('ordenes.enc', { generado, proveedor: db.proveedor, historial: db.historialOC, items: ordenes });

  escribir('estado.enc', {
    generado,
    compras: items.length,
    conDetalle: items.filter((i) => i.det).length,
    ultimaSync: db.ultimaSync,
    ultimaSyncCompleta: db.ultimaSyncCompleta,
    mensajeSync: estadoSync.mensaje,
    ocActivo: !!(db.proveedor || cfg.mp.codigoProveedor),
    proveedor: db.proveedor,
    ordenes: ordenes.length,
    historialOC: db.historialOC,
    diasHistorialOC: cfg.diasHistorialOC,
    ultimaRevisionOC: db.ultimaRevisionOC,
    errorOC: db.errorOC || null,
    ocSoloCompraAgil: cfg.ocSoloCompraAgil,
    canales: {
      email: !!(cfg.mail.host && cfg.mail.user && cfg.mail.to.length),
      whatsapp: cfg.callmebot.length > 0,
      telegram: !!(cfg.telegram.token && cfg.telegram.chats.length),
    },
    llamadasApiEjecucion: api.llamadasHoy(),
    // Monitor de consumo: consultas por día (hora de Chile), últimos 30 días
    limiteDiario: cfg.limiteDiario,
    consumo: Object.entries(db.consumo || {}).sort(([a], [b]) => a.localeCompare(b)).slice(-30).map(([dia, c]) => ({ dia, ...c })),
    detallesHoy: db.detallesHoy.n,
  });

  // Permiso para el botón "Actualizar ahora" (cifrado, como todo lo demás)
  if (cfg.disparo && cfg.disparo.repo) escribir('disparo.enc', cfg.disparo);

  // Lo único sin cifrar: la llave de datos protegida con la clave de cada usuario
  fs.writeFileSync(path.join(dir, 'acceso.json'), JSON.stringify({
    version: 1, iteraciones: ITERACIONES, usuarios: llavesUsuarios(cfg.usuarios, llave),
  }));
  return { compras: items.length, ordenes: ordenes.length, marcadas, palabras: filtro.palabras };
}

module.exports = { publicar, archivo };
