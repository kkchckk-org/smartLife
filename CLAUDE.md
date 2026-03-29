# smartLife

## 哲学

- タッチスクリーンは入力装置ではなく「皮膚」
- 目的のない触れ合いの中に「そこに何かいる」と感じさせる
- 小さく作り、触って確かめながら育てる

## 不変条件

- 依存方向は一方向: `input → creatures → physics → canvas`
- Vite + vanilla TypeScript + Canvas API（必要時 WebGL 拡張可）
- 完了条件は「触って確認できること」を含める

## エージェント駆動

メイン会話はオーケストレーター。実作業はサブエージェントに委譲する。

| エージェント | モデル | 責務 |
|---|---|---|
| planner | opus | 設計・仕様化 → `docs/specs/` に書き出す |
| coder | haiku | 実装（コミットはしない） |
| reviewer | sonnet | レビュー → `notes.md` に結果を残す |

フロー: きくちが方向提示 → planner → coder → reviewer → メインが確認・コミット

## 状態ファイル

| ファイル | 役割 |
|---|---|
| `docs/features.json` | 機能一覧と進捗 |
| `docs/specs/<id>/` | 機能仕様 (spec.md) + 実装メモ (notes.md) |
| `docs/map.md` | モジュール関係図 |
| `docs/design.md` | 設計判断の記録 |
| `docs/process.md` | 運用詳細（状態遷移・レビュー・テンプレート） |

## セッション開始

1. `git status -s` — dirty worktree の確認
2. `cat docs/features.json` — 進捗確認
3. `git log --oneline -5` — 直近の作業

## ルール

- 1セッション = 1機能
- コミットはレビュー通過後のみ
- 作業後は features.json を更新してから終える
- 詳細は `docs/process.md` を参照
