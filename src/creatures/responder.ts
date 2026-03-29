/**
 * 水面の応答者 — ユーザーの指の痕跡を覚え、間をおいて「なぞり返す」
 *
 * ユーザーがタッチして指を離すと、少しの沈黙のあと、
 * 記録した軌跡の近くを別の誰かがなぞったような波紋が生まれる。
 * 同じ場所ではなく、少しずれた位置。力も控えめ。
 * 「…ん？」と感じさせる、水を介した応答。
 */

import type { InputState, WaterSurface } from '../types';

/** 軌跡の1点 */
interface TracePoint {
  x: number;
  y: number;
  force: number;
}

/** 応答の予約 */
interface PendingResponse {
  /** 元の軌跡 */
  trace: TracePoint[];
  /** 応答開始までの残り時間 */
  delay: number;
  /** 再生中の進捗 (0〜trace.length) */
  cursor: number;
  /** 再生速度の揺らぎ */
  speed: number;
  /** 軌跡からのオフセット */
  offsetX: number;
  offsetY: number;
}

const MIN_DELAY = 0.4;
const MAX_DELAY = 1.2;
const RESPONSE_FORCE = 12;
const PLAYBACK_SPEED = 0.6; // ユーザーの指より少しゆっくり
const OFFSET_RANGE = 40;    // 元の軌跡からどれくらいずれるか
const TRACE_SAMPLE_INTERVAL = 3; // 何フレームに1回軌跡を記録するか

export function createResponder() {
  // 現在記録中の軌跡
  let currentTrace: TracePoint[] = [];
  let wasActive = false;
  let sampleCounter = 0;

  // 応答キュー
  const pending: PendingResponse[] = [];

  return {
    update(dt: number, input: InputState, water: WaterSurface) {
      // --- 軌跡の記録 ---
      if (input.active) {
        sampleCounter++;
        if (sampleCounter % TRACE_SAMPLE_INTERVAL === 0) {
          const speed = Math.sqrt(input.vx * input.vx + input.vy * input.vy);
          currentTrace.push({
            x: input.x,
            y: input.y,
            force: input.pressure * 0.5 + Math.min(speed * 0.002, 0.5),
          });
        }
      }

      // --- 指が離れた瞬間: 軌跡を応答キューに送る ---
      if (wasActive && !input.active && currentTrace.length > 2) {
        const angle = Math.random() * Math.PI * 2;
        const dist = OFFSET_RANGE * (0.4 + Math.random() * 0.6);

        pending.push({
          trace: currentTrace.slice(),
          delay: MIN_DELAY + Math.random() * (MAX_DELAY - MIN_DELAY),
          cursor: 0,
          speed: PLAYBACK_SPEED * (0.7 + Math.random() * 0.6),
          offsetX: Math.cos(angle) * dist,
          offsetY: Math.sin(angle) * dist,
        });

        currentTrace = [];
        sampleCounter = 0;
      }
      wasActive = input.active;

      // --- 応答の再生 ---
      for (let i = pending.length - 1; i >= 0; i--) {
        const r = pending[i];

        // まだ待機中
        if (r.delay > 0) {
          r.delay -= dt;
          continue;
        }

        // 軌跡をなぞる
        r.cursor += r.speed * dt * 60; // 60fps基準
        const idx = Math.floor(r.cursor);

        if (idx >= r.trace.length) {
          // 再生完了
          pending.splice(i, 1);
          continue;
        }

        const pt = r.trace[idx];
        const force = RESPONSE_FORCE * pt.force * dt;
        water.disturb(pt.x + r.offsetX, pt.y + r.offsetY, force);
      }
    },
  };
}
