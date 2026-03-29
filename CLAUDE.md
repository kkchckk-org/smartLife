# smartLife

## 哲学

- **スマートフォンの身体性**: タッチスクリーンを「入力装置」ではなく「皮膚」として捉える
- **そこに何かいる**: 画面の向こう側に存在を感じさせる。目的のない触れ合いの心地よさ

## 技術スタック

- Vite + vanilla TypeScript + Canvas API
- 必要に応じて WebGL / Three.js に拡張可

## アーキテクチャ

依存方向は一方向に保つ:

```
input.ts → creatures/ → physics/ → canvas.ts
```

## ディレクトリ構成

```
src/
├── main.ts        # エントリーポイント
├── canvas.ts      # Canvas管理（リサイズ、DPI、描画ループ）
├── input.ts       # タッチ/マウス入力の抽象化
├── creatures/     # 「そこにいる何か」の振る舞い
└── physics/       # 水・質感の物理シミュレーション
```

## セッション開始手順

1. `git pull`
2. `cat CLAUDE.md` で地図を把握
3. `cat docs/features.json` で進捗確認
4. `git log --oneline -10` で直近の作業確認
5. `npm run dev` で開発サーバー起動
6. features.json から最優先の "todo" を1つ選んで実装開始

## ルール

- 1セッション = 1機能。コンテキストが溢れる前に区切る
- 機能完了時は features.json を更新してからコミット
- コミットメッセージは次のセッションへの引き継ぎ資料。説明的に書く
