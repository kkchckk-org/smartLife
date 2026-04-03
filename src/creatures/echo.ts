/**
 * エコー波紋
 *
 * ユーザーがなぞった軌跡を遅延して再生し、
 * 「別の存在がこちらを真似た」ような微かな違和感を生む。
 */

import type { Creature, InputState, WaterSurface } from '../types';

interface TrailSample {
  x: number;
  y: number;
  force: number;
}

interface EchoState {
  samples: TrailSample[];
  delay: number;
  interval: number;
  index: number;
  timer: number;
  fadeOut: number; // 1.0 → 0.0
  isFadingOut: boolean; // フェードアウト発動中か
  offsetX: number;
  offsetY: number;
  scale: number;
  forceScale: number;
}

const RECORD_INTERVAL = 0.05; // 50ms ごとに記録
const BUFFER_DURATION = 3.0; // 直近 3秒
const BUFFER_MAX_SAMPLES = Math.ceil(BUFFER_DURATION / RECORD_INTERVAL); // 約 60

const ECHO_DELAY_MIN = 0.8;
const ECHO_DELAY_MAX = 1.6;

const OFFSET_DISTANCE_MIN = 30;
const OFFSET_DISTANCE_MAX = 80;

const SCALE_MIN = 0.6;
const SCALE_MAX = 0.9;

const TIME_SCALE_MIN = 1.1;
const TIME_SCALE_MAX = 1.4;

const FORCE_SCALE_MIN = 0.3;
const FORCE_SCALE_MAX = 0.5;

const FADE_OUT_DURATION = 0.3;

export function createEcho(): Creature {
  let px = 0;
  let py = 0;

  let trailBuffer: TrailSample[] = [];
  let recordTimer = 0;
  let recording = false;
  let wasActive = false;

  let echoState: EchoState | null = null;

  return {
    get x() {
      return px;
    },
    get y() {
      return py;
    },

    update(dt: number, input: InputState, water: WaterSurface) {
      // --- 軌跡の記録 ---
      if (input.active) {
        recording = true;
        recordTimer += dt;

        if (recordTimer >= RECORD_INTERVAL) {
          const speed = Math.sqrt(input.vx * input.vx + input.vy * input.vy);
          const force = input.pressure * 30 + speed * 0.08;

          trailBuffer.push({
            x: input.x,
            y: input.y,
            force,
          });

          // バッファサイズを制限
          if (trailBuffer.length > BUFFER_MAX_SAMPLES) {
            trailBuffer.shift();
          }

          recordTimer -= RECORD_INTERVAL;
        }
      }

      // --- 立ち下がり検出：指が離れた瞬間 ---
      if (wasActive && !input.active && recording && trailBuffer.length > 0) {
        // エコーを予約
        const delay = ECHO_DELAY_MIN + Math.random() * (ECHO_DELAY_MAX - ECHO_DELAY_MIN);

        // 重心を計算
        let cx = 0;
        let cy = 0;
        for (const s of trailBuffer) {
          cx += s.x;
          cy += s.y;
        }
        cx /= trailBuffer.length;
        cy /= trailBuffer.length;

        // 平行移動（ランダムな方向）
        const angle = Math.random() * Math.PI * 2;
        const distance =
          OFFSET_DISTANCE_MIN + Math.random() * (OFFSET_DISTANCE_MAX - OFFSET_DISTANCE_MIN);
        const offsetX = Math.cos(angle) * distance;
        const offsetY = Math.sin(angle) * distance;

        // スケール
        const scale = SCALE_MIN + Math.random() * (SCALE_MAX - SCALE_MIN);

        // 時間伸縮
        const timeScale = TIME_SCALE_MIN + Math.random() * (TIME_SCALE_MAX - TIME_SCALE_MIN);

        // 力の減衰
        const forceScale = FORCE_SCALE_MIN + Math.random() * (FORCE_SCALE_MAX - FORCE_SCALE_MIN);

        // 変換済みサンプル列を作成
        const transformedSamples: TrailSample[] = trailBuffer.map((s) => ({
          x: cx + (s.x - cx) * scale + offsetX,
          y: cy + (s.y - cy) * scale + offsetY,
          force: s.force * forceScale,
        }));

        const interval = RECORD_INTERVAL * timeScale;

        echoState = {
          samples: transformedSamples,
          delay,
          interval,
          index: 0,
          timer: 0,
          fadeOut: 1.0,
          isFadingOut: false,
          offsetX,
          offsetY,
          scale,
          forceScale,
        };

        trailBuffer = [];
        recording = false;
      }


      // --- エコーの遅延・再生 ---
      if (echoState !== null) {
        echoState.delay -= dt;

        // 遅延期間中
        if (echoState.delay > 0) {
          // 待機中
        } else {
          // 再生中

          // フェードアウト処理：タッチが進行中なら開始
          if (input.active && !echoState.isFadingOut) {
            echoState.isFadingOut = true;
            echoState.fadeOut = FADE_OUT_DURATION;
          }

          // フェードアウト中のみ fadeOut を減算
          if (echoState.isFadingOut) {
            echoState.fadeOut -= dt;
            if (echoState.fadeOut < 0) {
              echoState.fadeOut = 0;
            }
          }

          const fadeFactor = echoState.isFadingOut ? echoState.fadeOut / FADE_OUT_DURATION : 1.0;

          echoState.timer += dt;

          while (echoState.timer >= echoState.interval && echoState.index < echoState.samples.length) {
            const sample = echoState.samples[echoState.index];
            const appliedForce = sample.force * fadeFactor;
            // エコーの波紋：淡いマゼンタ
            const echoTint = { r: 1.0, g: 0.3, b: 0.7 };
            water.disturb(sample.x, sample.y, appliedForce, echoTint);

            px = sample.x;
            py = sample.y;

            echoState.timer -= echoState.interval;
            echoState.index++;
          }

          // 再生終了または完全にフェードアウト
          if (echoState.index >= echoState.samples.length || (echoState.fadeOut === 0 && echoState.index > 0)) {
            echoState = null;
          }
        }
      }

      wasActive = input.active;
    },
  };
}
