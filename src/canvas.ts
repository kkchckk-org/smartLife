/** Canvas管理: 初期化、リサイズ、DPI対応 */

let canvas: HTMLCanvasElement;
let ctx: CanvasRenderingContext2D;

export function initCanvas(el: HTMLCanvasElement): CanvasRenderingContext2D {
  canvas = el;
  ctx = canvas.getContext('2d')!;
  resize();
  window.addEventListener('resize', resize);
  return ctx;
}

export function resize() {
  const dpr = window.devicePixelRatio || 1;
  canvas.width = window.innerWidth * dpr;
  canvas.height = window.innerHeight * dpr;
  ctx.scale(dpr, dpr);
}

export function clear() {
  ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
}

export function getSize() {
  return { width: window.innerWidth, height: window.innerHeight };
}
