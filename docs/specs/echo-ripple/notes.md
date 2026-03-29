# echo-ripple レビュー結果

- 日付: 2026-03-29
- 判定: **fail**

---

## 概要

TypeScript の型チェックはエラーなし。依存方向（`input → creatures → physics → canvas`）も守られている。
パラメータ定数は仕様の範囲内。main.ts の変更も最小限で正しい。
ただし、フェードアウト処理に致命的なロジックバグが2箇所、fadeFactor の計算に軽微な論理バグが1箇所ある。

---

## バグ一覧

### 🔴 Bug 1: フェードアウトのトリガー二重実装が矛盾している（/home/user/smartLife/src/creatures/echo.ts:152–154 と 168–171）

**問題**

フェードアウト開始の処理が update() 内に2箇所ある。

1箇所目（遅延期間・再生期間を問わず動作する）:
```
if (!wasActive && input.active && echoState !== null) {
  echoState.fadeOut = Math.min(1.0, FADE_OUT_DURATION); // = 0.3
}
```

2箇所目（再生中のみ動作する）:
```
if (input.active && echoState.fadeOut === 1.0) {
  echoState.fadeOut = FADE_OUT_DURATION; // = 0.3
}
```

1箇所目は立ち上がり（`!wasActive && input.active`）を見ており、
2箇所目は「再生中かつ input.active かつ fadeOut がまだ 1.0」を見ている。

仕様は「再生中にユーザーが新たにタッチした場合、エコーを即座にフェードアウトする」なので、
**立ち下がりを検出した同フレームでは wasActive=true のはず**だが、wasActive の更新は update() の末尾（203行目）で行われる。
そのため1箇所目と2箇所目が同一フレームで両方評価されるケースがあり、意図が重複している。

より深刻な問題は 2箇所目の条件 `echoState.fadeOut === 1.0` である。
1箇所目でフェードアウトが開始された（fadeOut が 0.3 に書き換えられた）フレームでは、
2箇所目の `fadeOut === 1.0` は false になり、2箇所目は発火しない。
しかし1箇所目が発火しない状況（立ち上がりではなく、タッチが継続している 2フレーム目以降）では、
2箇所目の `input.active && echoState.fadeOut === 1.0` が **再生開始直後（fadeOut=1.0のまま）にも発火してしまう**。

つまり「エコー再生開始後、1フレームでも input.active が true なら（立ち上がりでなくても）フェードアウトが始まる」という動作になっており、
**直前のタッチが終わった後 1 秒間待ってエコーが始まる設計なので通常は問題にならないが、**
エコー遅延中（delay > 0）に指を離した直後に再度タッチし、その状態でちょうど delay が 0 になった瞬間のフレームでは、
`!wasActive && input.active` による1箇所目は発火せず（wasActive はそのフレームですでに true）、
しかし2箇所目が `input.active === true && fadeOut === 1.0` で発火し、再生開始と同時にフェードアウトが始まる。
この動作は仕様と一致するが、コードの意図は不明確で将来的な誤修正を誘発する。

**修正方針**

1箇所目の重複処理を削除し、フェードアウトのトリガーは2箇所目（再生ブロック内）に一本化する。
条件は `input.active && echoState.fadeOut === 1.0` ではなく、
「タッチが進行中である」という状態で判定するほうが堅牢。

---

### 🔴 Bug 2: fadeFactor の計算が逆転している（/home/user/smartLife/src/creatures/echo.ts:180）

**問題**

```typescript
const fadeFactor = echoState.fadeOut > 0 ? echoState.fadeOut / FADE_OUT_DURATION : 1.0;
```

`fadeOut` は 1.0 から始まり 0.0 に向かって減少する設計になっているが（初期値 1.0、減算処理あり）、
このコードでは `fadeOut > 0` のとき `fadeOut / FADE_OUT_DURATION` を返す。

`FADE_OUT_DURATION = 0.3` なので、フェードアウト開始時（fadeOut が 0.3 にセットされた直後）は
`0.3 / 0.3 = 1.0` が返り、フェードアウト終了時（fadeOut → 0）は `0 / 0.3 = 0.0` が返る。
この部分自体は正しく動作する。

**しかし `fadeOut === 0` のとき `1.0` を返している**。
`echoState.fadeOut === 0` はフェードアウトが完了した状態を意味するにもかかわらず、
fadeFactor が 1.0 になり、フル強度で wave.disturb() を呼ぶ。

フェードアウト完了後は直後の再生終了判定（197行目）で `echoState = null` になるが、
`fadeFactor = 1.0` で water.disturb() を呼んだ後に null になるため、
フェードアウトの最終フレームで突然フル強度の波紋が発生する可能性がある。

**正しい意図は**: `fadeOut` が 0 ならフォースを 0 にすること。

```typescript
// 誤り
const fadeFactor = echoState.fadeOut > 0 ? echoState.fadeOut / FADE_OUT_DURATION : 1.0;

// 正しい
const fadeFactor = echoState.fadeOut / FADE_OUT_DURATION;
```

`fadeOut` は 0 未満にならないよう clamp されているので（175–177行目）、これで十分。

---

### 🟡 Bug 3: 通常再生中（フェードアウトなし）の fadeFactor が正しくない（/home/user/smartLife/src/creatures/echo.ts:173–180）

**問題**

通常再生中（フェードアウトが発動していない状態）では `fadeOut` の初期値は `1.0` のまま。
コードは `fadeOut > 0` ならば常に `dt` を減算する:

