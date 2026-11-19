// API simulada de Mercado Público (v1 OCs + v2 Compra Ágil), solo para probar sin ticket real.
// Uso: npm run mock
//   MP_BASE_URL=http://localhost:4999/v1 MP2_BASE_URL=http://localhost:4999 MP_TICKET=demo npm start
// Simulaciones:
//   POST /__nueva-ca   → publica una Compra Ágil nueva
//   POST /__cerrar     → cierra la primera Compra Ágil publicada
//   POST /__nueva-oc   → emite una OC de Compra Ágil (AG) a tu empresa
//   POST /__nueva-oc-se → emite una OC que NO es de Compra Ágil (SE)
const express = require('express');
const app = express();

const base = [
  ['Guantes de nitrilo talla M', 'Servicio de Salud Metropolitano Sur', 13, '42132203'],
  ['Medicamentos para botiquín', 'Hospital Regional de Concepción', 8, '51142900'],
  ['Exámenes preocupacionales', 'CESFAM Las Condes', 13, '85121800'],
  ['Notebooks para laboratorio de computación', 'Liceo Bicentenario de Temuco', 9, '43211503'],
  ['Licencias antivirus 50 equipos', 'Municipalidad de Providencia', 13, '43233205'],
  ['Material didáctico para sala cuna', 'JUNJI', 5, '60101700'],
  ['Servicio de coffee break para jornada', 'Gobierno Regional de Valparaíso', 5, '90101603'],
  ['Reparación de techumbre bodega', 'Municipalidad de Talca', 7, '72101500'],
  ['Productos de aseo para oficinas', 'Dirección del Trabajo', 16, '47131700'],
  ['Arriendo de camioneta por 15 días', 'CONAF', 14, '25101500'],
  ['Tóner para impresoras HP', 'Servicio de Impuestos Internos', 2, '44103103'],
  ['Cámaras de seguridad CCTV', 'Municipalidad de Arica', 15, '46171610'],
];
const pad = (n) => String(n).padStart(2, '0');
const isoZ = (d) => d.toISOString().replace(/\.\d+Z$/, 'Z');
const local = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;

const compras = {};
let seq = 0;
function crear(i, publicadaHace = (i % 4) * 864e5) {
  const [nombre, org, region, cod] = base[i % base.length];
  const pub = new Date(Date.now() - publicadaHace);
  const cierre = new Date(Date.now() + ((i * 11) % 96 + 2) * 3600e3);
  const codigo = `${1057000 + i}-${100 + seq++}-COT26`;
  compras[codigo] = {
    codigo, nombre: `${nombre}${i >= base.length ? ' (' + Math.floor(i / base.length) + ')' : ''}`,
    estado: { id_estado: 2, codigo: 'publicada', glosa: 'Publicada' },
    convocatoria: { estado_convocatoria: i % 7 === 0 ? 2 : 1, descripcion: i % 7 === 0 ? 'Segundo llamado' : 'Primer llamado' },
    documentos: i % 3 === 0 ? [{ id: 1, nombre: 'especificaciones.pdf' }] : [],
    fechas: { fecha_publicacion: isoZ(pub), fecha_cierre: local(cierre), fecha_ultimo_cambio: isoZ(pub), fecha_cancelacion: null },
    montos: { moneda: 'CLP', monto_disponible: i % 5 === 4 ? 0 : (i + 1) * 180000, monto_disponible_clp: i % 5 === 4 ? 0 : (i + 1) * 180000 },
    institucion: { organismo_comprador: org, rut: '61.000.000-0', unidad_compra: 'Abastecimiento', region, nombre_region: null },
    resumen: { total_ofertas_recibidas: 0 },
    links: { detalle: `/v2/compra-agil/${codigo}` },
    _cat: cod,
  };
}
for (let i = 0; i < 70; i++) crear(i);

let ocupadoV1 = false;
const ocs = [{ Codigo: '2097-512-AG26', Nombre: 'OC inicial', CodigoEstado: 6, Estado: 'Aceptada', Total: 850000, Org: 'Hospital de Prueba', Lic: '1057001-5-COT26' }];

// ─── v2 ───
const ok = (payload) => ({ success: 'OK', trace: null, payload, errors: null });
const nok = (codigo, mensaje) => ({ success: 'NOK', trace: null, payload: null, errors: [{ codigo: String(codigo), mensaje, detalle: null }] });

app.use('/v2', async (req, res, next) => {
  if (req.headers.ticket !== 'demo') return res.status(401).json(nok(401, 'El ticket no existe, es inválido o no tiene permisos.'));
  await new Promise((r) => setTimeout(r, 150)); // latencia
  next();
});

