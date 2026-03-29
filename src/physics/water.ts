/**
 * 水面シミュレーション — 2Dの波動方程式ベース
 *
 * グリッド上の各セルが高さを持ち、隣接セルとの平均化 + 減衰で波が伝播する。
 * disturb() で外から力を加え、update() で1ステップ進め、draw() で描画する。
 */

import type { WaterSurface } from '../types';

/** 1セルあたりのピクセル数 */
const CELL = 6;
/** 波の減衰率 (1.0 = 減衰なし) */
const DAMPING = 0.96;

export function createWater(width: number, height: number): WaterSurface {
  let cols = Math.ceil(width / CELL) + 2;
  let rows = Math.ceil(height / CELL) + 2;
  let curr = new Float32Array(cols * rows);
  let prev = new Float32Array(cols * rows);

  function idx(c: number, r: number) {
    return r * cols + c;
  }

  return {
    resize(w: number, h: number) {
      cols = Math.ceil(w / CELL) + 2;
      rows = Math.ceil(h / CELL) + 2;
      curr = new Float32Array(cols * rows);
      prev = new Float32Array(cols * rows);
    },

    disturb(x: number, y: number, force: number) {
      const cc = Math.round(x / CELL);
      const cr = Math.round(y / CELL);
      const radius = 3;
      for (let dr = -radius; dr <= radius; dr++) {
        for (let dc = -radius; dc <= radius; dc++) {
          const c = cc + dc;
          const r = cr + dr;
          if (c > 0 && c < cols - 1 && r > 0 && r < rows - 1) {
            const dist = Math.sqrt(dc * dc + dr * dr);
            if (dist <= radius) {
              curr[idx(c, r)] += force * (1 - dist / radius);
            }
          }
        }
      }
    },

    update(_dt: number) {
      const next = new Float32Array(cols * rows);
      for (let r = 1; r < rows - 1; r++) {
        for (let c = 1; c < cols - 1; c++) {
          const i = idx(c, r);
          // 波動方程式の離散近似: 隣接4セルの平均×2 − 前フレームの値
          const avg =
            (curr[idx(c - 1, r)] +
              curr[idx(c + 1, r)] +
              curr[idx(c, r - 1)] +
              curr[idx(c, r + 1)]) /
            2 -
            prev[i];
          next[i] = avg * DAMPING;
        }
      }
      prev = curr;
      curr = next;
    },

    heightAt(x: number, y: number): number {
      const c = Math.round(x / CELL);
      const r = Math.round(y / CELL);
      if (c >= 0 && c < cols && r >= 0 && r < rows) {
        return curr[idx(c, r)];
      }
      return 0;
    },

    draw(ctx: CanvasRenderingContext2D, w: number, h: number) {
      const drawCols = Math.ceil(w / CELL);
      const drawRows = Math.ceil(h / CELL);
      for (let r = 0; r < drawRows; r++) {
        for (let c = 0; c < drawCols; c++) {
          const val = c < cols && r < rows ? curr[idx(c, r)] : 0;
          // 水面の高さを明度に変換。ベースは暗い深海色
          const brightness = Math.max(0, Math.min(255, 8 + val * 100));
          const blue = Math.max(0, Math.min(255, 30 + val * 200));
          ctx.fillStyle = `rgb(${brightness * 0.2},${brightness * 0.4},${blue})`;
          ctx.fillRect(c * CELL, r * CELL, CELL, CELL);
        }
      }
    },
  };
}
