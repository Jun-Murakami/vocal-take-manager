# Vocal Take Manager - 要件定義 / モデル定義 (CLAUDE.md)

本ドキュメントは実装の土台となる要件定義とモデル設計の整理です。UIは添付の4枚のワイヤー（docs/01-04）に準拠します。

## 0. 基本方針 / 制約
- すべてクライアント完結。サーバーへのユーザーデータ送信は行わない。
- 永続化は IndexedDB（Dexie）を使用。
- 形態素解析は kuromoji.js（未導入、後で追加）。
- 状態管理: Context Providerは使用しない。原則は React useState。
  - 例外として zustand はグローバルダイアログのみ使用（既存: src/components/GlobalDialog.tsx, src/stores/dialogStore.ts）。
- UIライブラリ: MUI。
- 仮想化: tanstack/react-virtual。
- テスト: Vitest / Playwright。
- Build: Vite。Formatting/Lint: biome。
- React 19 (React Compiler mode)。

## 1. 目的 / ユーザー像
ボーカルレコーディングディレクターが、歌詞の各フレーズに対して複数テイクの出来をマークし、
最終的にベストテイクを選定（コンピング）して、編集作業に引き渡す資料/データを生成する。

## 2. 画面構成（ワイヤー準拠）
### 2.1 ホーム
- 曲の一覧（タイトル + 最終更新日時）。
- 操作: 新規作成 / 開く / 読み込み（.vtm）/ 書き出し（.vtm）。

### 2.2 歌詞入力
- タイトル、クレジット、歌詞（複数行）を入力。
- OKで確定、キャンセルで戻る。

### 2.3 レコーディング
- 左: 歌詞/フレーズ一覧。
- 中央〜右: テイク列。列ごとにテイク番号。
- 右下: マーク設定エリア（1〜5） + 手動メモ (0)。
- 左下にフリーメモエリア。

### 2.4 コンピング
- 対象フレーズに対する各テイクのマークが右下に表示。
- テイク番号を選ぶとそのフレーズの「採用テイク」を確定し次へ。
- レコーディング画面と同様のマーク表示ルール。
- 左下にフリーメモエリア。

## 3. 主要機能要件
### 3.1 歌詞処理
- 入力された歌詞（行単位）を解析し、フレーズ単位に分割。
- kuromoji.js で形態素解析した結果を「ツール用途に適した語群」に再結合。
- 目標例:
  - 入力: 「おおきなのっぽの古時計」
  - 期待フレーズ: 「おおきな」「のっぽの」「古時計」
- 解析結果の保存は「フレーズ列（phrase list）」として保存。

### 3.2 レコーディング マーク
- キーボード 1〜5: ユーザーが設定したマーク（記号）を入力。
  - デフォルト: 1=◎, 2=〇, 3=△, 4/5は空。
  - 設定は空にもできる。
- キーボード 0: 手動メモ（文字）入力。アイコン表示。
- フレーズ × テイク のマトリクスに評価を記録。

### 3.3 コンピング
- フレーズごとに最終採用テイクを決定。
- 右下に該当フレーズの各テイクのマークを一覧表示。
- クリック/キー選択で採用テイクを確定。
- 進行は「現在フレーズインデックス」を保持。

### 3.4 出力
- 印刷（ブラウザ print）。
- PDF（ブラウザ print to PDF）。
- .vtm 形式 JSON 書き出し（拡張子 .vtm）。
  - 編集済みの楽曲データ（後述のモデル）を丸ごと出力。

## 4. 形態素解析 → フレーズ生成の設計（初期案）
kuromoji.js の出力をそのまま使うと細かすぎるため、以下のルールで再結合する。

### 4.1 ルール案
- 「連体詞 + 名詞」の結合: 例「おおきな」+「のっぽ」
- 「名詞 + 助詞(連体化)」の結合: 例「のっぽ」+「の」→「のっぽの」
- 「接頭詞(名詞接続) + 名詞」の結合: 例「古」+「時計」→「古時計」
- 「名詞(数) + 名詞(接尾,助数詞)」の結合: 例「百」+「年」→「百年」
- 「動詞 + 接続助詞 + 動詞(非自立) + 助動詞」の結合: 例「動い」「て」「い」「た」→「動いていた」
- 「接頭詞 + サ変接続名詞 + 助詞(連体化)」の結合: 例「ご」「自慢」「の」→「ご自慢の」
- 「名詞 + 終助詞」の結合: 例「時計」+「さ」→「時計さ」
- 空白/改行はフレーズ分割境界

### 4.2 出力例
入力:
- おおきなのっぽの古時計
- おじいさんの時計
- 百年いつも動いていた
- ご自慢の時計さ

期待フレーズ:
- おおきな / のっぽの / 古時計
- おじいさんの / 時計
- 百年 / いつも / 動いていた
- ご自慢の / 時計さ

※ ルールは実装しながら調整（例外処理やユーザー手動修正のUIも将来検討）。

## 5. モデル定義（JSON / Dexie）
### 5.1 ルート
- `Song`
  - id: string (uuid)
  - title: string
  - credits: string
  - rawLyrics: string
  - createdAt: number (ms)
  - updatedAt: number (ms)
  - phrases: Phrase[]
  - takes: Take[]
  - marks: Mark[]
  - comping: CompingState
  - markSettings: MarkSetting[]
  - freeMemo: string

### 5.2 Phrase
- id: string
- lineIndex: number
- order: number (全体順)
- text: string
- tokens: Token[] (形態素解析結果)

### 5.3 Token (kuromoji)
- surfaceForm: string
- pos: string
- posDetail1: string
- baseForm: string
- reading: string
- pronunciation: string

### 5.4 Take
- id: string
- order: number (1..n)
- label: string (表示用、デフォルトは番号)
- color: string (UI用)

### 5.5 Mark
- id: string
- phraseId: string
- takeId: string
- markValue: string | null (例: ◎/〇/△/空)
- memo: string | null (手動メモ、0キー)
- updatedAt: number

### 5.6 CompingState
- currentPhraseIndex: number
- selectedTakeByPhraseId: Record<phraseId, takeId>

### 5.7 MarkSetting
- key: number (1..5)
- symbol: string | null
- color: string | null

### 5.8 その他
- `VtmExport`
  - version: string
  - exportedAt: number
  - song: Song

## 6. 永続化設計 (Dexie)
- Table: songs (id, title, updatedAt)
- Table: songData (id, json)
- CRUD操作は Song 単位でまとめて保存/取得。
- ファイル読み込み(.vtm)時は Song を replace。

## 7. キーボードショートカット
- 1..5: 現在選択中フレーズ × テイクにマーク入力
- 0: 手動メモ入力（ダイアログ）
- 矢印: フレーズ/テイク移動（案）
- Esc: キャンセル/閉じる

## 8. UI上の重要ルール
- 左の歌詞リストは「フレーズ単位」表示。
- テイク列は可変数。初期は 3〜6 想定（UIワイヤーは 3〜6）。
- マーク表示は記号＋色（設定に追従）。
- コンピング時は該当フレーズのみを強調表示。

## 9. 非機能要件
- オフライン動作。
- 低レイテンシでのスクロール/表示（仮想化）。
- データ消失防止のため自動保存。

## 10. 追加確認事項（未確定）
- テイク数の上限・初期値。
- フレーズ編集（解析結果の手動修正）の有無。
- マークの色・シンボルの初期プリセット。
- 出力レイアウトの細部（PDF/印刷時のデザイン）。

---
以上。
