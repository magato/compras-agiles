// Exclusión de Compras Ágiles por palabras (botón "Excluir palabras vetadas" del sitio).
// Al publicar, cada compra cuyo título, nombre de la institución (organismo o unidad de
// compra), descripción o productos solicitados contenga alguna de estas palabras queda
// MARCADA con la palabra encontrada. Nada se borra: el botón del sitio decide si se ocultan. No distingue mayúsculas, minúsculas ni acentos ("Fármaco" = "farmaco").
//
// Se compara por palabra completa, aceptando el plural: "servicio" también excluye
// "servicios", y "hospital" excluye "hospitales", pero "salud" NO excluye "saludable".
//
// Para cambiar la lista sin tocar el código, crea la variable EXCLUIR_PALABRAS en GitHub
// (Settings → Secrets and variables → Actions → Variables) con las palabras separadas por
// coma. Con el valor  -  (un guion) no se marca ninguna compra y el botón no aparece.

const PALABRAS_POR_DEFECTO = [
  'arriendo', 'servicio', 'droga', 'drogueria', 'farmaco', 'farmacos', 'complejo asistencial',
  'cirugia', 'cirugias', 'salud', 'hospital', 'medicamentos', 'urgencia', 'cesfam',
];

// Minúsculas y sin acentos (la ñ se mantiene)
function normalizar(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/ñ/g, '\u0001')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/\u0001/g, 'ñ');
}

const escapar = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function leerPalabras(valor) {
  if (valor === undefined || valor === null || String(valor).trim() === '') return PALABRAS_POR_DEFECTO;
  if (String(valor).trim() === '-') return [];
  return String(valor).split(/[,\n;]/).map((s) => s.trim()).filter(Boolean);
}

function crearFiltro(palabras) {
  const lista = [...new Set(palabras.map(normalizar).map((p) => p.trim()).filter(Boolean))];
  if (!lista.length) return { activo: false, palabras: [], excluye: () => null };
  // Límite de palabra con letras en español: (?<![a-zñ0-9]) ... (?![a-zñ0-9])
  const patrones = lista.map((p) => ({
    palabra: p,
    re: new RegExp(`(?<![a-zñ0-9])${escapar(p).replace(/\s+/g, '\\s+')}(?:s|es)?(?![a-zñ0-9])`),
  }));
  // Devuelve la palabra que provocó la exclusión, o null si la compra se publica
  function excluye(c) {
    const d = c.detalle || {};
    const texto = normalizar([
      c.nombre, c.organismo, c.unidad, d.descripcion,
      ...(d.productos || []).flatMap((p) => [p.nombre, p.descripcion]),
    ].filter(Boolean).join(' \n '));
    for (const { palabra, re } of patrones) if (re.test(texto)) return palabra;
    return null;
  }
  return { activo: true, palabras: lista, excluye };
}

module.exports = { PALABRAS_POR_DEFECTO, normalizar, leerPalabras, crearFiltro };
