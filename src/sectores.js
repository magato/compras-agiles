// Clasificación de licitaciones por sector, combinando:
//  1) el código de categoría de los productos (estándar UNSPSC que usa Mercado Público)
//  2) palabras clave en el nombre, la descripción y el organismo comprador.
// Una licitación puede quedar en más de un sector. Edita libremente estas reglas.

const SECTORES = [
  {
    id: 'salud', nombre: 'Salud',
    prefijos: ['42', '51', '85', '4113', '4114', '4115', '4116'],
    palabras: /hospital|salud|cesfam|cecosf|sapu|sar\b|cl[ií]nic|m[eé]dic|f[aá]rmac|medicament|odontol|enfermer|quir[uú]rg|laboratorio cl|ex[aá]men(es)? de|insumos? cl|dializ|oncol|ambulancia|vacuna|cenabast/i,
  },
  {
    id: 'educacion', nombre: 'Educación',
    prefijos: ['86', '60'],
    palabras: /escuela|liceo|colegio|educaci|universidad|junaeb|junji|integra|jard[ií]n infantil|daem|daep|slep|servicio local de educaci|docente|estudiante|alumn|did[aá]ctic|capacitaci|curso|pedag|biblioteca|textos escolares/i,
  },
  {
    id: 'tecnologia', nombre: 'Tecnología',
    prefijos: ['43', '8111', '8112', '8116', '4520', '3212', '3213'],
    palabras: /software|hardware|computa|notebook|laptop|servidor|licencia|inform[aá]tic|tecnolog|redes? de datos|ciberseg|data ?center|nube|cloud|plataforma (web|digital)|desarrollo de (sistema|software|aplicaci)|impresora|tablet|telecomunicaci|fibra [oó]ptica|wifi|cctv|c[aá]maras? de seguridad|digitalizaci/i,
  },
  {
    id: 'construccion', nombre: 'Construcción y obras',
    prefijos: ['30', '72', '22', '95', '8110'],
    palabras: /construcci|obra|reparaci[oó]n de|mejoramiento|pavimenta|habilitaci|conservaci[oó]n de|ampliaci|edificaci|infraestructura|remodelaci|instalaci[oó]n el[eé]ctrica|sanitari/i,
  },
  {
    id: 'alimentacion', nombre: 'Alimentación',
    prefijos: ['50', '9010'],
    palabras: /aliment|v[ií]veres|colaci|casino|catering|coffee|caf[eé]|banquete|raciones|abarrotes|frutas|verduras|carnes/i,
  },
  {
    id: 'aseo', nombre: 'Aseo y mantención',
    prefijos: ['47', '76', '7211'],
    palabras: /aseo|limpieza|higiene|mantenci[oó]n|mantenimiento|jardiner|[aá]reas verdes|fumigaci|sanitizaci|residuos|basura/i,
  },
  {
    id: 'transporte', nombre: 'Transporte y vehículos',
    prefijos: ['25', '78', '15'],
    palabras: /veh[ií]cul|transporte|traslado|camioneta|bus\b|buses|combustible|neum[aá]tic|flete|arriendo de (auto|veh)|taxi/i,
  },
  {
    id: 'oficina', nombre: 'Oficina y mobiliario',
    prefijos: ['44', '14', '56'],
    palabras: /oficina|mobiliario|muebles?|papel|t[oó]ner|escritorio|sillas?|art[ií]culos de escritorio|resma/i,
  },
  {
    id: 'servicios', nombre: 'Servicios profesionales',
    prefijos: ['80', '84', '93', '8114', '8115', '8113'],
    palabras: /consultor|asesor[ií]a|estudio|auditor|dise[ñn]o|evaluaci[oó]n|servicios profesionales|marketing|publicidad|comunicaci[oó]n|legal|jur[ií]dic/i,
  },
  {
    id: 'seguridad', nombre: 'Seguridad',
    prefijos: ['46', '9212'],
    palabras: /seguridad|vigilancia|guardia|alarma|extintor|incendio|uniforme|epp\b|protecci[oó]n personal/i,
  },
  {
    id: 'vestuario', nombre: 'Vestuario y textiles',
    prefijos: ['53', '11'],
    palabras: /vestuario|ropa|calzado|textil|uniformes|ropa de cama/i,
  },
];

function clasificar({ nombre = '', descripcion = '', organismo = '', codigos = [] }) {
  const texto = `${nombre} ${descripcion} ${organismo}`;
  const out = [];
  for (const s of SECTORES) {
    const porCodigo = codigos.some((c) => s.prefijos.some((p) => String(c).startsWith(p)));
    if (porCodigo || s.palabras.test(texto)) out.push(s.id);
  }
  return out.length ? out : ['otros'];
}

module.exports = {
  SECTORES: [...SECTORES.map(({ id, nombre }) => ({ id, nombre })), { id: 'otros', nombre: 'Otros' }],
  clasificar,
};
