// Declaración de la función que Gemini puede "llamar".
// Gemini no ejecuta nada: solo devuelve el nombre de la función y los argumentos
// que sacó del mensaje. La búsqueda real la hace nuestro código.
export const compararGpusDeclaracion = {
  name: 'comparar_gpus',
  description:
    'Compara dos tarjetas de video. Usar cuando el usuario quiere comparar o elegir entre dos GPUs.',
  parametersJsonSchema: {
    type: 'object',
    properties: {
      gpu_1: {
        type: 'string',
        description: 'Nombre de la primera GPU, tal como figura en la lista de disponibles.',
      },
      gpu_2: {
        type: 'string',
        description: 'Nombre de la segunda GPU, tal como figura en la lista de disponibles.',
      },
    },
    required: ['gpu_1', 'gpu_2'],
  },
};
