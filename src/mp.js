// Clientes de las dos APIs de Mercado Público (mismo ticket):
//  v1  api.mercadopublico.cl   → órdenes de compra y proveedores. Ticket en la URL.
//                                No acepta peticiones simultáneas: se hacen en fila.
//  v2  api2.mercadopublico.cl  → Compra Ágil. Ticket en el header "ticket".
//                                Respuestas lentas (10-20 s); acepta algunas en paralelo,
//                                pero más de ~4 por segundo devuelve 429.
const { mp } = require('./config');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let contador = { fecha: '', n: 0 };
function contar() {
  const hoy = new Date().toISOString().slice(0, 10); // la cuota se reinicia a medianoche UTC
  if (contador.fecha !== hoy) contador = { fecha: hoy, n: 0 };
  contador.n++;
}

class MPError extends Error {
  constructor(msg, codigo, fatal = false) { super(msg); this.codigo = codigo; this.fatal = fatal; }
}

// ─── v1 (en fila) ────────────────────────────────────────────────────
let cola = Promise.resolve();
function enFila(fn) {
  const p = cola.then(fn);
  cola = p.catch(() => {}).then(() => sleep(mp.delayMs));
  return p;
}

async function v1(recurso, params, intentos = 4) {
  if (!mp.ticket) throw new MPError('Falta MP_TICKET en la configuración', 0, true);
  return enFila(async () => {
    const url = new URL(`${mp.baseUrl}/${recurso}`);
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
    url.searchParams.set('ticket', mp.ticket);
    let ultimo;
    for (let i = 0; i < intentos; i++) {
      try {
        contar();
        const res = await fetch(url, { signal: AbortSignal.timeout(60000) });
        const texto = await res.text();
        let json;
        try { json = JSON.parse(texto); } catch { throw new MPError(`Respuesta no JSON (HTTP ${res.status})`); }
        if (json && json.Mensaje && json.Codigo && !json.Listado && !json.listaEmpresas) {
          // 10500 = peticiones simultáneas (se reintenta); otros códigos no.
          throw new MPError(json.Mensaje, json.Codigo, String(json.Codigo) !== '10500');
        }
        if (!res.ok) throw new MPError(`HTTP ${res.status}`);
        return json;
      } catch (e) {
        ultimo = e;
        if (e.fatal) break;
        await sleep(1500 * 2 ** i);
      }
    }
    throw ultimo;
  });
}

// ─── v2 (paralelo limitado) ──────────────────────────────────────────
let activos = 0, ultimoInicio = 0;
const espera = [];
async function turno() {
  while (activos >= mp.v2Concurrencia) await new Promise((r) => espera.push(r));
  activos++;
  const falta = ultimoInicio + mp.v2PausaMs - Date.now();
  ultimoInicio = Math.max(Date.now(), ultimoInicio + mp.v2PausaMs);
  if (falta > 0) await sleep(falta);
}
function liberar() { activos--; const r = espera.shift(); if (r) r(); }

async function v2(ruta, params = {}, intentos = 4) {
  if (!mp.ticket) throw new MPError('Falta MP_TICKET en la configuración', 0, true);
  const url = new URL(`${mp.base2Url}${ruta}`);
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, v);
  let ultimo;
  for (let i = 0; i < intentos; i++) {
    await turno();
    try {
      contar();
      const res = await fetch(url, { headers: { ticket: mp.ticket, accept: 'application/json' }, signal: AbortSignal.timeout(90000) });
      const texto = await res.text();
      let json = null;
      try { json = JSON.parse(texto); } catch { /* p. ej. 504 de un proxy */ }
      if (res.ok && json && json.success === 'OK') return json.payload;
      const err = (json && json.errors && json.errors[0]) || {};
      const codigo = Number(err.codigo || res.status);
      const msg = err.mensaje || `HTTP ${res.status}`;
      if (codigo === 404) return null;
      // 400 = parámetros malos, 401 = ticket inválido: no sirve reintentar
      throw new MPError(msg, codigo, codigo === 400 || codigo === 401 || codigo === 403);
    } catch (e) {
      ultimo = e;
      if (e.fatal) break;
    } finally {
      liberar();
    }
    await sleep((ultimo && ultimo.codigo === 429 ? 5000 : 2000) * 2 ** i);
  }
  throw ultimo;
}

// ddmmaaaa en hora de Chile (formato de fechas de la API v1)
function fechaMP(date = new Date()) {
  const p = new Intl.DateTimeFormat('es-CL', {
    timeZone: 'America/Santiago', day: '2-digit', month: '2-digit', year: 'numeric',
  }).formatToParts(date);
  const g = (t) => p.find((x) => x.type === t).value;
  return `${g('day')}${g('month')}${g('year')}`;
}

module.exports = {
  MPError,
  fechaMP,
  llamadasHoy: () => (contador.fecha === new Date().toISOString().slice(0, 10) ? contador.n : 0),
  // v2 · Compra Ágil
  compraAgilListado: (params) => v2('/v2/compra-agil', params),
  compraAgilDetalle: (codigo) => v2(`/v2/compra-agil/${encodeURIComponent(codigo)}`),
  // v1 · órdenes de compra y proveedor
  ordenesProveedor: async (fecha, codigoProveedor) =>
    (await v1('ordenesdecompra.json', { fecha, CodigoProveedor: codigoProveedor })).Listado || [],
  orden: async (codigo) => ((await v1('ordenesdecompra.json', { codigo })).Listado || [])[0] || null,
  buscarProveedor: async (rut) =>
    ((await v1('Empresas/BuscarProveedor', { rutempresaproveedor: rut })).listaEmpresas || [])[0] || null,
};
