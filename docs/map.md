# System Map

## モジュール関係図

```
[タッチ入力] → [生き物の反応] → [物理演算] → [Canvas描画]
 input.ts       creatures/       physics/      canvas.ts
```

## データフロー

1. `input.ts` がタッチ/マウスイベントを正規化し、座標・圧力・速度を抽出
2. `creatures/` が入力に応じて「何か」の状態を更新
3. `physics/` が水面・質感のシミュレーションを計算
4. `canvas.ts` がフレームごとに描画

## 依存ルール

- 上流から下流への一方向のみ許可
- `canvas.ts` は他モジュールを参照しない（描画命令を受けるだけ）
- `input.ts` は DOM イベントのみに依存
