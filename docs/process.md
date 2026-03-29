# Process

CLAUDE.md は地図、このファイルは進め方。

## 開発フロー

### 正常系

1. features.json から `todo` を1つ選び `doing` にする
2. @planner が `docs/specs/<id>/spec.md` を作成
3. @coder が仕様を読んで実装
4. @reviewer がレビュー → 問題なければ `done`
5. メインが確認してコミット・push

### 異常系

- **レビューNG**: `doing` に戻して修正 → 再レビュー
- **仕様不明確**: `blocked` にして planner に差し戻す
- **ワークツリーがdirty**: 先に stash or commit で解決してから開始
- **done後に問題発覚**: 新しい機能として切り出す（既存を差し戻さない）

## 状態遷移

```
todo → doing → review → done
         ↕
       blocked
```

| 状態 | 意味 |
|---|---|
| `todo` | 未着手 |
| `doing` | 作業中 |
| `review` | 実装済み、確認待ち |
| `done` | 完了 |
| `blocked` | 依存や判断待ち |

## features.json スキーマ

```json
[
  {
    "id": "water-ripple",
    "title": "タッチに反応する波紋エフェクト",
    "status": "done",
    "spec": "docs/specs/water-ripple/spec.md"
  }
]
```

最小フィールド: `id`, `title`, `status`。`spec` は仕様がある場合のみ。

## エージェント間通信

エージェント同士は直接やり取りしない。ファイルが通信手段。

| from → to | 経路 |
|---|---|
| planner → coder | `docs/specs/<id>/spec.md` |
| coder → reviewer | ソースコード（git diff） |
| reviewer → 次回 | `docs/specs/<id>/notes.md` |

口頭（チャット上）での仕様伝達はしない。ファイルに残す。
各エージェントは自分の責務の外に手を出さない。

## specs テンプレート

### spec.md

```markdown
# {機能名}

## 目的
- この機能で何を感じさせたいか

## スコープ
- 今回やること
- 今回やらないこと

## 振る舞い
- ユーザー操作に対する反応

## 完了条件
- 触って確認できる条件（2〜4項目）

## 影響モジュール
- 変更が必要なファイル
```

### notes.md

```markdown
# Notes

## 実装メモ
- 迷った点と採用した判断

## レビュー結果
- 指摘と対応

## 次にやるなら
- 今回やらなかった改善案
```

## レビュー観点

1. spec の完了条件を満たしているか
2. 触って破綻がないか
3. 依存方向の不変条件を壊していないか
4. 既存の触感を損なっていないか

結果: `pass` / `fail`。指摘は `notes.md` に短く残す。
