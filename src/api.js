// Decide cómo se sacan los nombres de las GPUs del mensaje del usuario.
// Primero le pregunta a Gemini (vía nuestra Netlify Function). Si falla, se queda
// sin cuota o tarda más de 10 segundos, usa la búsqueda directa para que la demo no se caiga.
import { buscarGpu, detectarEnTexto } from './search.js';

// 10 s: un poco más que los 9 s que la función le da a Gemini.
const ESPERA_MAXIMA_MS = 10000;

export async function extraerGpus(texto, gpus) {
  try {
    const respuesta = await fetch('/api/extraer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mensaje: texto }),
      signal: AbortSignal.timeout(ESPERA_MAXIMA_MS),
    });
    if (!respuesta.ok) throw new Error(`HTTP ${respuesta.status}`);
    const datos = await respuesta.json();

    // Gemini no vio una comparación y contestó con texto.
    if (!datos.gpu_1 && !datos.gpu_2) {
      return { encontradas: [], desconocidas: [], texto: datos.texto, metodo: 'gemini' };
    }

    // Gemini extrajo nombres: los buscamos en la base.
    const encontradas = [];
    const desconocidas = [];
    for (const nombre of [datos.gpu_1, datos.gpu_2].filter(Boolean)) {
      const gpu = buscarGpu(nombre, gpus);
      if (!gpu) desconocidas.push(nombre);
      else if (!encontradas.includes(gpu)) encontradas.push(gpu);
    }
    return { encontradas, desconocidas, metodo: 'gemini' };
  } catch (error) {
    // Fallback: búsqueda directa de alias en el texto.
    console.warn('Gemini no disponible, uso búsqueda directa:', error.message);
    const { encontradas, desconocidas } = detectarEnTexto(texto, gpus);
    return { encontradas, desconocidas, metodo: 'directa' };
  }
}
