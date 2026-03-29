/**
 * タッチ/マウス入力 — フレーム単位で状態を読み取る方式
 *
 * initInput(el) で登録し、毎フレーム getInputState() でスナップショットを取得する。
 */

import type { InputState } from './types';

const state: InputState = {
  active: false,
  x: 0,
  y: 0,
  pressure: 0,
  vx: 0,
  vy: 0,
};

let prevX = 0;
let prevY = 0;
let prevTime = 0;

export function initInput(el: HTMLElement) {
  el.style.touchAction = 'none'; // ブラウザのデフォルトジェスチャーを抑制

  el.addEventListener('pointerdown', (e) => {
    state.active = true;
    state.x = e.clientX;
    state.y = e.clientY;
    state.pressure = e.pressure || 0.5;
    state.vx = 0;
    state.vy = 0;
    prevX = e.clientX;
    prevY = e.clientY;
    prevTime = e.timeStamp;
  });

  el.addEventListener('pointermove', (e) => {
    if (!state.active) return;
    const dt = (e.timeStamp - prevTime) / 1000;
    if (dt > 0.001) {
      state.vx = (e.clientX - prevX) / dt;
      state.vy = (e.clientY - prevY) / dt;
    }
    state.x = e.clientX;
    state.y = e.clientY;
    state.pressure = e.pressure || 0.5;
    prevX = e.clientX;
    prevY = e.clientY;
    prevTime = e.timeStamp;
  });

  el.addEventListener('pointerup', () => {
    state.active = false;
  });

  el.addEventListener('pointercancel', () => {
    state.active = false;
  });
}

/** 現在の入力状態を返す（毎フレーム呼ぶ） */
export function getInputState(): Readonly<InputState> {
  return state;
}
