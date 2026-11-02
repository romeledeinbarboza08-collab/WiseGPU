// Búsqueda de GPUs en la base fija. No usa IA: es la "búsqueda directa"
// que sirve como fallback cuando Gemini no está disponible.

// Palabras de marca que no ayudan a identificar el modelo: se borran antes de comparar.
const RUIDO = ['nvidia', 'amd', 'intel', 'geforce', 'radeon'];

// Patrón de algo que "parece" una GPU (ej. "rtx 3060", "rx 6600 xt", "4090").
// Sirve para avisar qué tarjeta pidió el usuario que no está en la base.
const PARECE_GPU = /\b(?:(?:rtx|gtx|rx|arc) ?[a-z]?\d{3,4}|\d{4})(?: ?(?:ti|xtx|xt|super|gre))?\b/g;

// Pasa el texto a una forma comparable: minúsculas, sin signos, sin marcas, espacios simples.
export function normalizar(texto) {
  let t = texto.toLowerCase().replace(/[^a-z0-9áéíóúñ ]/g, ' ');
  for (const palabra of RUIDO) {
    t = t.replace(new RegExp(`\\b${palabra}\\b`, 'g'), ' ');
  }
  return t.replace(/\s+/g, ' ').trim();
}

// Todas las formas en que se puede nombrar una GPU, ya normalizadas.
function variantes(gpu) {
  return [gpu.nombre, ...gpu.alias].map(normalizar);
}

// Busca las GPUs mencionadas dentro de un texto libre.
// Devuelve las encontradas (en el orden en que aparecen) y las que parecen GPU pero no están.
export function detectarEnTexto(texto, gpus) {
  // Espacios a los costados para poder buscar " alias " como palabra completa.
  let resto = ` ${normalizar(texto)} `;
  const hallazgos = [];

  // Primero los alias más largos: así "9070 xt" se reconoce antes que "9070".
  const pares = gpus
    .flatMap((gpu) => variantes(gpu).map((alias) => ({ gpu, alias })))
    .sort((x, y) => y.alias.length - x.alias.length);

  for (const { gpu, alias } of pares) {
    const pos = resto.indexOf(` ${alias} `);
    if (pos === -1) continue;
    hallazgos.push({ gpu, pos });
    // Tapamos lo encontrado con espacios para que un alias más corto no lo vuelva a usar.
    const inicio = pos + 1;
    resto = resto.slice(0, inicio) + ' '.repeat(alias.length) + resto.slice(inicio + alias.length);
  }

  // Ordenamos por posición en el texto y sacamos repetidas.
  hallazgos.sort((x, y) => x.pos - y.pos);
  const encontradas = [];
  for (const { gpu } of hallazgos) {
    if (!encontradas.includes(gpu)) encontradas.push(gpu);
  }

  // Lo que sobró y tiene pinta de GPU es algo que no tenemos en la base.
  const desconocidas = resto.match(PARECE_GPU) || [];

  return { encontradas, desconocidas };
}

// Para una GPU que no tenemos, sugiere una parecida de la misma gama:
// primero una con el mismo número; si no, una que termine igual ("3060" → "5060 Ti").
export function sugerirParecida(nombre, gpus) {
  const numero = normalizar(nombre).match(/\d{3,4}/)?.[0];
  if (!numero) return null;
  const gama = numero.slice(-2);
  const numeroDe = (gpu) => gpu.nombre.match(/\d{3,4}/)?.[0] || '';
  return (
    gpus.find((gpu) => numeroDe(gpu) === numero) ||
    gpus.find((gpu) => numeroDe(gpu).endsWith(gama)) ||
    null
  );
}

// Busca una sola GPU a partir de un nombre (el que extrajo Gemini).
export function buscarGpu(nombre, gpus) {
  const buscado = normalizar(nombre);
  const exacta = gpus.find((gpu) => variantes(gpu).includes(buscado));
  if (exacta) return exacta;
  return detectarEnTexto(nombre, gpus).encontradas[0] || null;
}
