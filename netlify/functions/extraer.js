// Netlify Function: recibe el mensaje del usuario, se lo pasa a Gemini con la
// función comparar_gpus y devuelve los dos nombres que extrajo.
// La API key vive solo acá (variable de entorno), nunca llega al navegador.
import { GoogleGenAI } from '@google/genai';
import gpus from '../../public/gpus.json' with { type: 'json' };
import { compararGpusDeclaracion } from '../../src/tools.js';

const MAX_CARACTERES = 300;
// 9 s: menos que los 10 s que espera el navegador y que el límite de 10 s
// de las funciones en el plan gratis de Netlify.
const TIEMPO_MAXIMO_MS = 9000;

// La lista va en la instrucción de sistema para que Gemini normalice cosas como
// "la 9070" a un nombre que exista, y pueda contestar preguntas como "la mejor para 4K".
const INSTRUCCION = `Sos Pixi, la mascota y asistente de WiseGPU, un comparador de tarjetas de video.
Hablás en primera persona, en español rioplatense (vos), con calidez pero corto, y nunca usás emojis.
GPUs disponibles, con marca, precio de salida en USD y FPS promedio en raster (1080p / 1440p / 4K):
${gpus
  .map((g) => `- ${g.nombre} (${g.marca}, $${g.precio_salida_usd}, ${g.fps['1080p']} / ${g.fps['1440p']} / ${g.fps['4k']} FPS)`)
  .join('\n')}
Si el usuario quiere comparar dos GPUs, llamá a comparar_gpus con los nombres exactos de la lista.
Si nombra una GPU que no está en la lista, pasala igual con el nombre que escribió. No la cambies
por una parecida: la "RTX 5060" no es la "RTX 5060 Ti", y la "RTX 3060" tampoco está.
Si describe una GPU por marca y precio juntos, usá las dos cosas: "la AMD de 349" es la marca AMD
con precio $349, o sea la Radeon RX 9060 XT 16GB (no la Arc A770, que también cuesta $349 pero es Intel).
Si pregunta otra cosa sobre estas GPUs (por ejemplo cuál es la mejor para 4K), contestá en una o dos
oraciones usando solo los datos de la lista.
Si el mensaje no tiene que ver con GPUs, contestá en una oración y contale que podés comparar dos tarjetas.`;

// Respuesta JSON con su código HTTP.
function json(datos, status = 200) {
  return Response.json(datos, { status });
}

export default async (req) => {
  if (req.method !== 'POST') return json({ error: 'metodo_no_permitido' }, 405);

  // 1. Validar la entrada antes de gastar cuota.
  let mensaje;
  try {
    ({ mensaje } = await req.json());
  } catch {
    return json({ error: 'json_invalido' }, 400);
  }
  if (typeof mensaje !== 'string' || !mensaje.trim()) return json({ error: 'mensaje_vacio' }, 400);
  if (mensaje.length > MAX_CARACTERES) return json({ error: 'mensaje_muy_largo' }, 400);

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return json({ error: 'falta_api_key' }, 500);

  // 2. Llamar a Gemini con la función declarada.
  try {
    const ai = new GoogleGenAI({ apiKey });
    const respuesta = await ai.models.generateContent({
      model: process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite',
      contents: mensaje.trim(),
      config: {
        systemInstruction: INSTRUCCION,
        tools: [{ functionDeclarations: [compararGpusDeclaracion] }],
        // Extraer dos nombres no necesita "pensar": con MINIMAL responde más rápido.
        thinkingConfig: { thinkingLevel: 'MINIMAL' },
        abortSignal: AbortSignal.timeout(TIEMPO_MAXIMO_MS),
      },
    });

    // 3a. Gemini decidió llamar a la función: devolvemos sus argumentos.
    const llamada = respuesta.functionCalls?.find((f) => f.name === 'comparar_gpus');
    if (llamada) {
      const { gpu_1, gpu_2 } = llamada.args;
      return json({ gpu_1, gpu_2, metodo: 'gemini' });
    }

    // 3b. No era una comparación: devolvemos el texto que respondió.
    return json({ texto: respuesta.text || '', metodo: 'gemini' });
  } catch (error) {
    // Cuota agotada (429 / RESOURCE_EXHAUSTED) o cualquier otro fallo:
    // el navegador va a usar la búsqueda directa.
    const sinCuota = error.status === 429 || String(error.message).includes('RESOURCE_EXHAUSTED');
    console.error('Error de Gemini:', error.message);
    return json({ error: sinCuota ? 'sin_cuota' : 'error_gemini' }, sinCuota ? 429 : 502);
  }
};
