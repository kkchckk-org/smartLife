/**
 * 水面下の存在
 *
 * 自律的にうろつき、タッチに反応して近寄り、水面を下から押し上げる。
 * 直接は見えない — 水面の盛り上がりだけが存在の手がかり。
 */

import type { Creature, InputState, WaterSurface } from '../types';

/** ゆらゆら徘徊する速度 (px/s) */
const WANDER_SPEED = 30;
/** タッチに引き寄せられる速度 (px/s) */
const APPROACH_SPEED = 60;
/** 水面を押し上げる力 */
const PUSH_FORCE = 10;

export function createCreature(
  startX: number,
  startY: number,
  bounds: { width: number; height: number },
): Creature {
  let px = startX;
  let py = startY;
  let angle = Math.random() * Math.PI * 2;

  return {
    get x() {
      return px;
    },
    get y() {
      return py;
    },

    update(dt: number, input: InputState, water: WaterSurface) {
      // --- 徘徊 ---
      angle += (Math.random() - 0.5) * 2.0 * dt;
      let dx = Math.cos(angle) * WANDER_SPEED * dt;
      let dy = Math.sin(angle) * WANDER_SPEED * dt;

      // --- タッチに引き寄せられる ---
      if (input.active) {
        const toX = input.x - px;
        const toY = input.y - py;
        const dist = Math.sqrt(toX * toX + toY * toY);
        if (dist > 1) {
          dx += (toX / dist) * APPROACH_SPEED * dt;
          dy += (toY / dist) * APPROACH_SPEED * dt;
        }
      }

      px += dx;
      py += dy;

      // 画面内に留める
      px = Math.max(0, Math.min(bounds.width, px));
      py = Math.max(0, Math.min(bounds.height, py));

      // --- 水面を下から押す ---
      water.disturb(px, py, PUSH_FORCE * dt);
    },
  };
}
