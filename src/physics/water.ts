/**
 * 水面シミュレーション — 2Dの波動方程式ベース
 *
 * グリッド上の各セルが高さを持ち、隣接セルとの平均化 + 減衰で波が伝播する。
 * 描画は小さなオフスクリーンcanvasに1px/cellで描いてからスケーリングで拡大。
 * ブラウザのバイリニア補間が効くのでブロッキーにならない。
 *
 * 呼吸: 複数の正弦波を重ねて画面全体をゆっくり揺らす。
 * 周期が異なるので機械的な繰り返しにならない。
 */

import type { WaterSurface } from '../types';

const CELL = 4;
const DAMPING = 0.97;

export function createWater(width: number, height: number): WaterSurface {
  let cols = Math.ceil(width / CELL) + 2;
  let rows = Math.ceil(height / CELL) + 2;
  let curr = new Float32Array(cols * rows);
  let prev = new Float32Array(cols * rows);

  let offscreen = new OffscreenCanvas(cols, rows);
  let offCtx = offscreen.getContext('2d')!;

  // 呼吸の経過時間
  let elapsed = 0;

  function idx(c: number, r: number) {
    return r * cols + c;
  }

  return {
    resize(w: number, h: number) {
      cols = Math.ceil(w / CELL) + 2;
      rows = Math.ceil(h / CELL) + 2;
      curr = new Float32Array(cols * rows);
      prev = new Float32Array(cols * rows);
      offscreen = new OffscreenCanvas(cols, rows);
      offCtx = offscreen.getContext('2d')!;
    },

    disturb(x: number, y: number, force: number) {
      const cc = Math.round(x / CELL);
      const cr = Math.round(y / CELL);
      const radius = 5;
      for (let dr = -radius; dr <= radius; dr++) {
        for (let dc = -radius; dc <= radius; dc++) {
          const c = cc + dc;
          const r = cr + dr;
          if (c > 0 && c < cols - 1 && r > 0 && r < rows - 1) {
            const dist = Math.sqrt(dc * dc + dr * dr);
            if (dist <= radius) {
              const falloff = 1 - dist / radius;
              curr[idx(c, r)] += force * falloff * falloff;
            }
          }
        }
      }
    },

    update(dt: number) {
      elapsed += dt;

      // --- 呼吸: 複数の周期の波を重ねて水面全体をゆっくり揺らす ---
      // 周期の異なる3つの波を重ねることで、繰り返し感を消す
      const breathA = Math.sin(elapsed * 0.4) * 0.15;   // ~15秒周期
      const breathB = Math.sin(elapsed * 0.27) * 0.10;  // ~23秒周期
      const breathC = Math.sin(elapsed * 0.17) * 0.08;  // ~37秒周期

      for (let r = 1; r < rows - 1; r++) {
        for (let c = 1; c < cols - 1; c++) {
          // 場所によって位相をずらす（全体が均一に動かないように）
          const px = c / cols;
          const py = r / rows;
          const spatial = Math.sin(px * 3.0 + elapsed * 0.3)
                        * Math.cos(py * 2.5 + elapsed * 0.2);
          curr[idx(c, r)] += (breathA + breathB + breathC) * (0.6 + 0.4 * spatial) * dt;
        }
      }

      // --- 波動方程式 ---
      const next = new Float32Array(cols * rows);
      for (let r = 1; r < rows - 1; r++) {
        for (let c = 1; c < cols - 1; c++) {
          const i = idx(c, r);
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
      const imageData = offCtx.createImageData(cols, rows);
      const data = imageData.data;

      for (let r = 1; r < rows - 1; r++) {
        for (let c = 1; c < cols - 1; c++) {
          // 隣接セルとの差分で擬似法線 → 光の反射
          const ndx = curr[idx(c + 1, r)] - curr[idx(c - 1, r)];
          const ndy = curr[idx(c, r + 1)] - curr[idx(c, r - 1)];

          // 上方からの光源
          const light = ndx * -0.6 + ndy * -0.8;

          // 黒ベース: 凹凸を光として表現
          const base = 15;
          const shadow = light * 60;

          const v = Math.max(0, Math.min(255, base + shadow));
          const pi = (r * cols + c) * 4;
          data[pi] = v;
          data[pi + 1] = v;
          data[pi + 2] = v;
          data[pi + 3] = 255;
        }
      }

      // 端もベースカラーで埋める
      for (let r = 0; r < rows; r++) {
        for (const c of [0, cols - 1]) {
          const pi = (r * cols + c) * 4;
          data[pi] = 15; data[pi + 1] = 15; data[pi + 2] = 15; data[pi + 3] = 255;
        }
      }
      for (let c = 0; c < cols; c++) {
        for (const r of [0, rows - 1]) {
          const pi = (r * cols + c) * 4;
          data[pi] = 15; data[pi + 1] = 15; data[pi + 2] = 15; data[pi + 3] = 255;
        }
      }

      offCtx.putImageData(imageData, 0, 0);

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'medium';
      ctx.drawImage(offscreen, 0, 0, w, h);
    },
  };
}
