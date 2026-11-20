// Una ejecución completa. GitHub Actions lo corre cada 15 minutos:
//  1. Revisa si llegaron órdenes de compra nuevas de Compra Ágil y avisa.
//  2. Actualiza la lista de Compras Ágiles abiertas.
//  3. Genera los archivos que publica GitHub Pages.
const fs = require('fs');
const cfg = require('./config');
const store = require('./store');
const { sincronizar, estado } = require('./sync');
const { revisar } = require('./monitor');
const { notificarOC } = require('./notify');
const { publicar } = require('./publicar');

const api = require('./mp');
const db0 = () => store.db;
const resumen = [];
const log = (s) => { console.log(s); resumen.push(s); };

const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

// Suma las consultas de esta ejecución al consumo del día (hora de Chile) y guarda 35 días
function registrarConsumo(rapida) {
  const db = store.db;
  const uso = api.consumoEjecucion();
  const dia = new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Santiago' });
  db.consumo = db.consumo || {};
  const c = db.consumo[dia] || (db.consumo[dia] = { total: 0, compras: 0, detalles: 0, ordenes: 0, ejecuciones: 0, rapidas: 0 });
  for (const k of ['total', 'compras', 'detalles', 'ordenes']) c[k] += uso[k] || 0;
  c.ejecuciones++;
  if (rapida) c.rapidas++;
  for (const d of Object.keys(db.consumo).sort().slice(0, -35)) delete db.consumo[d];
  log(`**Consultas a la API:** ${uso.total} en esta ejecución · ${c.total.toLocaleString('es-CL')} hoy (${Math.round((c.total / cfg.limiteDiario) * 100)}% del límite de ${cfg.limiteDiario.toLocaleString('es-CL')})`);
}

(async () => {
  const t0 = Date.now();
  const rapida = process.env.RAPIDA === 'true';
  // Presupuesto de tiempo: la ejecución siempre debe terminar, guardar y publicar antes del
  // límite de GitHub (40 min). La actualización rápida del botón tiene un límite menor.
  const minutos = Number(process.env.LIMITE_MINUTOS) || (rapida ? 6 : 25);
  const alarma = setTimeout(() => { console.warn(`[run] Límite de ${minutos} min alcanzado: se guarda y publica lo avanzado.`); api.detener(); }, minutos * 60e3);

  if (process.env.PRUEBA === 'true') {
    const r = await notificarOC({
      codigo: '0000-00-AG26', nombre: 'Mensaje de prueba', comprador: 'Organismo de ejemplo', licitacion: '0000-00-COT26',
      compraAgil: true, total: 1234567, estado: 'Enviada a proveedor', fechaEnvio: new Date().toISOString(), url: 'https://www.mercadopublico.cl',
    });
    log(`**Mensaje de prueba:** ${r.map((x) => `${x.canal}: ${x.ok ? 'enviado ✅' : x.error ? 'error ❌ ' + x.error : x.omitido}`).join(' · ')}`);
  }

  if (!cfg.mp.ticket) {
    log('⚠️ Falta el secret MP_TICKET. Revisa el README (paso 3).');
  } else {
    if (rapida) log('⚡ **Actualización rápida** pedida desde la plataforma (botón "Actualizar ahora").');
    const trabajo = Promise.all([revisar({ rapida }), sincronizar({ forzarCompleta: process.env.COMPLETA === 'true', rapida })]);
    // Si algo queda colgado más allá del límite (+1,5 min de margen), se sigue igual
    const aTiempo = await Promise.race([trabajo.then(() => true), esperar(minutos * 60e3 + 90e3).then(() => false)]);
    if (!aTiempo) log(`⏱️ **Se alcanzó el límite de ${minutos} minutos.** Se publicó lo avanzado; lo pendiente sigue en la próxima ejecución.`);
    if (db0().historialOC && db0().historialOC.error) log(`ℹ️ Historial de órdenes: último problema → ${db0().historialOC.error}`);
    log(`**Compras Ágiles:** ${estado.mensaje} (${estado.tipo})`);
    const db = store.db;
    if (db.errorOC) log(`**Órdenes de compra:** error: ${db.errorOC}`);
    else if (db.proveedor || cfg.mp.codigoProveedor) {
      const n = Object.values(db.ordenes).filter((o) => o.codigo).length;
      const h = db.historialOC || {};
      log(`**Órdenes de compra:** revisadas · ${n} en el historial${h.hasta ? ` (descargado hasta el ${h.hasta}${h.completo ? ', completo' : ', sigue en las próximas ejecuciones'})` : ''}`);
    }
    else log('**Órdenes de compra:** monitor desactivado (falta MP_RUT_PROVEEDOR)');
  }

  registrarConsumo(rapida);
  const pub = publicar();
  store.save(true);
  if (pub.sinUsuarios) log('🔒 **Sitio sin datos:** falta el secret SITE_USUARIOS (usuarios y claves de acceso). Revisa el README, paso 3.');
  else {
    if (!cfg.disparo) log('ℹ️ El botón "Actualizar ahora" abre GitHub porque falta el secret GH_DISPARO_TOKEN (ver README).');
    log(`**Publicadas (cifradas):** ${pub.compras} Compras Ágiles abiertas y ${pub.ordenes} órdenes de compra · ${cfg.usuarios.length} usuario(s) con acceso · ${((Date.now() - t0) / 1000).toFixed(0)} s`);
    const debiles = cfg.usuarios.filter((u) => u.clave.length < 10).map((u) => u.usuario);
    if (debiles.length) log(`⚠️ **Claves cortas:** ${debiles.join(', ')}. Usa al menos 10 caracteres: los datos cifrados son públicos y una clave corta se puede adivinar.`);
  }

  clearTimeout(alarma);
  if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, resumen.join('\n\n') + '\n');
  // Si el ticket es inválido, se marca la ejecución como fallida para que GitHub te avise por email
  if (/ticket|permisos/i.test(estado.mensaje + (store.db.errorOC || ''))) process.exitCode = 1;
  // Termina aunque queden llamadas lentas en curso (ya se guardó y publicó todo)
  setTimeout(() => process.exit(process.exitCode || 0), 500);
})().catch((e) => { console.error(e); process.exitCode = 1; setTimeout(() => process.exit(1), 500); });
