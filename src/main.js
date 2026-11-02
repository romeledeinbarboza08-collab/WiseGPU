// UI del chat: carga la base, escucha eventos y dibuja los mensajes.
import './styles.css';
import { extraerGpus } from './api.js';
import { comparar, nombreCorto, formatearNumero } from './compare.js';
import { sugerirParecida } from './search.js';
import { pixi } from './pixi.js';

const mensajes = document.querySelector('#mensajes');
const formulario = document.querySelector('#formulario');
const input = document.querySelector('#texto');
const botonEnviar = document.querySelector('#enviar');
const estado = document.querySelector('#estado');
const listaGpus = document.querySelector('#lista-gpus');
const botonesRes = document.querySelectorAll('#resoluciones button');

const SUGERENCIAS = ['RTX 5070 vs RX 9070 XT', '¿B580 o RX 9060 XT?', 'La mejor para 4K', 'RTX 5090 vs RTX 5080'];

const ETIQUETA_METODO = {
  gemini: 'Extraído por Gemini',
  directa: 'Extraído por búsqueda directa',
};

const ESTADO_METODO = {
  gemini: 'Gemini listo',
  directa: 'Sin conexión con Gemini, usando búsqueda directa',
};

// Check chiquito para el ganador de cada fila.
const ICONO_CHECK = `
  <svg class="check" viewBox="0 0 16 16" width="12" height="12" aria-hidden="true">
    <path d="M3 8.5l3 3 7-7" />
  </svg>`;

let gpus = [];
let resolucion = '1440p';
// Guardamos las comparativas dibujadas para redibujarlas si cambia la resolución.
const comparativas = [];

// ---------- Arranque ----------

async function iniciar() {
  document.querySelector('#logo-pixi').innerHTML = pixi(40);
  const respuesta = await fetch('/gpus.json');
  gpus = await respuesta.json();
  dibujarLista();
  estado.textContent = 'Listo';
  mostrarBienvenida();
}

// Lista del sidebar agrupada por marca.
function dibujarLista() {
  const marcas = [...new Set(gpus.map((g) => g.marca))];
  for (const marca of marcas) {
    const grupo = document.createElement('section');
    grupo.className = 'grupo-marca';
    grupo.innerHTML = `<h3 class="marca">${marca}</h3><ul></ul>`;
    for (const gpu of gpus.filter((g) => g.marca === marca)) {
      const li = document.createElement('li');
      li.innerHTML = `
        <button type="button" class="gpu-item">
          <span class="gpu-nombre">${nombreCorto(gpu)}</span>
          <span class="gpu-precio">$${gpu.precio_salida_usd}</span>
        </button>`;
      li.querySelector('button').addEventListener('click', () => sumarAlInput(gpu.nombre));
      grupo.querySelector('ul').append(li);
    }
    listaGpus.append(grupo);
  }
}

// Pantalla inicial: Pixi grande, saludo y chips de sugerencia.
function mostrarBienvenida() {
  const bienvenida = document.createElement('section');
  bienvenida.className = 'bienvenida';
  bienvenida.innerHTML = `
    ${pixi(96)}
    <h2>¡Hola! Soy Pixi.</h2>
    <p>Te ayudo a encontrar la GPU que más rinde por tu plata. ¿Cuáles querés comparar?</p>
    <div class="chips"></div>`;
  for (const sugerencia of SUGERENCIAS) {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'chip';
    chip.textContent = sugerencia;
    chip.addEventListener('click', () => enviar(sugerencia));
    bienvenida.querySelector('.chips').append(chip);
  }
  mensajes.append(bienvenida);
}

// La bienvenida se va con un fade corto (200 ms) antes del primer mensaje.
async function ocultarBienvenida() {
  const bienvenida = document.querySelector('.bienvenida');
  if (!bienvenida) return;
  bienvenida.classList.add('saliendo');
  await new Promise((listo) => setTimeout(listo, 200));
  bienvenida.remove();
}

// Si el input está vacío arranca la frase; si ya tiene algo, agrega "con la ...".
function sumarAlInput(nombre) {
  const actual = input.value.trim();
  input.value = actual ? `${actual} con la ${nombre}` : `Compará la ${nombre}`;
  cerrarPanel();
  input.focus();
}

// ---------- Eventos ----------

formulario.addEventListener('submit', (evento) => {
  evento.preventDefault();
  enviar(input.value.trim());
});

