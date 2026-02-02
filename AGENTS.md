# Vocal Take Manager - 要件定義 / 仕様書

本ドキュメントは Vocal Take Manager の仕様と実装ガイドラインです。

## 0. 概要

**Vocal Take Manager** は、ボーカルレコーディングのディレクター向けに、歌詞フレーズごとのテイク評価を記録し、最終的な採用テイク（コンピング）を決めるためのクライアント完結型Webアプリケーションです。

### 主な特徴
- 完全クライアント完結（サーバーへのユーザーデータ送信なし）
- IndexedDB（Dexie）によるローカル保存
- kuromoji.js による日本語歌詞の形態素解析・フレーズ分割
- キーボードショートカットによる高速マーク入力
- 印刷 / PDF / VTM形式エクスポート対応

## 1. 技術スタック

| カテゴリ | 技術 |
|---------|------|
| フレームワーク | React 19 (React Compiler mode) |
| ビルドツール | Vite |
| 言語 | TypeScript |
| UIライブラリ | MUI (Material-UI) v7 |
| 状態管理 | React useState（原則）、zustand（グローバルダイアログのみ） |
| 永続化 | IndexedDB (Dexie) |
| 形態素解析 | kuromoji.js |
| 仮想化 | @tanstack/react-virtual |
| キーボード | react-hotkeys-hook |
| フォーマット/Lint | Biome |
| テスト | Vitest / Playwright |

## 2. 画面構成

### 2.1 ホーム画面 (`HomeScreen`)
- 曲プロジェクトの一覧表示（タイトル + 最終更新日時）
- 操作: 新規作成 / 開く / 読み込み(.vtm) / 書き出し(.vtm) / 削除
- ダークモード切り替え
- フォント選択（Noto Sans JP / LINE Seed JP / BIZ UDPGothic / Resource Han Rounded）

### 2.2 歌詞入力画面 (`LyricEditScreen`)
- タイトル、クレジット、歌詞（複数行）を入力
- 歌詞ファイルインポート対応（.docx / .doc / .odt / .rtf / .txt）
- OKで確定し形態素解析を実行、キャンセルでホームに戻る

### 2.3 レコーディング画面 (`RecordingScreen`)
- **左エリア**: 歌詞/フレーズ一覧（行単位、リハーサルマーク対応）
- **右エリア**: テイク × フレーズのマークグリッド
- **下部**: マーク設定エリア（1〜9キー + 0キーメモ）、フリーメモ
- フレーズ手動分割/結合、歌詞テキスト編集、リハーサルマーク編集モード
- マークフィルター機能

### 2.4 コンピング画面 (`CompingScreen`)
- レコーディング画面と同様のレイアウト
- 各フレーズに対する採用テイクの選定
- 選定結果は歌詞横にテイク番号バッジで表示
- 印刷 / PDF出力対応（ライトモード強制）

## 3. データモデル

### 3.1 Song（ルートモデル）
```typescript
interface Song {
  id: string;              // UUID
  title: string;
  credits: string;
  rawLyrics: string;       // 入力された生の歌詞
  createdAt: number;       // タイムスタンプ (ms)
  updatedAt: number;
  phrases: Phrase[];
  takes: Take[];
  marks: Mark[];
  comping: CompingState;
  markSettings?: MarkSetting[];  // 後方互換性のためオプショナル
  freeMemo: string;
}
```

### 3.2 Phrase
```typescript
interface Phrase {
  id: string;
  lineIndex: number;       // 元の歌詞の行インデックス
  order: number;           // フレーズの全体順序
  text: string;
  tokens: Token[];         // 形態素解析結果
  isRehearsalMark?: boolean;  // リハーサルマーク行かどうか
}
```

### 3.3 Take
```typescript
interface Take {
  id: string;
  order: number;           // 1..n
  label: string;           // 表示用ラベル
  color: string;           // UI用カラー
}
```

### 3.4 Mark
```typescript
interface Mark {
  id: string;
  phraseId: string;
  takeId: string;
  markValue: string | null;  // 例: ◎/〇/△
  memo: string | null;       // 手動メモ（0キー入力）
  updatedAt: number;
}
```

### 3.5 CompingState
```typescript
interface CompingState {
  currentPhraseIndex: number;
  selectedTakeByPhraseId: Record<string, string>;  // phraseId -> takeId
}
```

