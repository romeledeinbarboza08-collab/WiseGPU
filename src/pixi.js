// Pixi, la mascota de WiseGPU: un chip naranja con ojos.
// Es un SVG inline; las expresiones se hacen con CSS (styles.css), cambiando solo los ojos.
//   normal     → parpadea cada tanto
//   pensando   → mira hacia arriba a un lado (mientras espera a Gemini)
//   feliz      → ojos en forma de ^ ^ (cuando sale la comparativa)
//   confundido → un ojo más chico (cuando no encuentra una GPU)

const SVG = `
  <svg viewBox="0 0 64 64" aria-hidden="true">
    <rect class="pixi-fondo" width="64" height="64" rx="14" />
    <!-- Pines del chip: son sus "pelitos". El del medio de arriba es más largo. -->
    <path class="pixi-pines" d="M24 9v6M32 6v9M40 9v6M24 49v6M32 49v6M40 49v6M9 24h6M9 32h6M9 40h6M49 24h6M49 32h6M49 40h6" />
    <rect class="pixi-chip" x="15" y="15" width="34" height="34" rx="7" />
    <rect class="pixi-nucleo" x="20" y="21" width="24" height="21" rx="5" />
    <g class="pixi-ojos">
      <g class="pixi-ojo pixi-ojo-izq">
        <ellipse class="pixi-blanco" cx="27" cy="30" rx="3.6" ry="4.4" />
        <circle class="pixi-pupila" cx="27.4" cy="30.8" r="2" />
      </g>
      <g class="pixi-ojo pixi-ojo-der">
        <ellipse class="pixi-blanco" cx="37" cy="30" rx="3.6" ry="4.4" />
        <circle class="pixi-pupila" cx="37.4" cy="30.8" r="2" />
      </g>
    </g>
    <path class="pixi-ojos-felices" d="M23.8 31.5L27 28l3.2 3.5M33.8 31.5L37 28l3.2 3.5" />
    <path class="pixi-boca" d="M29.5 37.2q2.5 2 5 0" />
  </svg>`;

// Devuelve el HTML de Pixi en el tamaño (px) y la expresión pedidos.
export function pixi(tamano = 32, expresion = 'normal') {
  return `<span class="pixi pixi--${expresion}" style="width:${tamano}px;height:${tamano}px">${SVG}</span>`;
}