async function enviar(texto) {
  if (!texto || botonEnviar.disabled) return;
  ocupado(true);
  input.value = '';
  await ocultarBienvenida();

  agregarMensajeUsuario(texto);
  const pensando = mostrarPensando();

  const resultado = await extraerGpus(texto, gpus);

  pensando.remove();
  responder(resultado);
  ocupado(false, resultado.metodo);
}

for (const boton of botonesRes) {
  boton.addEventListener('click', () => {
    resolucion = boton.dataset.res;
    botonesRes.forEach((b) => b.setAttribute('aria-pressed', String(b === boton)));
    // Las comparativas que ya están en pantalla se actualizan con la nueva resolución.
    for (const c of comparativas) c.el.replaceChildren(tarjetaComparativa(c.a, c.b));
  });
}

// Panel lateral en móvil: se abre con el botón "GPUs" y se cierra tocando afuera.
document.querySelector('#abrir-panel').addEventListener('click', () => document.body.classList.add('panel-abierto'));
document.querySelector('#cerrar-panel').addEventListener('click', cerrarPanel);
document.querySelector('#fondo-panel').addEventListener('click', cerrarPanel);

function cerrarPanel() {
  document.body.classList.remove('panel-abierto');
}

function ocupado(si, metodo) {
  botonEnviar.disabled = si;
  estado.textContent = si ? 'Analizando…' : ESTADO_METODO[metodo];
}

// ---------- Lógica de respuesta ----------

function responder({ encontradas, desconocidas, texto, metodo }) {
  // Gemini contestó con texto porque el mensaje no era una comparación (ej. "hola").
  if (texto) {
    agregarTextoBot(texto, metodo);
    return;
  }

  if (encontradas.length >= 2) {
    agregarComparativa(encontradas[0], encontradas[1], metodo);
    return;
  }

  // Alguna GPU no está en la base: decimos cuál y sugerimos una parecida.
  if (desconocidas.length > 0) {
    const frases = desconocidas.map((nombre) => {
      const parecida = sugerirParecida(nombre, gpus);
      // "rtx 3060" (escrito por el usuario) → "RTX 3060"; "GeForce RTX 5060" (de Gemini) queda igual.
      const pedida = nombre === nombre.toLowerCase() ? nombre.toUpperCase() : nombre;
      return parecida
        ? `La ${pedida} no la tengo, ¿quisiste decir ${nombreCorto(parecida)}?`
        : `La ${pedida} no la tengo.`;
    });
    if (frases.some((f) => f.endsWith('tengo.'))) {
      frases.push(`Las que tengo son: ${gpus.map((g) => nombreCorto(g)).join(', ')}.`);
    }
    agregarTextoBot(frases.join(' '), metodo, 'confundido');
    return;
  }

  if (encontradas.length === 1) {
    agregarTextoBot(`Tengo la ${encontradas[0].nombre}. ¿Con cuál la comparo?`, metodo, 'confundido');
    return;
  }

  agregarTextoBot(
    'Me faltan las dos tarjetas para comparar. Probá con algo como "RTX 5070 vs RX 9070 XT".',
    metodo,
    'confundido'
  );
}

// ---------- Render de mensajes ----------

function agregarMensajeUsuario(texto) {
  const div = document.createElement('div');
  div.className = 'msg msg-usuario';
  div.textContent = texto; // textContent: lo que escribe el usuario nunca se interpreta como HTML
  agregar(div);
}

// Crea un mensaje de Pixi (avatar + cuerpo) y devuelve el cuerpo para llenarlo.
function agregarMensajeBot(expresion = 'normal') {
  const div = document.createElement('div');
  div.className = 'msg msg-bot';
  div.innerHTML = `${pixi(32, expresion)}<div class="msg-cuerpo"></div>`;
  agregar(div);
  return div.querySelector('.msg-cuerpo');
}

function agregarTextoBot(texto, metodo, expresion = 'normal') {
  const cuerpo = agregarMensajeBot(expresion);
  const p = document.createElement('p');
  p.textContent = texto; // puede traer nombres que escribió el usuario
  cuerpo.append(p, etiquetaMetodo(metodo));
  desplazarAbajo();
}

