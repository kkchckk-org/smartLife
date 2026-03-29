/**
 * smartLife エントリーポイント
 *
 * ゲームループ: 入力読み取り → 生き物更新 → 水面物理 → 描画
 */

import './style.css';
import { initCanvas, getSize } from './canvas';
import { initInput, getInputState } from './input';
import { createWater } from './physics/water';
import { createCreature } from './creatures/creature';

// --- 初期化 ---
const canvasEl = document.querySelector<HTMLCanvasElement>('#canvas')!;
const ctx = initCanvas(canvasEl);
initInput(canvasEl);

const { width, height } = getSize();
const water = createWater(width, height);

const creatures = [
  createCreature(width * 0.3, height * 0.4, { width, height }),
  createCreature(width * 0.7, height * 0.3, { width, height }),
  createCreature(width * 0.5, height * 0.7, { width, height }),
];

// --- リサイズ対応 ---
window.addEventListener('resize', () => {
  const s = getSize();
  water.resize(s.width, s.height);
});

// --- ゲームループ ---
let lastTime = 0;

function loop(time: number) {
  const dt = Math.min((time - lastTime) / 1000, 0.05); // 50ms上限（タブ復帰時の暴走防止）
  lastTime = time;

  // 1. 入力
  const input = getInputState();

  // 2. タッチで水面を直接揺らす
  if (input.active) {
    water.disturb(input.x, input.y, input.pressure * 15);
  }

  // 3. 生き物たちを動かす（水面にも影響する）
  for (const c of creatures) {
    c.update(dt, input, water);
  }

  // 4. 水面の物理演算
  water.update(dt);

  // 5. 描画
  const { width: w, height: h } = getSize();
  water.draw(ctx, w, h);

  requestAnimationFrame(loop);
}

requestAnimationFrame((t) => {
  lastTime = t;
  loop(t);
});
