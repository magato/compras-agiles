// Mantiene en la base local todas las Compras Ágiles publicadas (abiertas a cotizar).
//  · Sincronización completa: recorre región por región (la API pagina hasta 10.000
//    resultados por consulta y a nivel nacional hay más). Se hace al partir y una vez al día.
//  · Sincronización incremental: cada pocos minutos pide solo lo que cambió desde la
//    última vez (parámetro cambio_desde), agrega las nuevas y saca las que cerraron.
//  · Detalle: la descripción y los productos solicitados vienen en otra llamada; se
//    descargan en segundo plano (con tope diario) y al abrir una compra en el sitio.
const api = require('./mp');
const store = require('./store');
const cfg = require('./config');
const { clasificar } = require('./sectores');

const REGIONES = {
  15: 'Arica y Parinacota', 1: 'Tarapacá', 2: 'Antofagasta', 3: 'Atacama', 4: 'Coquimbo',
  5: 'Valparaíso', 13: 'Metropolitana', 6: "O'Higgins", 7: 'Maule', 16: 'Ñuble', 8: 'Biobío',
  9: 'Araucanía', 14: 'Los Ríos', 10: 'Los Lagos', 11: 'Aysén', 12: 'Magallanes',
};

const estado = { corriendo: false, tipo: '', paginas: 0, paginasTotal: 0, errores: 0, mensaje: '' };

// Lleva cualquier fecha de la API a hora de Chile "AAAA-MM-DDTHH:mm:ss" (comparable como texto)
function aChile(s) {
  if (!s) return null;
  let v = String(s).trim();
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}(:\d{2})?$/.test(v)) v = v.replace(' ', 'T');
  if (/[zZ]$|[+-]\d{2}:?\d{2}$/.test(v)) {
    const d = new Date(v);
    if (isNaN(d)) return null;
    return d.toLocaleString('sv-SE', { timeZone: 'America/Santiago' }).replace(' ', 'T');
  }
  return v.length === 16 ? v + ':00' : v.slice(0, 19);
}

function urlFicha(codigo) { return cfg.urlFicha.replace('{codigo}', encodeURIComponent(codigo)); }

function normalizar(it, previo) {
  const inst = it.institucion || {};
  const montos = it.montos || {};
  const f = it.fechas || {};
  const montoCLP = Number(montos.monto_disponible_clp) > 0 ? Math.round(Number(montos.monto_disponible_clp)) : null;
  const c = {
    codigo: it.codigo,
    nombre: it.nombre || '',
    estado: (it.estado && it.estado.codigo) || '',
    convocatoria: Number((it.convocatoria && it.convocatoria.estado_convocatoria) || 1),
    organismo: inst.organismo_comprador || '',
    rutOrganismo: inst.rut || '',
    unidad: inst.unidad_compra || '',
    regionId: inst.region != null ? Number(inst.region) : null,
    region: inst.nombre_region || REGIONES[inst.region] || '',
    moneda: montos.moneda || 'CLP',
    monto: Number(montos.monto_disponible) || null,
    montoCLP,
    fechaPublicacion: aChile(f.fecha_publicacion),
    fechaCierre: aChile(f.fecha_cierre),
    fechaCambio: f.fecha_ultimo_cambio || null,
    ofertas: (it.resumen && it.resumen.total_ofertas_recibidas) ?? null,
    documentos: (it.documentos || []).length,
    url: urlFicha(it.codigo),
    detalle: previo ? previo.detalle : null,
  };
  c.sectores = clasificar({
    nombre: c.nombre, organismo: c.organismo,
    descripcion: c.detalle ? c.detalle.descripcion : '',
    codigos: c.detalle ? c.detalle.productos.map((p) => p.codigo) : [],
  });
  return c;
}

function guardarItem(it) {
  const db = store.db;
  const cod = it.codigo;
  if (!cod) return;
  if (it.estado && it.estado.codigo && it.estado.codigo !== 'publicada') { delete db.compras[cod]; return; }
  db.compras[cod] = normalizar(it, db.compras[cod]);
}

// Recorre todas las páginas de una consulta (página 1 primero; el resto en paralelo)
async function paginar(params, alItem) {
  const base = { ...params, tamano_pagina: 50 };
  const p1 = await api.compraAgilListado({ ...base, numero_pagina: 1 });
  if (!p1) return 0;
  (p1.items || []).forEach(alItem);
  estado.paginas++;
  const total = (p1.paginacion && p1.paginacion.total_paginas) || 1;
  estado.paginasTotal += total;
  const resto = [];
  for (let n = 2; n <= Math.min(total, 200); n++) {
    resto.push(api.compraAgilListado({ ...base, numero_pagina: n }).then((p) => {
      (p && p.items || []).forEach(alItem);
      estado.paginas++;
    }));
  }
  const r = await Promise.allSettled(resto);
  const fallas = r.filter((x) => x.status === 'rejected');
  if (fallas.length) throw fallas[0].reason;
  return (p1.paginacion && p1.paginacion.total_resultados) || 0;
}

