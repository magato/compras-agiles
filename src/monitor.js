// Revisa periódicamente las órdenes de compra emitidas a tu empresa y avisa las nuevas.
// Por defecto solo avisa las que vienen de una Compra Ágil: según el glosario de
// ChileCompra, esas OCs son del tipo "AG" (su código termina en -AG + año, ej. 1234-56-AG26).
const api = require('./mp');
const store = require('./store');
const cfg = require('./config');
const { notificarOC } = require('./notify');

// Estados que significan "te llegó una OC". Las canceladas (9) no se avisan.
const ESTADOS_AVISO = new Set(['4', '5', '6', '12', '13', '14', '15']);

async function codigoProveedor() {
  const db = store.db;
  if (cfg.mp.codigoProveedor) return cfg.mp.codigoProveedor;
  if (db.proveedor && db.proveedor.rut === cfg.mp.rutProveedor) return db.proveedor.codigo;
  if (!cfg.mp.rutProveedor) return null;
  // Acepta el RUT escrito de cualquier forma y prueba con puntos (formato que usa la API) y sin puntos
  const limpio = cfg.mp.rutProveedor.replace(/[^0-9kK]/g, '').toUpperCase();
  const cuerpo = limpio.slice(0, -1), dv = limpio.slice(-1);
  const conPuntos = cuerpo.replace(/\B(?=(\d{3})+(?!\d))/g, '.') + '-' + dv;
  let p = null;
  for (const rut of [...new Set([conPuntos, `${cuerpo}-${dv}`, cfg.mp.rutProveedor])]) {
    try { p = await api.buscarProveedor(rut); } catch (e) { if (String(e.codigo) !== '10200') throw e; }
    if (p) break;
  }
  if (!p) throw new Error(`Mercado Público no tiene un proveedor registrado con RUT ${conPuntos}. Revisa que la empresa esté inscrita como proveedor en mercadopublico.cl, o define el secret MP_CODIGO_PROVEEDOR.`);
  db.proveedor = { rut: cfg.mp.rutProveedor, codigo: String(p.CodigoEmpresa), nombre: p.NombreEmpresa };
  store.save(true);
  console.log(`[oc] Proveedor: ${p.NombreEmpresa} (código ${p.CodigoEmpresa})`);
  return db.proveedor.codigo;
}

function esCompraAgil(oc, d) {
  if (/-AG\d{2}$/i.test(oc.codigo)) return true;
  if (String(d.Tipo || d.CodigoTipo || '').toUpperCase() === 'AG') return true;
  return /-COT\d{2}$/i.test(oc.licitacion || '');
}

function normalizarOC(d, resumen) {
  const total = Number(d.Total ?? d.TotalNeto ?? 0) || null;
  return {
    codigo: d.Codigo || resumen.Codigo,
    nombre: d.Nombre || resumen.Nombre || '',
    estado: d.Estado || resumen.Estado || '',
    codigoEstado: String(d.CodigoEstado ?? resumen.CodigoEstado ?? ''),
    comprador: (d.Comprador && d.Comprador.NombreOrganismo) || '',
    unidad: (d.Comprador && d.Comprador.NombreUnidad) || '',
    total,
    moneda: d.TipoMoneda || 'CLP',
    licitacion: d.CodigoLicitacion || '',
    fechaEnvio: (d.Fechas && (d.Fechas.FechaEnvio || d.Fechas.FechaCreacion)) || null,
    url: `https://www.mercadopublico.cl/PurchaseOrder/Modules/PO/DetailsPurchaseOrder.aspx?codigoOC=${encodeURIComponent(d.Codigo || resumen.Codigo)}`,
    detectada: new Date().toISOString(),
  };
}

let corriendo = false;
async function revisar() {
  if (corriendo) return;
  corriendo = true;
  const db = store.db;
  try {
    const codigo = await codigoProveedor();
    if (!codigo) { console.log('[oc] Sin RUT ni código de proveedor configurado; monitor desactivado.'); return; }

    const ahora = new Date();
    const fechas = [api.fechaMP(ahora), api.fechaMP(new Date(ahora.getTime() - 86400000))];
    const vistas = new Map();
    for (const f of fechas) for (const o of await api.ordenesProveedor(f, codigo)) vistas.set(o.Codigo, o);

    // El estado se guarda en un repositorio público: de cada OC solo se guarda el
    // código y el resultado del aviso, no montos ni compradores.
    const primeraVez = !db.ocInicializado;
    for (const [cod, resumen] of vistas) {
      const previo = db.ordenes[cod];
      if (previo && !(previo.aviso === 'error' && (previo.intentos || 0) < 5)) continue;
      const d = (await api.orden(cod)) || resumen;
      const oc = normalizarOC(d, resumen);
      oc.compraAgil = esCompraAgil(oc, d);
      const reg = { detectada: (previo && previo.detectada) || new Date().toISOString(), intentos: ((previo && previo.intentos) || 0) };
      db.ordenes[cod] = reg;
      if (cfg.ocSoloCompraAgil && !oc.compraAgil) { reg.aviso = 'omitida: no es Compra Ágil'; continue; }
      if (primeraVez) { reg.aviso = 'omitida: carga inicial'; continue; }
      if (!ESTADOS_AVISO.has(oc.codigoEstado)) { reg.aviso = `omitida: estado ${oc.estado}`; continue; }
      const res = await notificarOC(oc);
      reg.intentos++;
      // Si ningún canal funcionó, se reintenta en la próxima ejecución (hasta 5 veces)
      reg.aviso = res.some((r) => r.ok) ? 'enviada' : 'error';
      reg.detalleAviso = res.map((r) => `${r.canal}: ${r.ok ? 'ok' : r.error || r.omitido}`).join(' · ');
      console.log(`[oc] Nueva OC ${cod} → ${reg.detalleAviso}`);
    }
    db.ocInicializado = true;
    db.ultimaRevisionOC = new Date().toISOString();
    db.errorOC = null;
  } catch (e) {
    console.error('[oc]', e.message);
    db.errorOC = e.message;
  } finally {
    corriendo = false;
    store.save(true);
  }
}

module.exports = { revisar };
