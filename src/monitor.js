// Órdenes de compra de tu empresa:
//  · Recientes (hoy y ayer): detecta las nuevas y avisa por email/WhatsApp/Telegram.
//    Por defecto solo avisa las de Compra Ágil (tipo "AG": su código termina en -AG + año).
//  · Historial: descarga de a poco las OCs de días anteriores (todos los estados y tipos)
//    para la sección "Órdenes de compra" del sitio. No genera avisos.
//  · Seguimiento: vuelve a consultar las OCs que aún pueden cambiar de estado.
// El estado completo se guarda cifrado, así que aquí sí se guardan montos y compradores.
const api = require('./mp');
const store = require('./store');
const cfg = require('./config');
const { notificarOC } = require('./notify');

// Estados que significan "te llegó una OC". Las canceladas (9) no se avisan.
const ESTADOS_AVISO = new Set(['4', '5', '6', '12', '13', '14', '15']);
// Estados que ya no cambian: no hace falta volver a consultarlos
const ESTADOS_FINALES = new Set(['9', '12']);
const MAX_DETALLES_HISTORIAL = 60; // por ejecución
const MAX_SEGUIMIENTO = 15; // por ejecución

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

const tipoDeCodigo = (codigo) => ((String(codigo).match(/-([A-Z]+)\d{2}$/i) || [])[1] || '').toUpperCase();

function normalizarOC(d, resumen, previo) {
  const cod = d.Codigo || resumen.Codigo;
  const c = d.Comprador || {};
  const f = d.Fechas || {};
  const tipo = String(d.Tipo || d.CodigoTipo || tipoDeCodigo(cod) || '').toUpperCase();
  const licitacion = d.CodigoLicitacion || '';
  const items = ((d.Items && d.Items.Listado) || []).map((i) => ({
    producto: i.Producto || i.NombreProducto || '',
    categoria: i.Categoria || '',
    especificacion: i.EspecificacionComprador || i.EspecificacionProveedor || '',
    cantidad: i.Cantidad ?? null,
    unidad: i.Unidad || i.UnidadMedida || '',
    precioNeto: Number(i.PrecioNeto) || null,
    total: Number(i.Total) || null,
  }));
  return {
    ...(previo && previo.codigo ? previo : {}),
    codigo: cod,
    nombre: d.Nombre || resumen.Nombre || '',
    estado: d.Estado || resumen.Estado || '',
    codigoEstado: String(d.CodigoEstado ?? resumen.CodigoEstado ?? ''),
    tipo,
    compraAgil: tipo === 'AG' || /-AG\d{2}$/i.test(cod) || /-COT\d{2}$/i.test(licitacion),
    licitacion,
    comprador: c.NombreOrganismo || '',
    unidad: c.NombreUnidad || '',
    rutUnidad: c.RutUnidad || '',
    region: (c.RegionUnidad || '').trim(),
    comuna: (c.ComunaUnidad || '').trim(),
    contacto: { nombre: c.NombreContacto || '', mail: c.MailContacto || '', fono: c.FonoContacto || '' },
    total: Number(d.Total) || null,
    totalNeto: Number(d.TotalNeto) || null,
    impuestos: Number(d.Impuestos) || null,
    moneda: d.TipoMoneda || 'CLP',
    fechaCreacion: f.FechaCreacion || null,
    fechaEnvio: f.FechaEnvio || f.FechaCreacion || null,
    fechaAceptacion: f.FechaAceptacion || null,
    fechaCancelacion: f.FechaCancelacion || null,
    fechaModificacion: f.FechaUltimaModificacion || null,
    items,
    url: `https://www.mercadopublico.cl/PurchaseOrder/Modules/PO/DetailsPurchaseOrder.aspx?codigoOC=${encodeURIComponent(cod)}`,
    detectada: (previo && previo.detectada) || new Date().toISOString(),
    consultada: new Date().toISOString(),
  };
}

// Registro antiguo (versión sin historial) que solo guardaba código y aviso
const esRegistroMinimo = (r) => r && !r.codigo;

async function traer(cod, resumen, previo) {
  const d = (await api.orden(cod)) || resumen;
  const oc = normalizarOC(d, resumen, previo);
  if (previo) { oc.aviso = previo.aviso; oc.intentos = previo.intentos || 0; oc.detalleAviso = previo.detalleAviso; }
  return oc;
}

