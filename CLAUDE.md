# CLAUDE.md — WiseGPU, chatbot comparador de GPUs (parcial)

## Qué es el proyecto

Un chatbot web que replica la función de comparación de https://www.michaelpcmaster.com/comparar/.
El usuario escribe en lenguaje natural ("Quiero comparar una RTX 5070 y una RX 9070 XT"),
Gemini (API de Google AI Studio) extrae los dos nombres por *function calling*, el código
busca esas GPUs en una base de datos fija (JSON) y el chatbot devuelve una comparativa
limpia con métricas calculadas como "FPS por cada $100".

Es un parcial universitario. El código tiene que ser simple, legible y fácil de defender
frente al profesor. Nada de sobre-ingeniería, nada de librerías que no se usen.

## Restricciones importantes

- Tiene que desplegarse en **Netlify** y funcionar perfecto en la web, en cualquier
  navegador y en celular.
- **Todo gratis:** plan gratuito de Netlify + free tier de la API de Gemini. Nada que
  pida tarjeta de crédito.
- **La API key NUNCA va en el frontend.** Vive como variable de entorno en Netlify
  (`GEMINI_API_KEY`) y solo la usa una Netlify Function. El navegador llama a
  `/api/extraer` y la función es la que habla con Google.
- La base de datos está "hardcodeada" en un JSON. La interfaz debe mostrar
  qué GPUs están disponibles para que el profesor sepa qué probar.

## Stack

- **Vite + JavaScript vanilla** (sin React, sin TypeScript) — HTML, CSS y JS puro.
- **Netlify Functions** (JavaScript, Node) como backend mínimo: una sola función.
- **SDK oficial `@google/genai`** dentro de la función para llamar a Gemini con
  function calling nativo (`tools` + `functionDeclarations`).
- **Modelo:** un Gemini del free tier con function calling, por defecto
  `gemini-3.5-flash-lite` (rápido y gratis; en noviembre 2026 el `3.1-flash-lite` daba
  muchos 503 por alta demanda). El nombre va en la variable de entorno
  `GEMINI_MODEL` para poder cambiarlo sin tocar código. Antes de programar, confirmar
  en https://ai.google.dev/gemini-api/docs/models el ID exacto vigente y que tenga free tier
  (los modelos 2.5 ya fueron retirados en octubre 2026, no usarlos).
- **Netlify CLI** (`netlify dev`) para probar local con la función y las variables de entorno.

