# 波紋の色分け -- ユーザーとエコーの色彩的区別

## 目的

- 黒い水面に触れたとき「自分の指」の波紋と「向こう側の存在」の波紋が異なる色で光り、二つの存在が同じ水面を共有していることを感じさせる
- 色は激しく主張するのではなく、波の凹凸に乗ってほのかに灯る程度。波同士が重なる場所では色も自然に混ざり合い、干渉を視覚化する

## スコープ

### 今回やること

- `disturb()` に色情報（tint）を渡せるようにする
- 水面グリッドに色チャンネルを追加し、高さと同様に伝播・減衰させる
- `draw()` で色チャンネルを読み取り、波紋ごとに異なる色で描画する
- ユーザー波紋とエコー波紋に具体的な配色を割り当てる

### 今回やらないこと

- 色のカスタマイズ UI
- creature（echo 以外）の色付け（将来の拡張として残す）
- WebGL への移行

## 振る舞い

### 1. disturb() インターフェースの変更

```typescript
/** 色の hint。0-1 の RGB 比率 */
export interface Tint {
  r: number;  // 0.0 - 1.0
  g: number;
  b: number;
}

export interface WaterSurface {
  disturb(x: number, y: number, force: number, tint?: Tint): void;
  // ... 他は変更なし
}
```

- `tint` は省略可能。省略時はニュートラル（白 = `{r:1, g:1, b:1}`）として扱い、既存コードとの後方互換を保つ
- `Tint` 型は `src/types.ts` に定義する

### 2. 色フィールドの伝播方式

高さグリッド (`curr`, `prev`: `Float32Array`) に加え、**3つの色チャンネル** を追加する:

```
tintR: Float32Array  // 赤チャンネルの「色の量」
tintG: Float32Array  // 緑チャンネルの「色の量」
tintB: Float32Array  // 青チャンネルの「色の量」
```

#### 色の注入

`disturb()` が呼ばれたとき、高さ (`curr`) への加算と同時に、色チャンネルにも加算する:

```
tintR[i] += |force| * falloff^2 * tint.r
tintG[i] += |force| * falloff^2 * tint.g
tintB[i] += |force| * falloff^2 * tint.b
```

`force` の絶対値を使う。色の量は常に正。

#### 色の伝播

色は波動方程式とは**別の仕組み**で広がる。波動方程式を色に適用すると負値が発生し色として破綻するため、**拡散方程式（熱方程式）** を使う:

```
tintR_next[i] = (
  tintR[i-1] + tintR[i+1] + tintR[i-cols] + tintR[i+cols]
) / 4 * COLOR_DAMPING
```

- `COLOR_DAMPING`: 0.985 程度。高さの減衰 (0.97) より遅く消えることで、波が去った後もしばらく色の痕跡が残る「余韻」を演出する
- 波の高さの伝播とは独立に毎フレーム更新する

#### 色の干渉（混色）

- 2つの色チャンネルは自然に加算混色される。ユーザー（シアン系）とエコー（マゼンタ系）が重なった領域では白に近づく
- 特別な干渉ロジックは不要。拡散方程式による自然な混合で十分

### 3. 配色

黒背景 (base=15) に映え、かつ控えめに光る配色:

| 波紋の種類 | 色名 | Tint 値 | 意図 |
|---|---|---|---|
| ユーザー | 淡いシアン | `{r: 0.3, g: 0.8, b: 1.0}` | 冷たい水面に自分の指が触れた感覚。青みがかった光 |
| エコー | 淡いマゼンタ | `{r: 1.0, g: 0.3, b: 0.7}` | 補色関係でユーザーと対になる「向こう側」の存在感 |
| 呼吸 / 未指定 | ニュートラル白 | `{r: 1.0, g: 1.0, b: 1.0}` | 呼吸のうねりは色を持たない（環境そのもの） |

- シアンとマゼンタは補色に近く、重なったとき白～淡紫に混ざる。水面を介して二つの存在が交わる瞬間が視覚化される
- 呼吸による揺らぎは色を注入しないため、色のない純粋な凹凸として残る

### 4. draw() の変更方針

現在の描画ロジック:

```
base = 15
shadow = light * 60
v = clamp(base + shadow, 0, 255)
R = G = B = v  // グレースケール
```

変更後:

```
base = 15
shadow = light * 60
brightness = base + shadow  // 凹凸による明暗（従来通り）

// セルの色の強さ（チャンネルごとの合計量に基づく）
totalTint = tintR[i] + tintG[i] + tintB[i]
colorMix = clamp(totalTint * COLOR_INTENSITY, 0, 1)

// 色が無い部分はグレースケール、色がある部分は tint 方向に染まる
if totalTint > threshold:
  normR = tintR[i] / totalTint
  normG = tintG[i] / totalTint
  normB = tintB[i] / totalTint
else:
  normR = normG = normB = 1  // ニュートラル白

R = clamp(brightness * lerp(1, normR * 1.5, colorMix), 0, 255)
G = clamp(brightness * lerp(1, normG * 1.5, colorMix), 0, 255)
B = clamp(brightness * lerp(1, normB * 1.5, colorMix), 0, 255)
```

- `COLOR_INTENSITY`: 色の見え方の強さ調整用定数。20.0 程度から始めてチューニング
- `threshold`: 0.001 程度。ゼロ除算防止
- `lerp(a, b, t) = a + (b - a) * t`
- 凹凸が小さい（brightness が低い）場所では色も暗くなるため、波の峰だけが光って色づく自然な表現になる
- 1.5 倍の乗数は色の彩度をやや強調するため。黒背景では控えめに見えるので少しブーストする

### 5. 呼吸との関係

`update()` 内の呼吸ロジックは高さ (`curr`) にのみ加算し、色チャンネルには何も注入しない。これにより呼吸はグレースケールのままとなり、タッチやエコーの色とのコントラストが生まれる。

## 完了条件

1. **色の区別**: 画面をタッチすると淡いシアンの波紋が広がり、指を離した後のエコー波紋は淡いマゼンタで広がる。二つの色が明確に違うことが分かる
2. **色の混色**: ユーザー波紋とエコー波紋が同じ領域を通過したとき、重なった部分の色が白～淡紫に変化する
3. **色の余韻**: 波の高さが消えた後もしばらく色の痕跡が残り、ゆっくりフェードアウトする
4. **呼吸はグレー**: タッチしていない状態の呼吸による揺らぎはグレースケールのまま、色がつかない

## 影響モジュール

| ファイル | 変更概要 |
|---|---|
| `src/types.ts` | `Tint` 型の追加、`WaterSurface.disturb()` に `tint?` パラメータ追加 |
| `src/physics/water.ts` | 色チャンネル配列の追加、`disturb()` で色注入、`update()` で拡散方程式、`draw()` で色付き描画、`resize()` で配列再生成 |
| `src/main.ts` | `water.disturb()` 呼び出しにユーザー色 tint を渡す |
| `src/creatures/echo.ts` | `water.disturb()` 呼び出しにエコー色 tint を渡す |

依存方向は変更なし: `input(main.ts) -> creatures(echo.ts) -> physics(water.ts) -> canvas`。色情報は `disturb()` の引数として上流から下流へ流れる。
