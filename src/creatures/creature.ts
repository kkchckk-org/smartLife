/**
 * 水面下の存在
 *
 * 自律的にうろつき、タッチに反応して近寄り、水面を下から押し上げる。
 * 直接は見えない — 水面の盛り上がりだけが存在の手がかり。
 */

import type { Creature, InputState, WaterSurface } from '../types';

const WANDER_SPEED = 40;
const APPROACH_SPEED = 80;
const PUSH_FORCE = 25;

export function createCreature(
  startX: number,
  startY: number,
  bounds: { width: number; height: number },
): Creature {
  let px = startX;
  let py = startY;
  let angle = Math.random() * Math.PI * 2;
  // 個体ごとにリズムをずらす
  let breathPhase = Math.random() * Math.PI * 2;

  return {
    get x() {
      return px;
    },
    get y() {
      return py;
    },

    update(dt: number, input: InputState, water: WaterSurface) {
      breathPhase += dt * 1.2;

      // --- 徘徊: ゆるやかに方向を変える ---
      angle += (Math.random() - 0.5) * 1.5 * dt;
      let dx = Math.cos(angle) * WANDER_SPEED * dt;
      let dy = Math.sin(angle) * WANDER_SPEED * dt;

      // --- タッチに引き寄せられる ---
      if (input.active) {
        const toX = input.x - px;
        const toY = input.y - py;
        const dist = Math.sqrt(toX * toX + toY * toY);
        if (dist > 1) {
          // 近いほど強く引かれる
          const pull = Math.min(1, 200 / dist);
          dx += (toX / dist) * APPROACH_SPEED * pull * dt;
          dy += (toY / dist) * APPROACH_SPEED * pull * dt;
        }
      }

      px += dx;
      py += dy;

      // 画面内に留める（端でそっと跳ね返る）
      if (px < 20) { px = 20; angle = -angle; }
      if (px > bounds.width - 20) { px = bounds.width - 20; angle = -angle; }
      if (py < 20) { py = 20; angle = Math.PI - angle; }
      if (py > bounds.height - 20) { py = bounds.height - 20; angle = Math.PI - angle; }

      // --- 水面を下から押す（呼吸するようにリズムを持たせる）---
      const breath = 0.6 + 0.4 * Math.sin(breathPhase);
      water.disturb(px, py, PUSH_FORCE * breath * dt);
    },
  };
}
