# Colima Deck

[colima](https://github.com/abiosoft/colima) を GUI から操作するための、個人用 Electron アプリです。

> 基本機能（状態表示・起動/停止・設定編集）を実装済みです。コンテナ・イメージ・compose の一覧表示も実装済みで、トレイ常駐は未着手です。

## 目的

colima には公式の GUI がないため、CLI をラップして次の操作を画面から行えるようにします。

- VM の起動 / 停止 / 再起動 / 削除
- 状態とプロファイル一覧の表示
- 設定（CPU、メモリ、ディスク、runtime、Kubernetes の有無など）の編集
- コンテナ・イメージ・compose プロジェクトの状況表示

## 機能

| 機能                       | 内容                                                                             | 状態     |
| -------------------------- | -------------------------------------------------------------------------------- | -------- |
| 状態表示                   | `colima list --json` / `colima status --json` の結果を表示（5 秒ごとに更新）     | 実装済み |
| 起動 / 停止 / 再起動       | `colima start / stop / restart / delete` を実行                                  | 実装済み |
| 進捗表示                   | コマンドの出力をストリーミング表示、中断も可能                                   | 実装済み |
| 複数プロファイル対応       | `--profile=<name>` を指定した操作、新規プロファイル作成                          | 実装済み |
| 設定編集                   | `~/.colima/<profile>/colima.yaml` をフォームまたは YAML で編集（コメントは保持） | 実装済み |
| コンテナ / イメージ一覧    | `docker ps -a` / `docker images` の結果を表示（5 秒ごとに更新、読み取り専用）    | 実装済み |
| compose のグループ表示     | Compose タブで、compose 起動のコンテナをプロジェクトごとにまとめて表示           | 実装済み |
| メニューバー（トレイ）常駐 | 起動 / 停止のワンクリック操作                                                    | 検討中   |

## 技術スタック

- Electron
- React + TypeScript
- Vite（ビルド）

## 構成方針

colima コマンドの実行部分は UI から切り離し、main プロセス側のモジュールにまとめます。

```
colima-deck/
├─ src/
│  ├─ main/                 # Electron main プロセス
│  │  ├─ colima/            # colima CLI のラッパー（実行・パース・操作管理）
│  │  ├─ config/            # colima.yaml の読み書き
│  │  ├─ validate.ts        # IPC で受け取る値の検証
│  │  └─ ipc.ts             # renderer との IPC 定義
│  ├─ preload/              # contextBridge で公開する API
│  ├─ renderer/             # React の UI
│  └─ shared/types.ts       # プロセス間で共有する型と IPC チャンネル名
├─ resources/               # アプリアイコン（icon.svg が元データ。png / icns は npm run icons で生成）
├─ scripts/build-icons.cjs  # アイコンの PNG / icns を生成するスクリプト
└─ README.md
```

### セキュリティ上の方針

- `contextIsolation: true`、`nodeIntegration: false` とし、renderer から Node API を直接呼ばない。
- renderer からは preload で公開した限定的な API のみ呼び出す。
- コマンドは `child_process.spawn` / `execFile` に**引数配列**で渡し、シェル文字列の連結は行わない。
- プロファイル名など外部入力は、使用前に許可する文字（英数字、`-`、`_`）で検証する。

## 前提環境

- macOS
- [colima](https://github.com/abiosoft/colima) がインストール済みであること
- Docker CLI（コンテナ管理機能を使う場合）
- Node.js（LTS 推奨）

## セットアップ

```bash
git clone <このリポジトリ>
cd colima-deck
npm install
npm run dev
```

| コマンド            | 内容                                                                  |
| ------------------- | --------------------------------------------------------------------- |
| `npm run dev`       | 開発サーバー付きで起動                                                |
| `npm run build`     | `out/` にビルド                                                       |
| `npm run preview`   | ビルド結果を起動                                                      |
| `npm run typecheck` | 型チェック                                                            |
| `npm test`          | ユニットテスト（Vitest）                                              |
| `npm run pack`      | `dist/mac-arm64/Colima Deck.app` を作成（dmg にはしない。動作確認用） |
| `npm run dist`      | `dist/` に dmg と zip を作成                                          |
| `npm run icons`     | `resources/icon.svg` から `icon.png` と `icon.icns` を生成（macOS）   |

### Mac アプリとしてビルドする

```bash
env -u ELECTRON_RUN_AS_NODE npm run dist
```

`dist/` に `Colima Deck-<version>-arm64.dmg` と `.zip` ができます。dmg を開き、`Colima Deck.app` を `/Applications` にドラッグしてください。

- 設定は [electron-builder.yml](electron-builder.yml) にあります。ビルドする Mac と同じアーキテクチャ（Apple Silicon なら arm64）の向けに作られます。
- 個人利用のため、Apple Developer ID での署名・公証は行わず、ad-hoc 署名にしています。**ビルドした Mac 上ではそのまま開けます。** ダウンロードなどで別の Mac に渡した場合は、初回だけ Finder で右クリック →「開く」を実行するか、`xattr -dr com.apple.quarantine "/Applications/Colima Deck.app"` を実行してください。
- 初回のビルドでは Electron 本体をダウンロードするため、時間がかかります。

### 補足

- 開発中（`npm run dev`）の Dock やメニューに出る名前とアイコンは、`predev` で `node_modules` の Electron.app を書き換えて「Colima Deck」にしています（[scripts/patch-dev-electron.cjs](scripts/patch-dev-electron.cjs)、macOS のみ）。依存を入れ直しても次の起動で再適用されます。
- Finder から起動した場合でも colima を見つけられるよう、`PATH` に `/opt/homebrew/bin` と `/usr/local/bin` を補っています。
- 設定ディレクトリは colima と同じ規則（`COLIMA_HOME` → `~/.colima` → `$XDG_CONFIG_HOME/colima`）で決めます。
- devcontainer 内で GUI を動かす場合は、`Xvfb :99 &` で仮想ディスプレイを起動してから実行します。VS Code のターミナルでは `ELECTRON_RUN_AS_NODE=1` が設定されていることがあるため、`env -u ELECTRON_RUN_AS_NODE npm run dev` のように外してください。

## 参考

- [colima](https://github.com/abiosoft/colima)
- [Electron](https://www.electronjs.org/)
- [dockerode](https://github.com/apocas/dockerode)

## ライセンス

個人利用のため未定。
