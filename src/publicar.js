// Genera los archivos estáticos que lee el sitio (public/data/*):
//   compras.json   → todas las Compras Ágiles abiertas (sin el detalle largo)
//   detalle/X.json → descripción, productos y entrega de cada compra con detalle descargado
//   estado.json    → cuándo se actualizó y cómo están los avisos (sin datos de tus OCs)
const fs = require('fs');
const path = require('path');
const cfg = require('./config');
const store = require('./store');
const api = require('./mp');
const { estado: estadoSync } = require('./sync');

const archivo = (codigo) => codigo.replace(/[^A-Za-z0-9-]/g, '_') + '.json';

function publicar() {
  const db = store.db;
  const dir = path.join(cfg.publicDir, 'data');
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(path.join(dir, 'detalle'), { recursive: true });

  const ahora = new Date().toLocaleString('sv-SE', { timeZone: 'America/Santiago' }).replace(' ', 'T');
  const items = [];
  for (const c of Object.values(db.compras)) {
    if (c.fechaCierre && c.fechaCierre < ahora) continue;
    const d = c.detalle;
    items.push({
      codigo: c.codigo, nombre: c.nombre, organismo: c.organismo, unidad: c.unidad,
      regionId: c.regionId, region: c.region, montoCLP: c.montoCLP,
      fechaPublicacion: c.fechaPublicacion, fechaCierre: c.fechaCierre,
      sectores: c.sectores, convocatoria: c.convocatoria, documentos: c.documentos, url: c.url,
      // texto extra para que la búsqueda por palabras encuentre también descripción y productos
      texto: d ? `${d.descripcion.slice(0, 300)} ${d.productos.map((p) => p.nombre).join(' ')}`.trim() : '',
      det: !!d,
    });
    if (d) fs.writeFileSync(path.join(dir, 'detalle', archivo(c.codigo)), JSON.stringify(d));
  }
  fs.writeFileSync(path.join(dir, 'compras.json'), JSON.stringify({ generado: new Date().toISOString(), items }));

  fs.writeFileSync(path.join(dir, 'estado.json'), JSON.stringify({
    generado: new Date().toISOString(),
    compras: items.length,
    conDetalle: items.filter((i) => i.det).length,
    ultimaSync: db.ultimaSync,
    ultimaSyncCompleta: db.ultimaSyncCompleta,
    mensajeSync: estadoSync.mensaje,
    ocActivo: !!(db.proveedor || cfg.mp.codigoProveedor),
    ultimaRevisionOC: db.ultimaRevisionOC,
    errorOC: db.errorOC || null,
    ocSoloCompraAgil: cfg.ocSoloCompraAgil,
    canales: {
      email: !!(cfg.mail.host && cfg.mail.user && cfg.mail.to.length),
      whatsapp: cfg.callmebot.length > 0,
      telegram: !!(cfg.telegram.token && cfg.telegram.chats.length),
    },
    llamadasApiEjecucion: api.llamadasHoy(),
    detallesHoy: db.detallesHoy.n,
  }));
  return items.length;
}

module.exports = { publicar, archivo };