## 4. キーボードショートカット

### レコーディング画面
| キー | 動作 |
|------|------|
| `1`〜`9` | 現在選択中セルにマーク入力 → 次フレーズへ移動 |
| `0` | メモ入力 → 次フレーズへ移動 |
| `Delete` / `Backspace` | マーク削除 |
| `←` / `→` | 前後のフレーズへ移動 |

### コンピング画面
| キー | 動作 |
|------|------|
| `1`〜`9` | 対応するテイクを採用 → 次フレーズへ移動 |
| `Delete` / `Backspace` | 採用テイク解除 |
| `←` / `→` | 前後のフレーズへ移動 |

## 5. リポジトリ構造

```
src/
├── App.tsx                    # ルートコンポーネント（ルーティング、テーマ）
├── main.tsx                   # エントリーポイント
├── theme.ts                   # MUIテーマ設定
├── version.ts                 # アプリバージョン（自動生成）
│
├── types/
│   ├── models.ts              # データモデル型定義
│   └── routing.ts             # 画面遷移型定義
│
├── constants/
│   └── layout.ts              # レイアウト定数（列幅、行高など）
│
├── db/
│   └── database.ts            # Dexie DB定義、CRUD操作
│
├── stores/
│   └── dialogStore.ts         # zustandによるグローバルダイアログ状態
│
├── hooks/
│   ├── index.ts               # バレルエクスポート
│   ├── useDocumentTitle.ts    # ページタイトル管理
│   ├── useMarksViewportWidth.ts  # マークエリア幅計算
│   ├── useShortcutFeedback.ts # ショートカットキー視覚フィードバック
│   ├── useSynchronizedScroll.ts  # 歌詞/マークエリア同期スクロール
│   └── useTakeCollapse.ts     # テイク列の折りたたみ状態
│
├── utils/
│   ├── colorHelpers.ts        # 色操作ユーティリティ
│   ├── fileExport.ts          # VTMファイルエクスポート
│   ├── kuromojiAnalyzer.ts    # kuromoji.js ラッパー
│   ├── lyricsImport.ts        # 歌詞ファイルインポート（docx等）
│   ├── markHelpers.ts         # マーク操作ヘルパー
│   ├── phraseBuilder.ts       # 形態素解析結果からフレーズ構築
│   ├── phraseHelpers.ts       # フレーズ操作ヘルパー
│   ├── songHelpers.ts         # Song操作ヘルパー（分割/結合等）
│   └── takeHelpers.ts         # テイク操作ヘルパー
│
├── components/
│   ├── BottomPanel.tsx        # 下部パネル共通コンポーネント
│   ├── DarkModeSwitch.tsx     # ダークモード切り替えスイッチ
│   ├── EditableField.tsx      # インラインテキスト編集フィールド
│   ├── GlobalDialog.tsx       # グローバルダイアログ
│   ├── Icons.tsx              # カスタムアイコン
│   ├── LicenseDialog.tsx      # ライセンス表示ダイアログ
│   ├── LyricEditModeControls.tsx  # 歌詞編集モードコントロール
│   ├── MarksArea.tsx          # マークグリッド外枠コンポーネント
│   └── lyrics/                # 歌詞表示コンポーネント群
│       ├── index.ts
│       ├── LyricsScrollContainer.tsx  # スクロールコンテナ
│       ├── LyricsLine.tsx     # 行コンテナ
│       ├── RehearsalMarkRow.tsx       # リハーサルマーク行
│       └── RehearsalMarkInsertBar.tsx # リハーサルマーク挿入バー
│
├── screens/
│   ├── HomeScreen.tsx         # ホーム画面
│   ├── LyricEditScreen.tsx    # 歌詞入力画面
│   │
│   ├── RecordingScreen/       # レコーディング画面
│   │   ├── index.ts
│   │   ├── RecordingScreen.tsx
│   │   ├── components/
│   │   │   ├── index.ts
│   │   │   ├── MarkFilterBar.tsx           # マークフィルターバー
│   │   │   ├── RecordingLyricsArea.tsx     # 歌詞エリアアダプター
│   │   │   ├── RecordingPhraseCell.tsx     # フレーズセル
│   │   │   ├── RecordingTakeHeader.tsx     # テイクヘッダー
│   │   │   └── RecordingTakeMarkColumn.tsx # テイクマーク列
│   │   └── hooks/
│   │       ├── useMarkFiltering.ts         # マークフィルタリング
│   │       └── useRecordingKeyboard.ts     # キーボードショートカット
│   │
│   └── CompingScreen/         # コンピング画面
│       ├── index.ts
│       ├── CompingScreen.tsx
│       ├── components/
│       │   ├── index.ts
│       │   ├── CompingLyricsArea.tsx       # 歌詞エリアアダプター
│       │   ├── CompingPhraseCell.tsx       # フレーズセル
│       │   ├── CompingTakeHeader.tsx       # テイクヘッダー
│       │   ├── CompingTakeMarkColumn.tsx   # テイクマーク列
│       │   └── TakeSelectionPanel.tsx      # テイク選択パネル
│       └── hooks/
│           ├── useCompingKeyboard.ts       # キーボードショートカット
│           └── useCompingSelection.ts      # テイク選択ロジック
│
└── fonts/
    └── resource-han-rounded.css  # カスタムフォント定義
```