// Pixi "pensando" con tres puntos mientras esperamos a Gemini.
function mostrarPensando() {
  const cuerpo = agregarMensajeBot('pensando');
  cuerpo.innerHTML = `
    <span class="escribiendo" role="status">
      <span></span><span></span><span></span>
      <span class="solo-lectores">Analizando…</span>
    </span>`;
  desplazarAbajo();
  return cuerpo.parentElement;
}

function agregarComparativa(a, b, metodo) {
  const cuerpo = agregarMensajeBot('feliz');
  const intro = document.createElement('p');
  intro.textContent = 'Listo, acá está la comparación.';
  const contenedor = document.createElement('div');
  contenedor.append(tarjetaComparativa(a, b));
  cuerpo.append(intro, contenedor, etiquetaMetodo(metodo));
  comparativas.push({ el: contenedor, a, b });
  // La tarjeta es alta: mostramos su principio (las dos GPUs), no el final.
  cuerpo.parentElement.scrollIntoView({ block: 'start' });
}

function etiquetaMetodo(metodo) {
  const p = document.createElement('p');
  p.className = 'metodo';
  p.textContent = ETIQUETA_METODO[metodo];
  return p;
}

function agregar(elemento) {
  mensajes.append(elemento);
  desplazarAbajo();
}

function desplazarAbajo() {
  mensajes.scrollTop = mensajes.scrollHeight;
}

// ---------- Comparativa tipo "duelo" ----------
// Solo usa datos de gpus.json, nunca texto del usuario, así que es seguro armarla con innerHTML.

function tarjetaComparativa(a, b) {
  const comp = comparar(a, b, resolucion);
  const tarjeta = document.createElement('article');
  tarjeta.className = 'tarjeta';
  tarjeta.innerHTML = `
    <header class="duelo-cabecera">
      ${cabeceraGpu(a, 'a')}
      <span class="vs">VS</span>
      ${cabeceraGpu(b, 'b')}
    </header>
    <div class="duelo-filas">
      ${comp.filas.map((fila) => filaDuelo(fila, a, b)).join('')}
    </div>
    <footer class="veredicto">
      ${pixi(32, 'feliz')}
      <p>${comp.veredicto}</p>
    </footer>`;
  return tarjeta;
}

// Cada GPU con la franja de su marca, el nombre y el precio.
function cabeceraGpu(gpu, lado) {
  return `
    <div class="duelo-gpu lado-${lado} franja-${gpu.marca.toLowerCase()}">
      <span class="marca">${gpu.marca}</span>
      <span class="duelo-nombre">${nombreCorto(gpu)}</span>
      <span class="duelo-precio">${conUnidad(gpu.precio_salida_usd, { decimales: 0, prefijo: '$' })}</span>
    </div>`;
}

// Una fila: valor de la GPU 1, métrica al centro, valor de la GPU 2 y las dos barras.
function filaDuelo(fila, a, b) {
  const max = Math.max(fila.a, fila.b);
  const barra = (gpu, lado) =>
    `<span class="pista pista-${lado}">
       <span class="barra fondo-${gpu.marca.toLowerCase()}" style="width:${(fila[lado] / max) * 100}%"></span>
     </span>`;
  return `
    <div class="duelo-fila">
      ${valorDuelo(fila, 'a')}
      <span class="duelo-metrica">${fila.metrica}</span>
      ${valorDuelo(fila, 'b')}
      <div class="duelo-barras">${barra(a, 'a')}${barra(b, 'b')}</div>
    </div>`;
}

// El ganador va en negrita, con check y la ventaja en % debajo.
function valorDuelo(fila, lado) {
  const gana = fila.ganador === lado;
  const signo = fila.mayorEsMejor ? '+' : '−';
  const ventaja = gana ? `<span class="ventaja">${signo}${formatearNumero(fila.ventaja, 1)}%</span>` : '';
  return `
    <div class="duelo-valor lado-${lado}${gana ? ' gana' : ''}">
      <span class="duelo-numero">${gana ? ICONO_CHECK : ''}${conUnidad(fila[lado], fila)}</span>
      ${ventaja}
    </div>`;
}

// "155,4 FPS" o "$549": el número grande y la unidad chica y en gris.
function conUnidad(valor, { decimales, unidad, prefijo }) {
  const numero = formatearNumero(valor, decimales);
  if (prefijo) return `<span><small class="unidad">${prefijo}</small>${numero}</span>`;
  return `<span>${numero} <small class="unidad">${unidad}</small></span>`;
}

iniciar();