```typescript
if (echoState.fadeOut > 0) {
  echoState.fadeOut -= dt;
  ...
}
```

これにより、**フェードアウトがトリガーされていない通常再生中でも、毎フレーム fadeOut が減算されていく**。
60fps で `dt ≈ 0.0167` なので、約 60 フレーム（約 1 秒）で fadeOut が 0 になり、
フェードアウトしていないのに強制的に force が 0 になる。

再生が 1 秒以内に終わる（60 サンプル × 50ms = 3 秒まであり得る）場合でも、
再生後半で fadeFactor が低下し、波紋が徐々に弱くなる。
これは「エコーは元の force の 0.3〜0.5 倍」という仕様に加えて意図しない減衰が重なる。

**修正方針**

フェードアウトを「通常状態」と「フェードアウト中」の2段階で管理するか、
フェードアウトが始まっていない間は `fadeOut` を減算しない。

---

## 完了条件チェック

| 条件 | 判定 | 備考 |
|---|---|---|
| 1. 約1秒後に近くで控えめな波紋が現れる | 概ね満たす | Bug 3 により再生後半で減衰が進みすぎる恐れあり |
| 2. 小さく・ゆっくりで、毎回微妙に異なる | 満たす | パラメータ範囲は仕様通り |
| 3. 再生中のタッチでエコーが静かに消える | 部分的 | Bug 1/2 により消え際にフル強度波紋が起きうる |
| 4. 既存の生き物の動作に影響がない | 満たす | main.ts の変更は最小限 |

---

## 依存方向

`echo.ts` は `types.ts` の `Creature`, `InputState`, `WaterSurface` のみを参照している。
`canvas.ts` や `input.ts` への依存はなく、`input → creatures → physics → canvas` の不変条件を守っている。

---

## 型安全性

`npx tsc --noEmit` エラーなし。

---

## 結論

コミット不可。Bug 2（fadeFactor の反転）と Bug 3（常時 fadeOut 減算）を修正してから再レビューを依頼してください。
Bug 1（フェードアウトトリガーの重複）は動作上の問題はより限定的ですが、コードの意図が不明確なため合わせて整理を推奨します。

---

---

# 再レビュー結果（Bug 1/2/3 修正確認）

- 日付: 2026-03-29
- 判定: **pass**

---

## 修正確認

### Bug 3（`isFadingOut` フラグ） — 修正確認済み

`EchoState` に `isFadingOut: boolean` フィールドが追加された（23行目）。
初期値は `false`（143行目）。

通常再生中は 171行目の `if (echoState.isFadingOut)` ブロックが評価されないため、
`fadeOut` は `1.0` のまま減算されない。意図しない減衰は解消されている。

### Bug 2（`fadeFactor` の計算） — 修正確認済み

178行目が以下に変わった:

```typescript
const fadeFactor = echoState.isFadingOut ? echoState.fadeOut / FADE_OUT_DURATION : 1.0;
```

- 通常再生中（`isFadingOut === false`）: `1.0` を返す
- フェードアウト進行中（`isFadingOut === true`、`fadeOut` が 0.3 → 0.0）: `0.3 / 0.3 = 1.0` → `0.0 / 0.3 = 0.0` の範囲で推移
- フェードアウト完了（`fadeOut === 0`）: `0.0 / 0.3 = 0.0` を返す

前回の「fadeOut=0 のとき誤って 1.0 を返す」バグは解消されている。

### Bug 1（フェードアウトトリガーの一本化） — 修正確認済み

フェードアウト開始処理は 165–168行目の1箇所のみ:

```typescript
if (input.active && !echoState.isFadingOut) {
  echoState.isFadingOut = true;
  echoState.fadeOut = FADE_OUT_DURATION;
}
```

このブロックは遅延期間（delay > 0）の else ブロック内にあり、再生中のみ評価される。
`!echoState.isFadingOut` により二重発動もない。前回の重複トリガーは解消されている。

---

## 新たなバグ混入確認

軌跡記録・エコー予約・空間変換のロジックは前回から変更なし。

終了条件（195行目）:

```typescript
if (echoState.index >= echoState.samples.length || (echoState.fadeOut === 0 && echoState.index > 0)) {
```

`fadeOut === 0` になるのは `isFadingOut === true` のブロック内のみなので、
フェードアウト完了の検出として実質正しく機能している。`isFadingOut` の明示確認がなくても問題ない。

---

## 完了条件チェック

| 条件 | 判定 | 備考 |
|---|---|---|
| 1. 約1秒後に近くで控えめな波紋が現れる | 満たす | 遅延 0.8〜1.6 秒、通常再生中は fadeFactor=1.0 で安定 |
| 2. 小さく・ゆっくりで、毎回微妙に異なる | 満たす | パラメータ範囲は仕様通り、空間変換も正しい |
| 3. 再生中のタッチでエコーが静かに消える | 満たす | 0.3 秒かけて fadeFactor が 0 に向かって推移する |
| 4. 既存の生き物の動作に影響がない | 満たす | main.ts の変更は最小限 |

---

## 依存方向

変更なし。`input → creatures → physics → canvas` の不変条件を引き続き守っている。

## 型安全性

`npx tsc --noEmit` エラーなし。

---

## 結論

**コミット可。** Bug 1/2/3 すべて正しく修正されており、新たなバグの混入もない。
