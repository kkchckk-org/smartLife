# ripple-color レビューメモ

日付: 2026-04-03
レビュアー: reviewer (sonnet)
結果: **pass（コミット可）**

---

## チェック結果

### 1. 型安全性
`npx tsc --noEmit` — エラーなし。

### 2. 依存方向
`input(main.ts) -> creatures(echo.ts) -> physics(water.ts) -> canvas` の一方向を維持。
色情報は `disturb()` の引数として上流から下流へ流れており、逆参照はない。

### 3. Tint 型定義（src/types.ts）
仕様書の定義と完全に一致。`WaterSurface.disturb()` の `tint?` オプション引数も正しく追加されている。

### 4. disturb() — 色注入ロジック（src/physics/water.ts）
- `absForce = Math.abs(force)` を使用。仕様通り「force の絶対値」で色量を算出している。
- 色注入式: `colorAmount * tintToUse.r/g/b` — 仕様の `|force| * falloff^2 * tint.r` に対応（`colorAmount = absForce * falloff * falloff`）。正しい。
- `tint` 省略時のデフォルト `{ r:1, g:1, b:1 }` — 仕様通り。後方互換を保っている。

### 5. update() — 色チャンネルの拡散（src/physics/water.ts）
- 熱方程式（4近傍平均 × COLOR_DAMPING）を実装。仕様通り。
- `COLOR_DAMPING = 0.985` — 仕様指定値と一致。高さの `DAMPING = 0.97` より遅く減衰する設計になっている。
- `nextTintR/G/B` を毎フレーム新規に確保して置き換えている。コピー前の配列を読み、書き先は別配列のため、in-place 更新による誤差は発生しない。問題なし。
- 呼吸ロジック（`curr` への加算）は色チャンネルに一切触れていない。仕様通り。

### 6. draw() — 色合成ロジック（src/physics/water.ts）
- `brightness = clamp(base + shadow, 0, 255)` — 仕様通り。
- `totalTint = tintR[i] + tintG[i] + tintB[i]`、`colorMix = clamp(totalTint * COLOR_INTENSITY, 0, 1)` — 仕様通り。
- `totalTint > COLOR_THRESHOLD` による分岐でゼロ除算を防止。分岐外（threshold 以下）では `normR = normG = normB = 1` に fallback。仕様通り。
- lerp 式 `a + (b - a) * t` — 正しい。
- 最終値の `clamp(0, 255)` も実施済み。
- 端ピクセル（境界行・列）はベースカラー (15, 15, 15, 255) で埋めており、色チャンネルは境界セルに伝播しないため整合している。

### 7. 配色（src/main.ts / src/creatures/echo.ts）
- ユーザー: `{ r: 0.3, g: 0.8, b: 1.0 }` — 仕様の「淡いシアン」と完全一致。
- エコー: `{ r: 1.0, g: 0.3, b: 0.7 }` — 仕様の「淡いマゼンタ」と完全一致。
- `echoTint` オブジェクトはループ内の `while` 中で毎回生成されている。機能上は問題ないが、同一の定数オブジェクトであるためループ外に切り出すとわずかに効率的。ただし GC への影響は微小であり、可読性も十分なため許容範囲内。

### 8. resize() — バッファ再生成
`tintR / tintG / tintB` が `curr / prev` と同タイミングで再生成されている。整合性あり。

### 9. 既存動作への影響
- 波動方程式ロジック（`curr / prev` の更新）には変更なし。
- `heightAt()` には変更なし。
- 呼吸ロジックには変更なし。
- 描画ロジックは色合成の分だけ追加されているが、`colorMix = 0` のとき `lerp(1, normR * 1.5, 0) = 1` となり `brightness * 1 = brightness` でグレースケールに戻る。後方互換は数式的にも保証されている。

---

## 気づき（Warning / Note レベル）

### 色チャンネルの拡散が高さの消滅より遅い可能性
仕様の意図として「波が去った後も色の痕跡が残る余韻」を演出している。これは設計上の意図であり、問題ではない。ただし COLOR_DAMPING の値によっては「波紋の痕跡が残りすぎて視覚的にうるさくなる」可能性がある。実際にタッチして感触を確認すること。

### echoTint をループ外に定数として定義することの検討（Note）
`echo.ts` の `while` ループ内で `const echoTint = { r: 1.0, g: 0.3, b: 0.7 }` を毎回生成している。定数なのでループ外に切り出せるが、JS エンジンは小さな定数オブジェクトを最適化する可能性が高く、実害は少ない。コードの意図は明確であり、変更は任意。

---

## 完了条件との対応

| 完了条件 | コードによる担保 |
|---|---|
| 色の区別（シアン vs マゼンタ） | main.ts / echo.ts の tint 値が仕様と一致 |
| 色の混色（重なりで白～淡紫） | 熱方程式による加算混色、特別なロジック不要 |
| 色の余韻 | COLOR_DAMPING=0.985 で高さより遅く減衰 |
| 呼吸はグレー | 呼吸ループが色チャンネルに触れていないことで保証 |

---

## 判定

**pass。コミット可。**

上記の Warning / Note はいずれも必須修正ではない。実際に触れて色の感触を確認し、COLOR_DAMPING や COLOR_INTENSITY の微調整はその後の判断に委ねる。
