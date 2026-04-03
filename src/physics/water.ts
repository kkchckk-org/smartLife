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

import type { WaterSurface, Tint } from '../types';

const CELL = 4;
const DAMPING = 0.97;
const COLOR_DAMPING = 0.985;
const COLOR_INTENSITY = 20.0;
const COLOR_THRESHOLD = 0.001;

export function createWater(width: number, height: number): WaterSurface {
  let cols = Math.ceil(width / CELL) + 2;
  let rows = Math.ceil(height / CELL) + 2;
  let curr = new Float32Array(cols * rows);
  let prev = new Float32Array(cols * rows);

  // 色チャンネル
  let tintR = new Float32Array(cols * rows);
  let tintG = new Float32Array(cols * rows);
  let tintB = new Float32Array(cols * rows);

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
      tintR = new Float32Array(cols * rows);
      tintG = new Float32Array(cols * rows);
      tintB = new Float32Array(cols * rows);
      offscreen = new OffscreenCanvas(cols, rows);
      offCtx = offscreen.getContext('2d')!;
    },

    disturb(x: number, y: number, force: number, tint?: Tint) {
      const cc = Math.round(x / CELL);
      const cr = Math.round(y / CELL);
      const radius = 5;
      const absForce = Math.abs(force);
      const tintToUse = tint || { r: 1, g: 1, b: 1 };

      for (let dr = -radius; dr <= radius; dr++) {
        for (let dc = -radius; dc <= radius; dc++) {
          const c = cc + dc;
          const r = cr + dr;
          if (c > 0 && c < cols - 1 && r > 0 && r < rows - 1) {
            const dist = Math.sqrt(dc * dc + dr * dr);
            if (dist <= radius) {
              const falloff = 1 - dist / radius;
              const i = idx(c, r);
              curr[i] += force * falloff * falloff;
              // 色注入
              const colorAmount = absForce * falloff * falloff;
              tintR[i] += colorAmount * tintToUse.r;
              tintG[i] += colorAmount * tintToUse.g;
              tintB[i] += colorAmount * tintToUse.b;
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

      // --- 色チャンネルの拡散（熱方程式） ---
      const nextTintR = new Float32Array(cols * rows);
      const nextTintG = new Float32Array(cols * rows);
      const nextTintB = new Float32Array(cols * rows);

      for (let r = 1; r < rows - 1; r++) {
        for (let c = 1; c < cols - 1; c++) {
          const i = idx(c, r);
          const il = idx(c - 1, r);
          const ir = idx(c + 1, r);
          const iu = idx(c, r - 1);
          const id = idx(c, r + 1);

          nextTintR[i] = (tintR[il] + tintR[ir] + tintR[iu] + tintR[id]) / 4 * COLOR_DAMPING;
          nextTintG[i] = (tintG[il] + tintG[ir] + tintG[iu] + tintG[id]) / 4 * COLOR_DAMPING;
          nextTintB[i] = (tintB[il] + tintB[ir] + tintB[iu] + tintB[id]) / 4 * COLOR_DAMPING;
        }
      }
      tintR = nextTintR;
      tintG = nextTintG;
      tintB = nextTintB;
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
          const brightness = Math.max(0, Math.min(255, base + shadow));

          // 色チャンネルの処理
          const i = idx(c, r);
          const totalTint = tintR[i] + tintG[i] + tintB[i];
          const colorMix = Math.min(1, totalTint * COLOR_INTENSITY);

          let normR = 1;
          let normG = 1;
          let normB = 1;

          if (totalTint > COLOR_THRESHOLD) {
            normR = tintR[i] / totalTint;
            normG = tintG[i] / totalTint;
            normB = tintB[i] / totalTint;
          }

          // lerp: a + (b - a) * t
          const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

          const r_val = Math.max(0, Math.min(255, brightness * lerp(1, normR * 1.5, colorMix)));
          const g_val = Math.max(0, Math.min(255, brightness * lerp(1, normG * 1.5, colorMix)));
          const b_val = Math.max(0, Math.min(255, brightness * lerp(1, normB * 1.5, colorMix)));

          const pi = (r * cols + c) * 4;
          data[pi] = r_val;
          data[pi + 1] = g_val;
          data[pi + 2] = b_val;
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