## 6. 実装済み機能

### コア機能
- [x] 曲プロジェクトのCRUD（作成/読込/更新/削除）
- [x] 歌詞入力と形態素解析によるフレーズ分割
- [x] フレーズ × テイク マトリクスでのマーク入力
- [x] 9種類のカスタマイズ可能なマーク記号（1〜9キー）
- [x] 手動メモ入力（0キー）
- [x] フレーズごとの採用テイク選定（コンピング）
- [x] VTM形式（JSON）でのインポート/エクスポート
- [x] 印刷 / PDF出力

### 歌詞編集機能
- [x] フレーズの手動分割（任意の文字位置で分割）
- [x] フレーズの結合（分割線を削除して結合）
- [x] 歌詞テキストの直接編集
- [x] 行の削除
- [x] リハーサルマークの追加/編集/削除
- [x] 歌詞ファイルインポート（.docx / .doc / .odt / .rtf / .txt）

### UI/UX機能
- [x] ダークモード対応
- [x] フォント選択（4種類）
- [x] キーボードショートカット
- [x] ショートカット入力時の視覚フィードバック
- [x] テイク列の折りたたみ
- [x] マークフィルター（特定マークのフレーズをハイライト）
- [x] 歌詞/マークエリアの同期スクロール
- [x] 印刷時のライトモード強制

### テイク管理
- [x] テイクの追加/削除
- [x] テイク単位でのマーククリア
- [x] テイクごとのカラー設定

## 7. 永続化設計

### Dexie テーブル構成
| テーブル | 用途 |
|----------|------|
| `songs` | リスト表示用の軽量データ（id, title, updatedAt） |
| `songData` | 完全なSongデータ（JSON文字列） |
| `appSettings` | アプリ全体の設定（マーク記号設定など） |

### マーク記号のデフォルト値
| キー | 記号 |
|------|------|
| 1 | ◎ |
| 2 | 〇 |
| 3 | △ |
| 4 | （空） |
| 5 | P |
| 6 | R |
| 7〜9 | （空） |

## 8. 開発コマンド

```bash
# 開発サーバー起動
npm run dev

# プロダクションビルド
npm run build

# リント
npm run lint

# テスト
npm run test        # 単体テスト
npm run test:e2e    # E2Eテスト
```

## 9. 設計原則

### 状態管理
- **原則**: React useState を使用
- **例外**: グローバルダイアログのみ zustand を使用（`dialogStore.ts`）
- Context Provider は使用しない

### コンポーネント設計
- 画面ごとにフォルダ分割（`screens/XxxScreen/`）
- 画面固有のコンポーネントは `components/` サブフォルダ
- 画面固有のフックは `hooks/` サブフォルダ
- 共有コンポーネントは `src/components/`
- 共有フックは `src/hooks/`

### 型安全性
- `as any`, `@ts-ignore`, `@ts-expect-error` は使用禁止
- 空の catch ブロック禁止
- 型定義は `src/types/` に集約

## 10. 注意事項

- すべてクライアント完結で動作し、外部へのデータ送信は行わない
- 形態素解析の結果に応じてフレーズ分割は変化する
- 自動保存によりデータ消失を防止
- 印刷/PDF出力時は強制的にライトモードで出力

---
以上。