Antes de escribir la función, revisar la documentación actual de function calling de
Gemini (https://ai.google.dev/gemini-api/docs/function-calling) y del SDK `@google/genai`.
No adivinar la forma de la respuesta.

## Estructura

```
/
├── index.html
├── netlify.toml
├── package.json
├── .env.example           # GEMINI_API_KEY= y GEMINI_MODEL= (el .env real va en .gitignore)
├── netlify/
│   └── functions/
│       └── extraer.js     # recibe el mensaje, llama a Gemini con la tool, devuelve gpu_1/gpu_2
├── public/
│   └── gpus.json          # base de datos fija
└── src/
    ├── main.js            # UI del chat, eventos, render de mensajes
    ├── api.js             # fetch a /api/extraer + fallback si falla
    ├── tools.js           # definición de la función comparar_gpus (schema)
    ├── search.js          # normaliza nombres y busca en gpus.json
    ├── compare.js         # calcula métricas, ganadores y el veredicto
    ├── pixi.js            # SVG de Pixi, la mascota, en distintos tamaños y expresiones
    └── styles.css
```

Cada archivo hace una sola cosa. Comentarios cortos en español explicando el *por qué*.

## Base de datos (public/gpus.json)

Entre 8 y 12 GPUs, tomadas de la página original (el usuario copia los datos reales;
NO inventar números). Formato:

```json
[
  {
    "id": "rx-9070-xt",
    "nombre": "Radeon RX 9070 XT",
    "marca": "AMD",
    "alias": ["rx 9070 xt", "9070 xt", "9070xt"],
    "vram_gb": 0,
    "tdp_w": 0,
    "precio_salida_usd": 0,
    "fps": {
      "1080p": 0,
      "1440p": 0,
      "4k": 0
    }
  }
]
```

Los ceros son placeholders hasta que se llenen con los datos de michaelpcmaster.com.

## Flujo del chatbot

1. **Entrada:** el usuario escribe en el chat.
2. **Function calling:** el frontend manda el mensaje a `/api/extraer`. La Netlify
   Function se lo pasa a Gemini junto con la declaración de
   `comparar_gpus(gpu_1: string, gpu_2: string)` y una instrucción de sistema que
   incluye la lista de nombres disponibles (para que normalice "la 9070" → "RX 9070 XT").
   Gemini responde con un `functionCall` y sus `args`; la función devuelve
   `{ gpu_1, gpu_2, metodo: "gemini" }` al navegador.
   Si el mensaje no es una comparación (ej. "hola"), Gemini responde texto normal y se
   muestra tal cual, corto.
3. **Filtrado:** `search.js` normaliza los nombres (minúsculas, sin espacios extra,
   sin "nvidia"/"amd"/"geforce"/"radeon") y los compara contra `nombre` y `alias`.
4. **Respuesta:** `compare.js` arma la comparativa en formato "duelo" (ver diseño):
   FPS por resolución, VRAM, TDP, precio, **FPS por cada $100** (`fps / precio * 100`)
   y **FPS por watt**. Indica cuál gana en cada fila, con su ventaja en %, y arma el
   veredicto de Pixi.

### Casos que hay que manejar

- El modelo no detecta dos GPUs → pedirle al usuario que escriba dos nombres.
- Una GPU no está en la base → decir cuál no se encontró y sugerir la más parecida
  (misma gama, ej. "3060" → "5060 Ti"); si no hay ninguna parecida, listar las disponibles.
  Pixi pone cara de confundido.
- Esperando respuesta de la API → indicador "escribiendo" del bot en el chat,
  estado "Analizando…" y botón deshabilitado.
- Tiempos: la función le da a Gemini **9 s** y el navegador espera **10 s** como máximo.
  No pasarse de 10 s: es el límite de las funciones en el plan gratis de Netlify.
- La API falla, se acaba la cuota (error 429 / RESOURCE_EXHAUSTED) o tarda más de
  10 segundos → **fallback:** búsqueda directa de alias en el texto, para que la demo
  nunca se caiga. Mostrar en la UI qué método se usó
  ("Extraído por Gemini" vs "Extraído por búsqueda directa").
- La función valida la entrada (texto no vacío, máximo 300 caracteres) antes de
  llamar a Gemini, para no gastar cuota con basura.

## UI

- **Sidebar izquierdo oscuro** con el logo (Pixi + wordmark "WiseGPU" + tagline) arriba,
  la **lista de GPUs disponibles agrupada por marca** (clic en una la agrega al input) y
  abajo el **selector de resolución** (1080p / 1440p / 4K) que afecta las métricas.
  En móvil el sidebar se esconde detrás de un botón.
- **Área de chat** a la derecha ocupando toda la altura, con el input fijo abajo.
- **Bienvenida** (sin mensajes): pantalla centrada en el área del chat con Pixi grande,
  saludo y 4 chips de sugerencia. Desaparece con un fade corto al mandar el primer mensaje.
- Indicador de estado del modelo (cargando / listo / usando fallback).

## Marca e identidad

- Producto: **WiseGPU**. Tagline: **"Compare smarter."**
- El bot se llama **Pixi** y es la mascota de WiseGPU.
- **Pixi** es el ícono de chip convertido en personaje: cuadro oscuro redondeado, chip
  naranja, dos ojitos blancos ovalados con pupila oscura dentro del núcleo del chip y
  una boquita pequeña. Los pines del chip son sus "pelitos". Estilo caricatura simple,
  trazo limpio, sin 3D ni gradientes.
- SVG inline en `src/pixi.js`, con una función que lo devuelve en distintos tamaños:
  32px en los mensajes, 40px en el logo del sidebar y 96px en la bienvenida.
- **Expresiones** con CSS, cambiando solo los ojos:
  - normal: parpadea cada 4-5 segundos;
  - pensando: mientras espera a Gemini, los ojos miran hacia arriba a un lado y
    aparecen los tres puntitos;
  - feliz: ojos en forma de ^ ^ cuando sale la comparativa;
  - confundido: un ojo más pequeño cuando no encuentra una GPU.
- Todas las animaciones respetan `prefers-reduced-motion`: si el usuario las tiene
  apagadas, no se anima nada.
- **Voz de Pixi:** primera persona, cálida pero breve, sin emojis. Ejemplos:
  "Listo, acá está la comparación", "La RTX 5060 no la tengo, ¿quisiste decir RTX 5060 Ti 16GB?".
  La instrucción de sistema de Gemini le dice que es Pixi, el asistente de WiseGPU.

## Diseño visual (MUY IMPORTANTE)

La interfaz tiene que verse hecha a mano por un diseñador, como una herramienta
de reviews de hardware con personalidad propia. Cero estética "generada por IA" o
"vibe-coded".

### Dirección

Sidebar oscuro como "panel de control" con una textura sutil de circuito, área de chat
clara con fondo cálido, un solo color de acento y una mascota simple que le da
calidez. La información manda, no la decoración.

### Paleta (usar solo estos colores, definidos como variables CSS)

```css
:root {
  --sidebar:      #1B2130;  /* fondo del sidebar y de Pixi */
  --sidebar-ink:  #E6E8EC;  /* texto del sidebar */
  --sidebar-soft: #8F98A8;  /* texto secundario del sidebar */
  --sidebar-line: #2C3446;  /* divisores del sidebar */
  --bg:        #F6F5F1;  /* fondo cálido del chat */
  --surface:   #FFFFFF;  /* tarjetas */
  --ink:       #17191C;  /* texto principal */
  --ink-soft:  #5E636B;  /* texto secundario y unidades */
  --line:      #D8D4CC;  /* bordes y divisores */
  --line-soft: #ECEAE4;  /* fondos suaves (pista de las barras) */
  --accent:    #E0552B;  /* naranja: botón, foco, ganador, chip de Pixi */
  --accent-bg: #FCEBE4;  /* fondo suave del acento */
  /* Colores de marca: franja de cada GPU y barras del duelo */
  --nvidia: #76B900;
  --amd:    #ED1C24;
  --intel:  #0071C5;
}
```

- Nada de verdes/rojos para ganador/perdedor: el ganador de cada fila va en negrita
  con un check pequeño en `--accent`.
- Las marcas (NVIDIA/AMD/Intel) se muestran como texto pequeño en mayúsculas. Sus
  colores solo aparecen en la franja de cada GPU y en las barras del duelo.
- Fondo del sidebar con una textura de líneas de circuito en SVG, opacidad 4%.

### Tipografía

- **Figtree** (Google Fonts, pesos 400, 500, 600, 700) para todo. Nada de fuentes mono.
- Wordmark "WiseGPU" en Figtree 700 con `letter-spacing: -0.02em`; "GPU" en `--accent`.
- Números siempre con `font-variant-numeric: tabular-nums`. Los números grandes en 600
  y la unidad (FPS, W, GB, $) más pequeña y en `--ink-soft`: "155,4 FPS".
- Nombres de GPU en Figtree 600.
- Escala: 12 / 14 / 16 / 20 / 28 px. Títulos en 600 o 700, nunca en 800/900.
- Etiquetas de sección en mayúsculas, 12px, `letter-spacing: 0.06em`.

### Layout

- Desktop: sidebar oscuro fijo a la izquierda (~280px) y chat a la derecha a toda
  la altura de la pantalla, con el input fijo abajo.
- Móvil: el sidebar se esconde y se abre como panel desde un botón en la barra de arriba.
- Alineado a la izquierda, salvo la bienvenida, que va centrada en el área del chat.
- Espaciado en múltiplos de 8px.
- Bordes de 1px con `--line` en lugar de sombras. Tarjetas con `border-radius` de 12px;
  botones y chips de 8px; burbujas del usuario de 12px.
- Mensajes del bot: Pixi a la izquierda, texto y tarjetas sin burbuja.
- Mensajes del usuario: burbuja con fondo `--accent-bg`, alineada a la derecha.

### Comparativa ("duelo")

- Arriba, las dos GPUs enfrentadas con un "VS" pequeño en el centro; cada una con su
  franja de marca, el nombre y el precio.
- Debajo, una fila por métrica: valor de la GPU 1 a la izquierda, nombre de la métrica
  centrado, valor de la GPU 2 a la derecha. Debajo de cada fila, dos barras que crecen
  desde el centro hacia afuera, en el color de marca de cada GPU.
- Métricas: FPS (según la resolución elegida), FPS por cada $100, FPS por watt, VRAM,
  TDP y precio.
- El ganador de cada fila va en negrita con un check pequeño, y debajo del valor
  ganador la ventaja en texto ("+131,6%", o "−53,4%" en las métricas donde menos es mejor).
  No hay columna de diferencia.
- Al final, el veredicto de Pixi (feliz): "La RTX 5070 Ti rinde 131,6% más, pero la
  Arc A770 cuesta $400 menos. Por cada $100, gana la RTX 5070 Ti." El porcentaje sale
  del mismo cálculo y con el mismo redondeo (un decimal) que el de las filas.
- Las barras se animan de 0 a su valor en 400 ms al aparecer.

### Prohibido (señales de "AI slop")

- Gradientes de cualquier tipo, sobre todo morado/azul/rosado.
- Glassmorphism, blur, brillos, sombras de colores, `box-shadow` grandes.
- Emojis en la interfaz o en las respuestas del bot. Íconos de ✨ o 🤖 (Pixi es un chip,
  no un robot).
- Textos tipo "Powered by AI", "Your smart assistant", "Unlock the power of...".
- Botones tipo píldora.
- Fuentes por defecto de IA: Inter, Poppins, Space Grotesk, Montserrat.
- Animaciones innecesarias. Solo: transiciones de 150ms en hover/focus, la apertura
  del sidebar en móvil, el fade de la bienvenida, las expresiones de Pixi, los tres
  puntos de "pensando" y el crecimiento de las barras (400 ms).
- Frameworks de UI (Tailwind, Bootstrap, shadcn). CSS propio en `styles.css`.

### Microcopy

Español sencillo y directo, como lo escribiría una persona:
- Nombre: "WiseGPU" — tagline: "Compare smarter."
- Bienvenida: "¡Hola! Soy Pixi." / "Te ayudo a encontrar la GPU que más rinde por tu
  plata. ¿Cuáles querés comparar?"
- Chips: "RTX 5070 vs RX 9070 XT", "¿B580 o RX 9060 XT?", "La mejor para 4K",
  "RTX 5090 vs RTX 5080".
- Placeholder: "Ej: compará la RTX 5070 con la RX 9070 XT"
- Estado: "Analizando…", "Extraído por Gemini", "Sin conexión con Gemini, usando búsqueda directa".

## Deploy

`netlify.toml`:

```toml
[build]
  command = "npm run build"
  publish = "dist"
  functions = "netlify/functions"

[[redirects]]
  from = "/api/*"
  to = "/.netlify/functions/:splat"
  status = 200
```

En Netlify: Site configuration → Environment variables → agregar `GEMINI_API_KEY`
(sacada gratis de https://aistudio.google.com/apikey) y `GEMINI_MODEL`.

## Forma de trabajar

- Ir por fases y esperar confirmación antes de pasar a la siguiente:
  1. Scaffold con Vite + gpus.json con datos de ejemplo + búsqueda y comparativa
     funcionando SIN modelo (solo con el fallback).
  2. Netlify Function + Gemini function calling, probado con `netlify dev`.
  3. UI final y manejo de errores.
  4. Deploy a Netlify.
- Después de cada fase, explicar en pocas palabras qué se hizo y cómo probarlo.
- Código que un estudiante pueda explicar línea por línea.