app.get('/v2/compra-agil', (req, res) => {
  const q = req.query;
  if (q.id && q.q) return res.status(400).json(nok(400, 'id y q son excluyentes'));
  let l = Object.values(compras);
  if (q.estado) { const e = q.estado.split(','); l = l.filter((c) => e.includes(c.estado.codigo)); }
  if (q.region) { const r = String(q.region).split(',').map(Number); l = l.filter((c) => r.includes(c.institucion.region)); }
  if (q.cambio_desde) l = l.filter((c) => c.fechas.fecha_ultimo_cambio >= q.cambio_desde);
  if (q.cambio_hasta) l = l.filter((c) => c.fechas.fecha_ultimo_cambio <= q.cambio_hasta);
  const tam = Math.min(50, Number(q.tamano_pagina) || 15), num = Number(q.numero_pagina) || 1;
  const items = l.slice((num - 1) * tam, num * tam).map(({ _cat, ...c }) => c);
  res.json(ok({ items, paginacion: { total_paginas: Math.max(1, Math.ceil(l.length / tam)), numero_pagina: num, tamano_pagina: tam, total_resultados: l.length } }));
});

app.get('/v2/compra-agil/:codigo', (req, res) => {
  const c = compras[req.params.codigo];
  if (!c) return res.status(404).json(nok(404, 'No encontrada'));
  const { _cat, ...rest } = c;
  res.json(ok({
    ...rest,
    descripcion: `Se requiere ${c.nombre.toLowerCase()}. Entrega en dependencias del organismo.`,
    entrega: { direccion_entrega: 'Av. Siempre Viva 742', plazo_entrega_dias: 5 },
    presupuesto: { tipo_presupuesto: 'Disponible', moneda: 'CLP', monto_disponible: c.montos.monto_disponible, monto_disponible_clp: c.montos.monto_disponible_clp },
    productos_solicitados: [{ codigo_producto: _cat, nombre: c.nombre, descripcion: 'Según especificaciones', cantidad: 10, unidad_medida: 'EA' }],
    proveedores_cotizando: [],
  }));
});

// ─── v1 ───
app.use('/v1', async (req, res, next) => {
  if (req.query.ticket !== 'demo') return res.json({ Codigo: 203, Mensaje: 'Ticket no válido.' });
  if (ocupadoV1) return res.json({ Codigo: 10500, Mensaje: 'Lo sentimos. Hemos detectado que existen peticiones simultáneas.' });
  ocupadoV1 = true; await new Promise((r) => setTimeout(r, 30)); ocupadoV1 = false; next();
});
app.get('/v1/ordenesdecompra.json', (req, res) => {
  const map = (o) => ({ Codigo: o.Codigo, Nombre: o.Nombre, CodigoEstado: o.CodigoEstado, Estado: o.Estado, Total: o.Total, TipoMoneda: 'CLP',
    CodigoLicitacion: o.Lic || '', Comprador: { NombreOrganismo: o.Org }, Fechas: { FechaEnvio: local(new Date()).replace(' ', 'T') + ':00' } });
  if (req.query.codigo) return res.json({ Cantidad: 1, Listado: ocs.filter((o) => o.Codigo === req.query.codigo).map(map) });
  res.json({ Cantidad: ocs.length, Listado: ocs.map((o) => ({ Codigo: o.Codigo, Nombre: o.Nombre, CodigoEstado: o.CodigoEstado })) });
});
// Como la API real: solo encuentra el RUT escrito con puntos
app.get('/v1/Empresas/BuscarProveedor', (req, res) => /\./.test(req.query.rutempresaproveedor)
  ? res.json({ Cantidad: 1, listaEmpresas: [{ CodigoEmpresa: '17793', NombreEmpresa: 'Mi Empresa SpA' }] })
  : res.json({ Codigo: 10200, Mensaje: 'No hay resultados de empresas.' }));

// ─── Simulaciones ───
app.post('/__nueva-ca', (req, res) => { crear(Math.floor(Math.random() * 12), 0); const c = Object.values(compras).at(-1); res.json({ codigo: c.codigo, nombre: c.nombre }); });
app.post('/__cerrar', (req, res) => {
  const c = Object.values(compras).find((x) => x.estado.codigo === 'publicada');
  c.estado = { id_estado: 3, codigo: 'cerrada', glosa: 'Cerrada' }; c.fechas.fecha_ultimo_cambio = isoZ(new Date());
  res.json({ codigo: c.codigo });
});
app.post('/__nueva-oc', (req, res) => {
  const o = { Codigo: `${3000 + ocs.length}-${100 + ocs.length}-AG26`, Nombre: 'Guantes de nitrilo', CodigoEstado: 4, Estado: 'Enviada a proveedor', Total: 1_250_000, Org: 'Servicio de Salud Araucanía Sur', Lic: '1057003-77-COT26' };
  ocs.push(o); res.json(o);
});
app.post('/__nueva-oc-se', (req, res) => {
  const o = { Codigo: `${3000 + ocs.length}-${100 + ocs.length}-SE26`, Nombre: 'Licitación grande', CodigoEstado: 4, Estado: 'Enviada a proveedor', Total: 45_000_000, Org: 'Hospital Base', Lic: '1234-5-LP26' };
  ocs.push(o); res.json(o);
});

app.listen(4999, () => console.log('Mock Mercado Público en http://localhost:4999'));