async function completa() {
  const db = store.db;
  const inicio = new Date().toISOString();
  const vistos = new Set();
  let huboError = false;
  Object.assign(estado, { tipo: 'completa', paginas: 0, paginasTotal: 0, errores: 0, mensaje: 'Descargando Compras Ágiles publicadas, región por región…' });

  await Promise.all(Object.keys(REGIONES).map(async (r) => {
    try {
      await paginar({ estado: 'publicada', region: r, ordenar_por: 'FechaPublicacion' }, (it) => { vistos.add(it.codigo); guardarItem(it); });
    } catch (e) {
      huboError = true; estado.errores++;
      if (e.fatal) throw e;
      console.warn(`[sync] región ${r}: ${e.message}`);
    }
  }));

  // Solo si todo salió bien se eliminan las que ya no aparecen como publicadas
  if (!huboError) for (const c of Object.keys(db.compras)) if (!vistos.has(c)) delete db.compras[c];
  db.ultimaSyncCompleta = inicio;
  db.ultimoCambio = inicio;
}

async function incremental() {
  const db = store.db;
  const inicio = new Date().toISOString();
  const desde = new Date(new Date(db.ultimoCambio).getTime() - 5 * 60e3).toISOString().replace(/\.\d+Z$/, 'Z');
  Object.assign(estado, { tipo: 'incremental', paginas: 0, paginasTotal: 0, errores: 0, mensaje: 'Buscando cambios recientes…' });
  // Sin filtro de estado: así también se entera de las que cerraron o se cancelaron
  const n = await paginar({ cambio_desde: desde, cambio_hasta: inicio.replace(/\.\d+Z$/, 'Z') }, guardarItem);
  db.ultimoCambio = inicio;
  return n;
}

// Descarga detalle (descripción, productos, entrega) y reclasifica por categoría de producto
async function cargarDetalle(codigo) {
  const db = store.db;
  const d = await api.compraAgilDetalle(codigo);
  if (!d) return null;
  const detalle = {
    descripcion: (d.descripcion || '').slice(0, 3000),
    productos: (d.productos_solicitados || []).map((p) => ({
      codigo: String(p.codigo_producto || ''), nombre: p.nombre || '', descripcion: p.descripcion || '',
      cantidad: p.cantidad, unidad: p.unidad_medida || '',
    })),
    entrega: { direccion: (d.entrega && d.entrega.direccion_entrega) || '', plazoDias: (d.entrega && d.entrega.plazo_entrega_dias) ?? null },
    tipoPresupuesto: (d.presupuesto && d.presupuesto.tipo_presupuesto) || '',
    documentos: (d.documentos || []).map((x) => x.nombre).filter(Boolean),
    cargado: new Date().toISOString(),
  };
  if (db.compras[codigo]) {
    db.compras[codigo].detalle = detalle;
    const c = db.compras[codigo];
    c.sectores = clasificar({ nombre: c.nombre, organismo: c.organismo, descripcion: detalle.descripcion, codigos: detalle.productos.map((p) => p.codigo) });
    store.save();
  }
  return detalle;
}

async function enriquecer() {
  const db = store.db;
  const hoy = new Date().toISOString().slice(0, 10);
  if (db.detallesHoy.fecha !== hoy) db.detallesHoy = { fecha: hoy, n: 0 };
  const cupo = cfg.detalleMaxDia - db.detallesHoy.n;
  if (cupo <= 0) return;
  // Primero las más recientes
  const pendientes = Object.values(db.compras).filter((c) => !c.detalle)
    .sort((a, b) => (b.fechaPublicacion || '').localeCompare(a.fechaPublicacion || ''))
    .slice(0, Math.min(cupo, cfg.detallePorEjecucion));
  if (!pendientes.length) return;
  estado.mensaje = `Descargando detalle de ${pendientes.length} compras para clasificarlas mejor…`;
  await Promise.allSettled(pendientes.map((c) => cargarDetalle(c.codigo).then(() => db.detallesHoy.n++)));
}

// rapida = actualización pedida desde el botón de la plataforma: solo los cambios recientes,
// sin la descarga completa diaria ni detalles, para que termine en 1 a 3 minutos.
async function sincronizar({ forzarCompleta = false, rapida = false } = {}) {
  if (estado.corriendo) return estado;
  estado.corriendo = true;
  const db = store.db;
  try {
    const antigua = !db.ultimaSyncCompleta || Date.now() - new Date(db.ultimaSyncCompleta) > 24 * 3600e3;
    if (!db.ultimoCambio || forzarCompleta || (antigua && !rapida)) await completa();
    else await incremental();
    db.ultimaSync = new Date().toISOString();
    store.save(true);
    if (!rapida) await enriquecer();
    estado.mensaje = `Listo: ${Object.keys(db.compras).length} Compras Ágiles abiertas en la base.`;
  } catch (e) {
    estado.mensaje = e.codigo === 'tiempo'
      ? `Actualización parcial (${Object.keys(db.compras).length} Compras Ágiles en la base); lo pendiente sigue en la próxima ejecución.`
      : `Error: ${e.message}`;
    console.error('[sync]', e.message);
  } finally {
    estado.corriendo = false;
    store.save(true);
  }
  return estado;
}

module.exports = { sincronizar, cargarDetalle, estado, REGIONES };
