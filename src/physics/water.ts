/**
 * 水面シミュレーション — 2Dの波動方程式ベース
 *
 * グリッド上の各セルが高さを持ち、隣接セルとの平均化 + 減衰で波が伝播する。
 * 描画は小さなオフスクリーンcanvasに1px/cellで描いてからスケーリングで拡大。
 * ブラウザのバイリニア補間が効くのでブロッキーにならない。
 */

import type { WaterSurface } from '../types';

const CELL = 4;
const DAMPING = 0.97;

export function createWater(width: number, height: number): WaterSurface {
  let cols = Math.ceil(width / CELL) + 2;
  let rows = Math.ceil(height / CELL) + 2;
  let curr = new Float32Array(cols * rows);
  let prev = new Float32Array(cols * rows);

  // オフスクリーンcanvasで1セル=1ピクセルとして描画し、拡大で滑らかに見せる
  let offscreen = new OffscreenCanvas(cols, rows);
  let offCtx = offscreen.getContext('2d')!;

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
              const falloff = (1 - dist / radius);
              curr[idx(c, r)] += force * falloff * falloff;
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
          const i = idx(c, r);
          const val = curr[i];

          // 隣接セルとの差分で擬似法線を求める → 光の反射
          const dx = curr[idx(c + 1, r)] - curr[idx(c - 1, r)];
          const dy = curr[idx(c, r + 1)] - curr[idx(c, r - 1)];

          // 左上からの光源を想定したハイライト
          const light = dx * -0.8 + dy * -0.6;

          // ベースカラー: 深い藍色
          const baseR = 6;
          const baseG = 18;
          const baseB = 42;

          // 高さで明度を変え、法線でハイライトを乗せる
          const heightBright = val * 30;
          const lightBright = light * 60;
          const total = heightBright + lightBright;

          const pi = (r * cols + c) * 4;
          data[pi] = Math.max(0, Math.min(255, baseR + total * 0.5));
          data[pi + 1] = Math.max(0, Math.min(255, baseG + total * 0.9));
          data[pi + 2] = Math.max(0, Math.min(255, baseB + total * 1.4));
          data[pi + 3] = 255;
        }
      }

      // 端のピクセルもベースカラーで埋める
      for (let r = 0; r < rows; r++) {
        for (const c of [0, cols - 1]) {
          const pi = (r * cols + c) * 4;
          data[pi] = 6; data[pi + 1] = 18; data[pi + 2] = 42; data[pi + 3] = 255;
        }
      }
      for (let c = 0; c < cols; c++) {
        for (const r of [0, rows - 1]) {
          const pi = (r * cols + c) * 4;
          data[pi] = 6; data[pi + 1] = 18; data[pi + 2] = 42; data[pi + 3] = 255;
        }
      }

      offCtx.putImageData(imageData, 0, 0);

      // バイリニア補間で拡大 → 滑らかな水面
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'medium';
      ctx.drawImage(offscreen, 0, 0, w, h);
    },
  };
}
