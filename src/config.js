// Configuración. En GitHub se toma de los "Secrets" del repositorio (ver README).
// En tu computador puedes usar un archivo .env para probar.
try { require('dotenv').config(); } catch { /* dotenv solo se usa en local */ }

const env = process.env;
const num = (v, d) => (v === undefined || v === '' || isNaN(Number(v)) ? d : Number(v));
const list = (v) => (v || '').split(/[,\n]/).map((s) => s.trim()).filter(Boolean);
const path = require('path');

module.exports = {
  mp: {
    baseUrl: (env.MP_BASE_URL || 'https://api.mercadopublico.cl/servicios/v1/publico').replace(/\/$/, ''),
    base2Url: (env.MP2_BASE_URL || 'https://api2.mercadopublico.cl').replace(/\/$/, ''),
    ticket: env.MP_TICKET || '',
    rutProveedor: env.MP_RUT_PROVEEDOR || '',
    codigoProveedor: env.MP_CODIGO_PROVEEDOR || '',
    delayMs: num(env.MP_DELAY_MS, 1100),
    v2Concurrencia: num(env.MP2_CONCURRENCIA, 6),
    v2PausaMs: num(env.MP2_PAUSA_MS, 400),
  },
  detalleMaxDia: num(env.DETALLE_MAX_DIA, 2500),
  detallePorEjecucion: num(env.DETALLE_POR_EJECUCION, 40),
  ocSoloCompraAgil: env.OC_SOLO_COMPRA_AGIL !== '0',
  // Historial de órdenes de compra: días hacia atrás que se descargan (de a poco)
  diasHistorialOC: num(env.DIAS_HISTORIAL_OC, 365),
  diasHistorialPorEjecucion: num(env.DIAS_HISTORIAL_POR_EJECUCION, 12),
  // Usuarios con acceso al sitio (secret SITE_USUARIOS, una línea "usuario:clave" por persona)
  usuarios: require('./cifrado').leerUsuarios(env.SITE_USUARIOS),
  urlFicha: env.CA_URL_FICHA || 'https://buscador.mercadopublico.cl/ficha?code={codigo}',
  mail: {
    host: env.SMTP_HOST || (env.SMTP_USER && /@gmail\.com$/i.test(env.SMTP_USER) ? 'smtp.gmail.com' : ''),
    port: num(env.SMTP_PORT, 465),
    user: env.SMTP_USER || '',
    pass: env.SMTP_PASS || '',
    from: env.MAIL_FROM || env.SMTP_USER || '',
    to: list(env.MAIL_TO),
  },
  // WhatsApp gratis vía CallMeBot: "telefono:apikey", uno por línea o separados por coma
  callmebot: list(env.CALLMEBOT).map((x) => { const [phone, apikey] = x.split(':').map((s) => s.trim()); return { phone, apikey }; }).filter((x) => x.phone && x.apikey),
  telegram: { token: env.TELEGRAM_BOT_TOKEN || '', chats: list(env.TELEGRAM_CHAT_ID) },
  dryRun: env.NOTIFY_DRY_RUN === '1',
  dataFile: env.DATA_FILE || path.join(__dirname, '..', 'data', 'db.json'), // si hay ticket se guarda cifrado como db.enc
  publicDir: env.PUBLIC_DIR || path.join(__dirname, '..', 'public'),
};