async function recientes(codigo) {
  const db = store.db;
  const ahora = new Date();
  const vistas = new Map();
  for (const f of [api.fechaMP(ahora), api.fechaMP(new Date(ahora.getTime() - 86400000))]) {
    for (const o of await api.ordenesProveedor(f, codigo)) vistas.set(o.Codigo, o);
  }
  const primeraVez = !db.ocInicializado;
  for (const [cod, resumen] of vistas) {
    const previo = db.ordenes[cod];
    const reintentar = previo && previo.aviso === 'error' && (previo.intentos || 0) < 5;
    if (previo && !esRegistroMinimo(previo) && !reintentar) {
      // Ya conocida: si el listado muestra otro estado, se marca para volver a consultarla
      if (resumen.CodigoEstado != null && String(resumen.CodigoEstado) !== previo.codigoEstado) previo.consultada = null;
      continue;
    }
    const oc = await traer(cod, resumen, previo);
    db.ordenes[cod] = oc;
    if (previo && !reintentar) continue; // registro antiguo: ya se avisó (o se omitió) antes
    oc.intentos = oc.intentos || 0;
    if (cfg.ocSoloCompraAgil && !oc.compraAgil) { oc.aviso = 'omitida: no es Compra Ágil'; continue; }
    if (primeraVez) { oc.aviso = 'omitida: carga inicial'; continue; }
    if (!ESTADOS_AVISO.has(oc.codigoEstado)) { oc.aviso = `omitida: estado ${oc.estado}`; continue; }
    const res = await notificarOC(oc);
    oc.intentos++;
    // Si ningún canal funcionó, se reintenta en la próxima ejecución (hasta 5 veces)
    oc.aviso = res.some((r) => r.ok) ? 'enviada' : 'error';
    oc.detalleAviso = res.map((r) => `${r.canal}: ${r.ok ? 'ok' : r.error || r.omitido}`).join(' · ');
    console.log(`[oc] Nueva OC ${cod} → ${oc.detalleAviso}`);
  }
  db.ocInicializado = true;
}

// Descarga días anteriores, del más reciente al más antiguo, hasta DIAS_HISTORIAL_OC
async function historial(codigo) {
  const db = store.db;
  const dia = 86400000;
  const limite = Date.now() - cfg.diasHistorialOC * dia;
  // Empieza 2 días atrás (hoy y ayer los cubre "recientes")
  let cursor = db.historialOC.hasta ? new Date(db.historialOC.hasta + 'T12:00:00Z').getTime() - dia : Date.now() - 2 * dia;
  let dias = 0, detalles = 0;
  const h = db.historialOC;
  h.fallos = h.fallos || {};
  while (cursor >= limite && dias < cfg.diasHistorialPorEjecucion) {
    const diaIso = new Date(cursor).toISOString().slice(0, 10);
    let lista;
    try {
      lista = await api.ordenesProveedor(api.fechaMP(new Date(cursor)), codigo);
    } catch (e) {
      if (e.codigo === 'tiempo') throw e;
      // Un día que falla no detiene el historial: se reintenta 3 veces y luego se salta
      h.fallos[diaIso] = (h.fallos[diaIso] || 0) + 1;
      h.error = `${diaIso}: ${e.message}`;
      console.warn(`[oc] historial ${diaIso}: ${e.message} (intento ${h.fallos[diaIso]})`);
      if (h.fallos[diaIso] < 3) break;
      lista = null;
    }
    if (lista === null) { h.hasta = diaIso; cursor -= dia; dias++; continue; }
    const nuevas = lista.filter((o) => !db.ordenes[o.Codigo] || esRegistroMinimo(db.ordenes[o.Codigo]));
    if (detalles > 0 && detalles + nuevas.length > MAX_DETALLES_HISTORIAL) break; // sigue en la próxima ejecución
    for (const o of nuevas) {
      const previo = db.ordenes[o.Codigo];
      const oc = await traer(o.Codigo, o, previo);
      if (!oc.aviso) oc.aviso = 'historial';
      db.ordenes[o.Codigo] = oc;
      detalles++;
    }
    h.hasta = diaIso;
    delete h.fallos[diaIso];
    cursor -= dia;
    dias++;
  }
  h.completo = cursor < limite;
  if (h.completo) h.error = null;
}

// Vuelve a consultar OCs que todavía pueden cambiar (enviadas, aceptadas, en recepción…)
async function seguimiento() {
  const db = store.db;
  const hace6h = new Date(Date.now() - 6 * 3600e3).toISOString();
  const pendientes = Object.values(db.ordenes)
    .filter((o) => o.codigo && !ESTADOS_FINALES.has(o.codigoEstado) && (!o.consultada || o.consultada < hace6h))
    .sort((a, b) => (a.consultada || '').localeCompare(b.consultada || ''))
    .slice(0, MAX_SEGUIMIENTO);
  for (const o of pendientes) {
    const d = await api.orden(o.codigo);
    if (d) db.ordenes[o.codigo] = { ...normalizarOC(d, { Codigo: o.codigo }, o), aviso: o.aviso, intentos: o.intentos, detalleAviso: o.detalleAviso };
    else o.consultada = new Date().toISOString();
  }
}

let corriendo = false;
async function revisar({ rapida = false } = {}) {
  if (corriendo) return;
  corriendo = true;
  const db = store.db;
  try {
    const codigo = await codigoProveedor();
    if (!codigo) { console.log('[oc] Sin RUT ni código de proveedor configurado; monitor desactivado.'); return; }
    await recientes(codigo); // primero lo urgente: los avisos
    store.save(true);
    db.ultimaRevisionOC = new Date().toISOString();
    db.errorOC = null;
    if (!rapida) try {
      await seguimiento();
      await historial(codigo);
    } catch (e) {
      console.warn('[oc] historial/seguimiento:', e.message); // no afecta los avisos
    }
  } catch (e) {
    console.error('[oc]', e.message);
    db.errorOC = e.message;
  } finally {
    corriendo = false;
    store.save(true);
  }
}

module.exports = { revisar };
