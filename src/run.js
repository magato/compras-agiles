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

const resumen = [];
const log = (s) => { console.log(s); resumen.push(s); };

(async () => {
  const t0 = Date.now();

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
    await Promise.all([revisar(), sincronizar({ forzarCompleta: process.env.COMPLETA === 'true' })]);
    log(`**Compras Ágiles:** ${estado.mensaje} (${estado.tipo})`);
    const db = store.db;
    if (db.errorOC) log(`**Órdenes de compra:** error: ${db.errorOC}`);
    else if (db.proveedor || cfg.mp.codigoProveedor) log(`**Órdenes de compra:** revisadas (${Object.keys(db.ordenes).length} registradas)`);
    else log('**Órdenes de compra:** monitor desactivado (falta MP_RUT_PROVEEDOR)');
  }

  const n = publicar();
  store.save(true);
  log(`**Publicadas:** ${n} Compras Ágiles abiertas · ${((Date.now() - t0) / 1000).toFixed(0)} s`);

  if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, resumen.join('\n\n') + '\n');
  // Si el ticket es inválido, se marca la ejecución como fallida para que GitHub te avise por email
  if (/ticket|permisos/i.test(estado.mensaje + (store.db.errorOC || ''))) process.exitCode = 1;
})().catch((e) => { console.error(e); process.exitCode = 1; });
