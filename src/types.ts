/** 1フレームの入力スナップショット */
export interface InputState {
  /** タッチ中か */
  active: boolean;
  /** 座標 (CSS px) */
  x: number;
  y: number;
  /** タッチ圧 (0–1) */
  pressure: number;
  /** 移動速度 (px/s) */
  vx: number;
  vy: number;
}

/** 水面シミュレーション */
export interface WaterSurface {
  /** 指定地点に波紋を立てる */
  disturb(x: number, y: number, force: number): void;
  /** dt秒ぶん物理を進める */
  update(dt: number): void;
  /** 指定地点の水面高を返す */
  heightAt(x: number, y: number): number;
  /** 描画 */
  draw(ctx: CanvasRenderingContext2D, width: number, height: number): void;
  /** 画面サイズ変更時にグリッドを作り直す */
  resize(width: number, height: number): void;
}

/** 水面下の存在 */
export interface Creature {
  readonly x: number;
  readonly y: number;
  update(dt: number, input: InputState, water: WaterSurface): void;
}
