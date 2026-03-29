/** タッチ/マウス入力の抽象化 */

export interface Pointer {
  x: number;
  y: number;
  pressure: number;
  timestamp: number;
}

type PointerCallback = (pointer: Pointer) => void;

let onDown: PointerCallback | null = null;
let onMove: PointerCallback | null = null;
let onUp: PointerCallback | null = null;

function toPointer(e: PointerEvent): Pointer {
  return {
    x: e.clientX,
    y: e.clientY,
    pressure: e.pressure || 0.5,
    timestamp: e.timeStamp,
  };
}

export function initInput(el: HTMLElement) {
  el.addEventListener('pointerdown', (e) => onDown?.(toPointer(e)));
  el.addEventListener('pointermove', (e) => onMove?.(toPointer(e)));
  el.addEventListener('pointerup', (e) => onUp?.(toPointer(e)));
  el.addEventListener('pointercancel', (e) => onUp?.(toPointer(e)));
}

export function onPointerDown(cb: PointerCallback) { onDown = cb; }
export function onPointerMove(cb: PointerCallback) { onMove = cb; }
export function onPointerUp(cb: PointerCallback) { onUp = cb; }
