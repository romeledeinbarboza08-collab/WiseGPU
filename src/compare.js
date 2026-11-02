// Arma la comparativa entre dos GPUs: calcula las métricas, decide quién gana cada fila
// y escribe el veredicto de Pixi. No toca el HTML; solo devuelve datos para main.js.

export const RESOLUCIONES = { '1080p': '1080p', '1440p': '1440p', '4k': '4K' };

// Nombre sin "GeForce"/"Radeon": la marca ya se muestra aparte.
export function nombreCorto(gpu) {
  return gpu.nombre.replace(/^(GeForce|Radeon) /, '');
}

// Número con coma decimal y punto de miles, como se escribe en Argentina: 1.999 / 155,4
export function formatearNumero(valor, decimales) {
  return valor.toLocaleString('es-AR', {
    minimumFractionDigits: decimales,
    maximumFractionDigits: decimales,
  });
}

// Cuánto mejor es el ganador que el perdedor, en %, redondeado a un decimal.
// Si conviene un número alto (FPS): cuánto más tiene. Si conviene bajo (precio): cuánto menos.
function ventaja(ganador, perdedor, mayorEsMejor) {
  const pct = mayorEsMejor ? (ganador / perdedor - 1) * 100 : (1 - ganador / perdedor) * 100;
  return Math.round(pct * 10) / 10;
}

export function comparar(a, b, res) {
  const fpsA = a.fps[res];
  const fpsB = b.fps[res];

  // Cada fila dice si en esa métrica conviene un número alto o bajo.
  const filas = [
    { metrica: `FPS en ${RESOLUCIONES[res]}`, a: fpsA, b: fpsB, mayorEsMejor: true, decimales: 1, unidad: 'FPS' },
    {
      metrica: 'FPS por cada $100',
      a: (fpsA / a.precio_salida_usd) * 100,
      b: (fpsB / b.precio_salida_usd) * 100,
      mayorEsMejor: true,
      decimales: 1,
      unidad: 'FPS',
    },
    { metrica: 'FPS por watt', a: fpsA / a.tdp_w, b: fpsB / b.tdp_w, mayorEsMejor: true, decimales: 2, unidad: 'FPS' },
    { metrica: 'VRAM', a: a.vram_gb, b: b.vram_gb, mayorEsMejor: true, decimales: 0, unidad: 'GB' },
    { metrica: 'TDP', a: a.tdp_w, b: b.tdp_w, mayorEsMejor: false, decimales: 0, unidad: 'W' },
    {
      metrica: 'Precio',
      a: a.precio_salida_usd,
      b: b.precio_salida_usd,
      mayorEsMejor: false,
      decimales: 0,
      prefijo: '$',
    },
  ].map((fila) => {
    const ganador = ganadorDe(fila);
    const perdedor = ganador === 'a' ? 'b' : 'a';
    return {
      ...fila,
      ganador,
      ventaja: ganador ? ventaja(fila[ganador], fila[perdedor], fila.mayorEsMejor) : 0,
    };
  });

  return { a, b, res, filas, veredicto: veredicto(a, b, filas) };
}

// 'a', 'b' o null si empatan.
function ganadorDe({ a, b, mayorEsMejor }) {
  if (a === b) return null;
  return a > b === mayorEsMejor ? 'a' : 'b';
}

// Ej: "La RTX 5070 Ti rinde 131,6% más, pero la Arc A770 cuesta $400 menos.
//      Por cada $100, gana la RTX 5070 Ti."
// El % es el mismo número (y el mismo redondeo) que muestra la fila de FPS.
function veredicto(a, b, filas) {
  const [fps, porCadaCien] = filas;
  const precio = filas[filas.length - 1];
  const nombre = { a: nombreCorto(a), b: nombreCorto(b) };

  let texto = fps.ganador
    ? `La ${nombre[fps.ganador]} rinde ${formatearNumero(fps.ventaja, 1)}% más`
    : `La ${nombre.a} y la ${nombre.b} rinden igual`;

  const diferencia = Math.abs(a.precio_salida_usd - b.precio_salida_usd);
  const plata = `$${formatearNumero(diferencia, 0)}`;
  if (!precio.ganador) texto += ' y cuestan lo mismo.';
  else if (precio.ganador === fps.ganador) texto += ` y encima cuesta ${plata} menos.`;
  else texto += `, pero la ${nombre[precio.ganador]} cuesta ${plata} menos.`;

  texto += porCadaCien.ganador
    ? ` Por cada $100, gana la ${nombre[porCadaCien.ganador]}.`
    : ' Por cada $100, empatan.';

  return texto;
}
