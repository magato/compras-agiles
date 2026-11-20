// Avisos gratuitos: email (SMTP, p. ej. Gmail), WhatsApp vía CallMeBot y Telegram.
const nodemailer = require('nodemailer');
const cfg = require('./config');

const clp = (n) => (n == null ? 's/i' : '$' + Math.round(n).toLocaleString('es-CL'));
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function textoOC(oc) {
  return [
    `✅ Nueva orden de compra${oc.compraAgil ? ' de Compra Ágil' : ''}`,
    '',
    `OC: ${oc.codigo}`,
    `Nombre: ${oc.nombre}`,
    `Comprador: ${oc.comprador}`,
    oc.licitacion ? `Compra Ágil: ${oc.licitacion}` : null,
    `Monto: ${clp(oc.total)}`,
    `Estado: ${oc.estado}`,
    oc.fechaEnvio ? `Fecha: ${oc.fechaEnvio.replace('T', ' ').slice(0, 16)}` : null,
    '',
    `Ver: ${oc.url}`,
  ].filter((l) => l !== null).join('\n');
}

let transporter = null;
async function email(asunto, texto, html) {
  const m = cfg.mail;
  if (!m.host || !m.user || !m.to.length) return { canal: 'email', omitido: 'sin configurar' };
  if (cfg.dryRun) { console.log(`[dry-run email → ${m.to}] ${asunto}`); return { canal: 'email', ok: true, dryRun: true }; }
  transporter ||= nodemailer.createTransport({ host: m.host, port: m.port, secure: m.port === 465, auth: { user: m.user, pass: m.pass } });
  await transporter.sendMail({ from: m.from, to: m.to.join(','), subject: asunto, text: texto, html });
  return { canal: 'email', ok: true };
}

const paraWhatsApp = (t) => String(t).replace(/\$\s*(?=\d)/g, 'CLP ');

async function whatsapp(texto) {
  if (!cfg.callmebot.length) return { canal: 'whatsapp', omitido: 'sin configurar' };
  if (cfg.dryRun) { console.log(`[dry-run whatsapp → ${cfg.callmebot.map((x) => x.phone)}]\n${paraWhatsApp(texto)}`); return { canal: 'whatsapp', ok: true, dryRun: true }; }
  // CallMeBot interpreta "$" + número como un código y borra ambos ("$139.218" llegaba como "39.218").
  // Por eso en WhatsApp los montos van como "CLP 139.218" (solo se cambia el "$" que va antes de un número).
  const textoWA = paraWhatsApp(texto);
  for (const { phone, apikey } of cfg.callmebot) {
    const url = `https://api.callmebot.com/whatsapp.php?phone=${encodeURIComponent(phone)}&apikey=${encodeURIComponent(apikey)}&text=${encodeURIComponent(textoWA)}`;
    const r = await fetch(url, { signal: AbortSignal.timeout(30000) });
    const body = await r.text();
    if (!r.ok || /error|invalid|not (allowed|activated)/i.test(body.slice(0, 500))) throw new Error(`CallMeBot ${r.status}: ${body.replace(/<[^>]+>/g, ' ').trim().slice(0, 200)}`);
  }
  return { canal: 'whatsapp', ok: true };
}

async function telegram(texto) {
  const t = cfg.telegram;
  if (!t.token || !t.chats.length) return { canal: 'telegram', omitido: 'sin configurar' };
  if (cfg.dryRun) { console.log(`[dry-run telegram → ${t.chats}]`); return { canal: 'telegram', ok: true, dryRun: true }; }
  for (const chat_id of t.chats) {
    const r = await fetch(`https://api.telegram.org/bot${t.token}/sendMessage`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id, text: texto, disable_web_page_preview: true }),
    });
    if (!r.ok) throw new Error(`Telegram ${r.status}: ${(await r.text()).slice(0, 200)}`);
  }
  return { canal: 'telegram', ok: true };
}

async function notificarOC(oc) {
  const texto = textoOC(oc);
  const filas = [['OC', oc.codigo], ['Nombre', oc.nombre], ['Comprador', oc.comprador], ['Compra Ágil', oc.licitacion || '–'],
    ['Monto', clp(oc.total)], ['Estado', oc.estado], ['Fecha', (oc.fechaEnvio || '').replace('T', ' ').slice(0, 16)]];
  const html = `<div style="font-family:Arial,sans-serif;max-width:560px">
    <h2 style="color:#0b6b3a;margin:0 0 12px">Nueva orden de compra${oc.compraAgil ? ' de Compra Ágil' : ''}</h2>
    <table style="border-collapse:collapse;font-size:14px">${filas.map(([k, v]) =>
      `<tr><td style="padding:4px 12px 4px 0;color:#666">${k}</td><td style="padding:4px 0"><b>${esc(v)}</b></td></tr>`).join('')}</table>
    <p><a href="${esc(oc.url)}" style="background:#0b6b3a;color:#fff;padding:10px 16px;border-radius:6px;text-decoration:none;display:inline-block;margin-top:12px">Ver orden en Mercado Público</a></p></div>`;
  const r = await Promise.all([
    email(`OC ${oc.codigo} · ${oc.comprador} · ${clp(oc.total)}`, texto, html).catch((e) => ({ canal: 'email', error: e.message })),
    whatsapp(texto).catch((e) => ({ canal: 'whatsapp', error: e.message })),
    telegram(texto).catch((e) => ({ canal: 'telegram', error: e.message })),
  ]);
  return r;
}

module.exports = { notificarOC, textoOC, paraWhatsApp };
