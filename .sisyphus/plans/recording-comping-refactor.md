# RecordingScreen / CompingScreen リファクタリング計画

## TL;DR

> **Quick Summary**: RecordingScreen.tsx (2580行) と CompingScreen.tsx (2133行) から共通ロジックをカスタムフックに、共通UIをコンポーネントに抽出し、各ファイルを800-1200行に削減する。
> 
> **Deliverables**:
> - 5つのカスタムフック (src/hooks/)
> - 2つの共有コンポーネント (src/components/)
> - リファクタリング後のRecordingScreen.tsx (~1000行)
> - リファクタリング後のCompingScreen.tsx (~900行)
> 
> **Estimated Effort**: Medium (1-2日)
> **Parallel Execution**: YES - 3 waves
> **Critical Path**: Hook作成 → Component作成 → Screen統合

---

## Context

### Original Request
RecordingScreen.tsx (2580 lines) と CompingScreen.tsx (2133 lines) が肥大化しているので、適切に分割を行い保守性と可読性を高める。ただし、分割しすぎて処理が追えなくなるのは避ける。

### Interview Summary
**Key Discussions**:
- 両画面で重複しているロジックを特定済み
- 既存の共有コンポーネント(LyricsArea, MarksArea, BottomPanel)のパターンに従う
- zustand/Contextは既存のGlobalDialog以外には使用しない

**Research Findings**:
- src/hooks/ ディレクトリは空（新規作成）
- 既存の共有コンポーネントはrender prop / コールバックパターンを使用
- React 19 + React Compiler mode
- テストインフラは未整備（Vitest/Playwrightは依存関係にあるが未使用）

---

## Work Objectives

### Core Objective
両画面から共通ロジック/UIを抽出し、各ファイルを約半分に削減しながら、処理の追跡可能性を維持する。

### Concrete Deliverables
1. `src/hooks/useEditModes.ts` - 編集モード管理フック
2. `src/hooks/useTitleCreditsEdit.ts` - タイトル/クレジット編集フック
3. `src/hooks/useViewportSync.ts` - ビューポート同期フック
4. `src/hooks/useTakeCollapse.ts` - テイク折りたたみフック
5. `src/hooks/useShortcutFeedback.ts` - ショートカットフィードバックフック
6. `src/components/SongHeader.tsx` - タイトル/クレジット編集UI
7. `src/components/EditModeToolbar.tsx` - 編集モード切り替えツールバー
8. リファクタリング後の `RecordingScreen.tsx`
9. リファクタリング後の `CompingScreen.tsx`

### Definition of Done
- [ ] RecordingScreen.tsx が 1200行以下
- [ ] CompingScreen.tsx が 1000行以下
- [ ] すべての既存機能が動作確認済み
- [ ] TypeScript エラーなし (`npm run typecheck`)
- [ ] Lint エラーなし (`npm run lint`)

### Must Have
- 既存の動作を完全に維持
- 明確なデータフロー（propsによる受け渡し）
- 既存パターン（LyricsArea, MarksArea, BottomPanel）との一貫性

### Must NOT Have (Guardrails)
- 新しいContext Provider の追加
- zustandストアの追加（既存のdialogStore以外）
- フック/コンポーネントの過度な細分化（1ファイル50行未満は避ける）
- 既存の共有コンポーネント(LyricsArea, MarksArea, BottomPanel)の変更
- 機能追加や動作変更

---

## Verification Strategy (MANDATORY)

### Test Decision
- **Infrastructure exists**: NO (Vitest/Playwright in dependencies but no tests)
- **User wants tests**: Manual verification
- **Framework**: N/A
- **QA approach**: Manual browser verification

### Automated Verification (Post-Refactoring)

**For Each Extraction:**
```bash
# Agent runs:
npm run typecheck
# Assert: Exit code 0, no TypeScript errors

npm run lint
# Assert: Exit code 0, no lint errors

npm run build
# Assert: Exit code 0, build succeeds
```

**For Final Integration:**
```bash
# Agent runs:
npm run dev &
sleep 5
# Navigate to http://localhost:5173 in browser via Playwright skill
# Verify: Recording screen loads, mark input works
# Verify: Comping screen loads, take selection works
```

---

## Execution Strategy

### Parallel Execution Waves

```
Wave 1 (Start Immediately - Independent Hooks):
├── Task 1: useShortcutFeedback hook
├── Task 2: useTakeCollapse hook
├── Task 3: useViewportSync hook
└── Task 4: useTitleCreditsEdit hook

Wave 2 (After Wave 1 - Dependent on Wave 1 hooks):
├── Task 5: useEditModes hook
├── Task 6: SongHeader component
└── Task 7: EditModeToolbar component

Wave 3 (After Wave 2 - Final Integration):
├── Task 8: RecordingScreen refactoring
└── Task 9: CompingScreen refactoring

Wave 4 (After Wave 3 - Verification):
└── Task 10: Final verification and cleanup
```

### Dependency Matrix

| Task | Depends On | Blocks | Can Parallelize With |
|------|------------|--------|---------------------|
| 1 | None | 8, 9 | 2, 3, 4 |
| 2 | None | 8, 9 | 1, 3, 4 |
| 3 | None | 8, 9 | 1, 2, 4 |
| 4 | None | 6, 8, 9 | 1, 2, 3 |
| 5 | None | 7, 8, 9 | 6 |
| 6 | 4 | 8, 9 | 5, 7 |
| 7 | 5 | 8, 9 | 6 |
| 8 | 1, 2, 3, 4, 5, 6, 7 | 10 | 9 |
| 9 | 1, 2, 3, 4, 5, 6, 7 | 10 | 8 |
| 10 | 8, 9 | None | None |

### Agent Dispatch Summary

| Wave | Tasks | Recommended Agents |
|------|-------|-------------------|
| 1 | 1, 2, 3, 4 | 4 parallel sisyphus-junior agents |
| 2 | 5, 6, 7 | 3 parallel sisyphus-junior agents |
| 3 | 8, 9 | 2 parallel sisyphus-junior agents |
| 4 | 10 | 1 sisyphus-junior agent |

---

## TODOs

### Wave 1: Independent Hooks

- [ ] 1. useShortcutFeedback フックの作成

  **What to do**:
  - `src/hooks/useShortcutFeedback.ts` を新規作成
  - activeShortcutKey 状態の管理
  - triggerShortcutFeedback 関数の実装
  - getShortcutPulseSx ユーティリティ関数の実装
  - shortcutTimeoutRef の管理とクリーンアップ

  **Must NOT do**:
  - 他のフック/コンポーネントへの依存追加
  - MUI以外のスタイルライブラリの使用

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: 単一ファイル作成、明確なスコープ、50行程度
  - **Skills**: []
    - なし - 標準的なReactフック実装

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 2, 3, 4)
  - **Blocks**: Tasks 8, 9
  - **Blocked By**: None

  **References**:
  - `src/screens/RecordingScreen.tsx:132-136` - activeShortcutKey の useState 定義
  - `src/screens/RecordingScreen.tsx:385-393` - triggerShortcutFeedback 関数の実装
  - `src/screens/RecordingScreen.tsx:483-506` - getShortcutPulseSx 関数の実装
  - `src/screens/RecordingScreen.tsx:395-401` - クリーンアップ useEffect
  - `src/screens/CompingScreen.tsx:247-264` - CompingScreen での同等実装

  **Acceptance Criteria**:
  - [ ] `src/hooks/useShortcutFeedback.ts` が作成されている
  - [ ] フックが以下を返す: `{ activeShortcutKey, triggerShortcutFeedback, getShortcutPulseSx }`
  - [ ] TypeScript型が正しく定義されている
  ```bash
  npm run typecheck
  # Assert: Exit code 0
  ```

  **Commit**: YES
  - Message: `refactor(hooks): add useShortcutFeedback hook for visual feedback on shortcuts`
  - Files: `src/hooks/useShortcutFeedback.ts`
  - Pre-commit: `npm run typecheck`

---

- [ ] 2. useTakeCollapse フックの作成

  **What to do**:
  - `src/hooks/useTakeCollapse.ts` を新規作成
  - collapsedTakeIds (Set<string>) 状態の管理
  - toggleTakeCollapse 関数の実装
  - テイク削除時のクリーンアップ useEffect の実装

  **Must NOT do**:
  - Song型への依存（takeIds配列のみ受け取る）
  - 他のフック/コンポーネントへの依存追加

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: 単一ファイル作成、明確なスコープ、60行程度
  - **Skills**: []
    - なし - 標準的なReactフック実装

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 1, 3, 4)
  - **Blocks**: Tasks 8, 9
  - **Blocked By**: None

  **References**:
  - `src/screens/RecordingScreen.tsx:137-140` - collapsedTakeIds の useState 定義
  - `src/screens/RecordingScreen.tsx:408-418` - toggleTakeCollapse 関数の実装
  - `src/screens/RecordingScreen.tsx:454-466` - クリーンアップ useEffect
  - `src/screens/CompingScreen.tsx:286-314` - CompingScreen での同等実装

  **Acceptance Criteria**:
  - [ ] `src/hooks/useTakeCollapse.ts` が作成されている
  - [ ] フックが以下を返す: `{ collapsedTakeIds, toggleTakeCollapse }`
  - [ ] takeIds パラメータでクリーンアップが動作する
  ```bash
  npm run typecheck
  # Assert: Exit code 0
  ```

  **Commit**: YES
  - Message: `refactor(hooks): add useTakeCollapse hook for take column visibility`
  - Files: `src/hooks/useTakeCollapse.ts`
  - Pre-commit: `npm run typecheck`

---

- [ ] 3. useViewportSync フックの作成

  **What to do**:
  - `src/hooks/useViewportSync.ts` を新規作成
  - marksViewportWidth, marksHorizontalScrollbarHeight 状態の管理
  - updateMarksViewportWidth 関数の実装
  - 初回描画、song変更、テイク数変更、リサイズ時の useLayoutEffect/useEffect
  - marksScrollRef を受け取り、その clientWidth/clientHeight から値を計算

  **Must NOT do**:
  - lyricsScrollRef の管理（それは呼び出し側で行う）
  - スクロール同期ロジックの実装（それは画面固有）

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: 単一ファイル作成、明確なスコープ、100行程度
  - **Skills**: []
    - なし - 標準的なReactフック実装

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 1, 2, 4)
  - **Blocks**: Tasks 8, 9
  - **Blocked By**: None

  **References**:
  - `src/screens/RecordingScreen.tsx:218-222` - ビューポート状態の定義
  - `src/screens/RecordingScreen.tsx:251-296` - updateMarksViewportWidth と各種 useLayoutEffect/useEffect
  - `src/screens/CompingScreen.tsx:98-162` - CompingScreen での同等実装

  **Acceptance Criteria**:
  - [ ] `src/hooks/useViewportSync.ts` が作成されている
  - [ ] フックが以下を返す: `{ marksViewportWidth, marksHorizontalScrollbarHeight, updateMarksViewportWidth }`
  - [ ] marksScrollRef, song, collapsedTakeIds を依存として受け取る
  ```bash
  npm run typecheck
  # Assert: Exit code 0
  ```

  **Commit**: YES
  - Message: `refactor(hooks): add useViewportSync hook for viewport width tracking`
  - Files: `src/hooks/useViewportSync.ts`
  - Pre-commit: `npm run typecheck`

---

- [ ] 4. useTitleCreditsEdit フックの作成

  **What to do**:
  - `src/hooks/useTitleCreditsEdit.ts` を新規作成
  - isEditingTitle, isEditingCredits, editingTitleText, editingCreditsText 状態の管理
  - startEditingTitle, startEditingCredits, handleTitleSave, handleCreditsSave 関数の実装
  - handleSaveSong コールバックを受け取り、保存時に呼び出す

  **Must NOT do**:
  - Song オブジェクト全体への依存（title, credits のみ受け取る）
  - document.title の更新（それは呼び出し側で行う）

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: 単一ファイル作成、明確なスコープ、80行程度
  - **Skills**: []
    - なし - 標準的なReactフック実装

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 1, 2, 3)
  - **Blocks**: Tasks 6, 8, 9
  - **Blocked By**: None

  **References**:
  - `src/screens/RecordingScreen.tsx:102-108` - 編集状態の定義
  - `src/screens/RecordingScreen.tsx:810-835` - handleTitleSave, handleCreditsSave の実装
  - `src/screens/CompingScreen.tsx:69-75` - CompingScreen での状態定義
  - `src/screens/CompingScreen.tsx:478-503` - CompingScreen での保存処理

  **Acceptance Criteria**:
  - [ ] `src/hooks/useTitleCreditsEdit.ts` が作成されている
  - [ ] フックが編集状態と保存ハンドラを返す
  - [ ] onSave コールバックが適切に呼び出される
  ```bash
  npm run typecheck
  # Assert: Exit code 0
  ```

  **Commit**: YES
  - Message: `refactor(hooks): add useTitleCreditsEdit hook for title/credits editing`
  - Files: `src/hooks/useTitleCreditsEdit.ts`
  - Pre-commit: `npm run typecheck`

---

### Wave 2: Dependent Hooks and Components

- [ ] 5. useEditModes フックの作成

  **What to do**:
  - `src/hooks/useEditModes.ts` を新規作成
  - 4つの編集モード状態: isManualSplitMode, isManualDeleteMode, isLyricEditMode, isRehearsalMarkMode
  - 歌詞編集状態: editingPhraseId, editingText
  - リハーサルマーク編集状態: editingRehearsalMarkId, editingRehearsalMarkText
  - 各モードのトグル関数とモード間の排他制御
  - handleToggleLyricEditMode, handleToggleRehearsalMarkMode の実装
  - handlePhraseClickForEdit, handleRehearsalMarkClick, handleRehearsalMarkSave, handleDeleteRehearsalMark
  - handleManualSplit, handleManualDeleteDivider の実装
  - handleInsertRehearsalMark の実装

  **Must NOT do**:
  - ロケーター移動ロジックの実装（それは画面固有）
  - JSX の生成

  **Recommended Agent Profile**:
  - **Category**: `unspecified-low`
    - Reason: 複雑なロジック、複数の状態間の相互作用、200行程度
  - **Skills**: []
    - なし - 標準的なReactフック実装

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 6, 7)
  - **Blocks**: Tasks 7, 8, 9
  - **Blocked By**: None

  **References**:
  - `src/screens/RecordingScreen.tsx:89-117` - 編集モード状態の定義
  - `src/screens/RecordingScreen.tsx:761-772` - handleManualSplit の実装
  - `src/screens/RecordingScreen.tsx:777-805` - handleToggleLyricEditMode の実装
  - `src/screens/RecordingScreen.tsx:840-971` - リハーサルマーク関連の実装
  - `src/screens/RecordingScreen.tsx:976-986` - handlePhraseClickForEdit の実装
  - `src/screens/RecordingScreen.tsx:1055-1097` - handleManualDeleteDivider の実装
  - `src/screens/CompingScreen.tsx:56-84` - CompingScreen での状態定義
  - `src/screens/CompingScreen.tsx:366-434` - CompingScreen での編集処理
  - `src/utils/songHelpers.ts` - splitPhraseByChar, mergePhraseAtDivider, insertRehearsalMarkAfterLine

  **Acceptance Criteria**:
  - [ ] `src/hooks/useEditModes.ts` が作成されている
  - [ ] 全編集モード状態とハンドラが実装されている
  - [ ] モード間の排他制御が正しく動作する
  ```bash
  npm run typecheck
  # Assert: Exit code 0
  ```

  **Commit**: YES
  - Message: `refactor(hooks): add useEditModes hook for edit mode management`
  - Files: `src/hooks/useEditModes.ts`
  - Pre-commit: `npm run typecheck`

---

- [ ] 6. SongHeader コンポーネントの作成

  **What to do**:
  - `src/components/SongHeader.tsx` を新規作成
  - タイトル表示/編集UI（TextField + 変更ボタン）
  - クレジット表示/編集UI（TextField + 変更ボタン）
  - 編集アイコン（ホバーで表示）
  - actionButtons スロットで右側のボタン群を受け取る

  **Must NOT do**:
  - 保存ロジックの実装（コールバックで受け取る）
  - 画面固有のボタン実装（スロットで受け取る）

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: 単一コンポーネント、明確なUI、150行程度
  - **Skills**: [`frontend-ui-ux`]
    - `frontend-ui-ux`: MUI コンポーネントの適切な使用

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 5, 7)
  - **Blocks**: Tasks 8, 9
  - **Blocked By**: Task 4 (useTitleCreditsEdit の型定義が必要)

  **References**:
  - `src/screens/RecordingScreen.tsx:1252-1371` - タイトル/クレジット編集UIのJSX
  - `src/screens/CompingScreen.tsx:919-1044` - CompingScreen での同等JSX
  - `src/components/BottomPanel.tsx` - 既存コンポーネントのパターン参考

  **Acceptance Criteria**:
  - [ ] `src/components/SongHeader.tsx` が作成されている
  - [ ] タイトル/クレジットの表示と編集が可能
  - [ ] actionButtons スロットが正しく動作
  ```bash
  npm run typecheck
  # Assert: Exit code 0
  ```

  **Commit**: YES
  - Message: `refactor(components): add SongHeader component for title/credits editing`
  - Files: `src/components/SongHeader.tsx`
  - Pre-commit: `npm run typecheck`

---

- [ ] 7. EditModeToolbar コンポーネントの作成

  **What to do**:
  - `src/components/EditModeToolbar.tsx` を新規作成
  - 分割線追加/削除、歌詞修正、リハーサルマークの4つのトグルボタン
  - 現在のモードに応じたヒントテキスト表示
  - editingPhraseId の有無でヒントテキストを切り替え

  **Must NOT do**:
  - モード状態の管理（propsで受け取る）
  - 実際の編集ロジック

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: 単一コンポーネント、ボタン群のUI、100行程度
  - **Skills**: [`frontend-ui-ux`]
    - `frontend-ui-ux`: MUI コンポーネントの適切な使用

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 5, 6)
  - **Blocks**: Tasks 8, 9
  - **Blocked By**: Task 5 (useEditModes の型定義が必要)

  **References**:
  - `src/screens/RecordingScreen.tsx:1707-1788` - 編集モードボタン群のJSX
  - `src/screens/CompingScreen.tsx:1398-1478` - CompingScreen での同等JSX

  **Acceptance Criteria**:
  - [ ] `src/components/EditModeToolbar.tsx` が作成されている
  - [ ] 4つのトグルボタンが表示される
  - [ ] モードに応じたヒントテキストが表示される
  ```bash
  npm run typecheck
  # Assert: Exit code 0
  ```

  **Commit**: YES
  - Message: `refactor(components): add EditModeToolbar component for edit mode buttons`
  - Files: `src/components/EditModeToolbar.tsx`
  - Pre-commit: `npm run typecheck`

---

### Wave 3: Screen Refactoring

- [ ] 8. RecordingScreen のリファクタリング

  **What to do**:
  - 作成した5つのフックをインポートして使用
  - 作成した2つのコンポーネントをインポートして使用
  - 重複コードを削除
  - 残る画面固有ロジック:
    - selectedPhraseId, selectedTakeId の管理
    - markSymbols, memoText の管理
    - activeMarkFilters の管理
    - handleMarkInput, handleMemoInput, handleClearMark
    - キーボードショートカット (1-9, 0, Delete, Arrow)
    - テイク追加/削除 (handleAddTake, handleRemoveTake)
    - handleClearTakeMarks
    - phraseMarkMap, isPhraseHighlighted の計算

  **Must NOT do**:
  - 機能の変更や追加
  - 新しい状態やロジックの追加

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: 大規模なファイル変更、多数のフック/コンポーネント統合
  - **Skills**: []
    - なし - コード統合とリファクタリング

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3 (with Task 9)
  - **Blocks**: Task 10
  - **Blocked By**: Tasks 1, 2, 3, 4, 5, 6, 7

  **References**:
  - `src/screens/RecordingScreen.tsx` - 現在のファイル全体
  - `src/hooks/useShortcutFeedback.ts` - Task 1 で作成
  - `src/hooks/useTakeCollapse.ts` - Task 2 で作成
  - `src/hooks/useViewportSync.ts` - Task 3 で作成
  - `src/hooks/useTitleCreditsEdit.ts` - Task 4 で作成
  - `src/hooks/useEditModes.ts` - Task 5 で作成
  - `src/components/SongHeader.tsx` - Task 6 で作成
  - `src/components/EditModeToolbar.tsx` - Task 7 で作成

  **Acceptance Criteria**:
  - [ ] RecordingScreen.tsx が 1200行以下
  - [ ] 全フックが正しくインポート・使用されている
  - [ ] 全コンポーネントが正しくインポート・使用されている
  ```bash
  npm run typecheck
  # Assert: Exit code 0
  
  npm run lint
  # Assert: Exit code 0
  ```

  **For Browser Verification (using Playwright skill):**
  ```
  1. Navigate to: http://localhost:5173
  2. Click: 新規作成 or 既存の曲を選択
  3. Verify: Recording画面が表示される
  4. Click: マーク入力ボタン (1-9)
  5. Verify: マークが入力される
  6. Click: 分割線追加ボタン
  7. Verify: 分割モードに切り替わる
  8. Screenshot: .sisyphus/evidence/task-8-recording-screen.png
  ```

  **Commit**: YES
  - Message: `refactor(screens): integrate hooks and components into RecordingScreen`
  - Files: `src/screens/RecordingScreen.tsx`
  - Pre-commit: `npm run typecheck && npm run lint`

---

- [ ] 9. CompingScreen のリファクタリング

  **What to do**:
  - 作成した5つのフックをインポートして使用
  - 作成した2つのコンポーネントをインポートして使用
  - 重複コードを削除
  - 残る画面固有ロジック:
    - currentPhraseIndex の管理
    - getNextSelectableIndex, getPreviousSelectableIndex
    - handleSelectTake, handleClearSelectedTake
    - handleExport, handlePrint
    - キーボードショートカット (0-9, Delete, Arrow)

  **Must NOT do**:
  - 機能の変更や追加
  - 新しい状態やロジックの追加

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: 大規模なファイル変更、多数のフック/コンポーネント統合
  - **Skills**: []
    - なし - コード統合とリファクタリング

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3 (with Task 8)
  - **Blocks**: Task 10
  - **Blocked By**: Tasks 1, 2, 3, 4, 5, 6, 7

  **References**:
  - `src/screens/CompingScreen.tsx` - 現在のファイル全体
  - `src/hooks/useShortcutFeedback.ts` - Task 1 で作成
  - `src/hooks/useTakeCollapse.ts` - Task 2 で作成
  - `src/hooks/useViewportSync.ts` - Task 3 で作成
  - `src/hooks/useTitleCreditsEdit.ts` - Task 4 で作成
  - `src/hooks/useEditModes.ts` - Task 5 で作成
  - `src/components/SongHeader.tsx` - Task 6 で作成
  - `src/components/EditModeToolbar.tsx` - Task 7 で作成

  **Acceptance Criteria**:
  - [ ] CompingScreen.tsx が 1000行以下
  - [ ] 全フックが正しくインポート・使用されている
  - [ ] 全コンポーネントが正しくインポート・使用されている
  ```bash
  npm run typecheck
  # Assert: Exit code 0
  
  npm run lint
  # Assert: Exit code 0
  ```

  **For Browser Verification (using Playwright skill):**
  ```
  1. Navigate to: http://localhost:5173
  2. Click: 既存の曲を選択
  3. Click: セレクトモードに切り替える
  4. Verify: Comping画面が表示される
  5. Click: テイク選択ボタン
  6. Verify: テイクが選択される
  7. Click: 書き出しボタン
  8. Verify: ファイル保存ダイアログが表示される
  9. Screenshot: .sisyphus/evidence/task-9-comping-screen.png
  ```

  **Commit**: YES
  - Message: `refactor(screens): integrate hooks and components into CompingScreen`
  - Files: `src/screens/CompingScreen.tsx`
  - Pre-commit: `npm run typecheck && npm run lint`

---

### Wave 4: Verification

- [ ] 10. 最終検証とクリーンアップ

  **What to do**:
  - 全体のビルド確認
  - 未使用のインポートがないか確認
  - 行数の最終確認
  - ブラウザでの動作確認

  **Must NOT do**:
  - 新しい機能の追加
  - 追加のリファクタリング（スコープ外）

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: 検証タスクのみ
  - **Skills**: [`playwright`]
    - `playwright`: ブラウザでの動作確認

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Sequential (final)
  - **Blocks**: None
  - **Blocked By**: Tasks 8, 9

  **References**:
  - `src/screens/RecordingScreen.tsx` - Task 8 でリファクタリング済み
  - `src/screens/CompingScreen.tsx` - Task 9 でリファクタリング済み

  **Acceptance Criteria**:
  ```bash
  npm run build
  # Assert: Exit code 0, no warnings
  
  wc -l src/screens/RecordingScreen.tsx
  # Assert: 1200行以下
  
  wc -l src/screens/CompingScreen.tsx
  # Assert: 1000行以下
  ```

  **For Full Browser Verification (using Playwright skill):**
  ```
  1. Start dev server: npm run dev
  2. Navigate to: http://localhost:5173
  3. Create new song with lyrics
  4. Verify: Recording screen - all mark inputs work
  5. Verify: Recording screen - all edit modes work
  6. Verify: Comping screen - take selection works
  7. Verify: Comping screen - export/print works
  8. Screenshot: .sisyphus/evidence/task-10-final-verification.png
  ```

  **Commit**: NO (verification only)

---

## Commit Strategy

| After Task | Message | Files | Verification |
|------------|---------|-------|--------------|
| 1 | `refactor(hooks): add useShortcutFeedback hook` | `src/hooks/useShortcutFeedback.ts` | `npm run typecheck` |
| 2 | `refactor(hooks): add useTakeCollapse hook` | `src/hooks/useTakeCollapse.ts` | `npm run typecheck` |
| 3 | `refactor(hooks): add useViewportSync hook` | `src/hooks/useViewportSync.ts` | `npm run typecheck` |
| 4 | `refactor(hooks): add useTitleCreditsEdit hook` | `src/hooks/useTitleCreditsEdit.ts` | `npm run typecheck` |
| 5 | `refactor(hooks): add useEditModes hook` | `src/hooks/useEditModes.ts` | `npm run typecheck` |
| 6 | `refactor(components): add SongHeader component` | `src/components/SongHeader.tsx` | `npm run typecheck` |
| 7 | `refactor(components): add EditModeToolbar component` | `src/components/EditModeToolbar.tsx` | `npm run typecheck` |
| 8 | `refactor(screens): integrate hooks into RecordingScreen` | `src/screens/RecordingScreen.tsx` | `npm run typecheck && npm run lint` |
| 9 | `refactor(screens): integrate hooks into CompingScreen` | `src/screens/CompingScreen.tsx` | `npm run typecheck && npm run lint` |

---

## Success Criteria

### Verification Commands
```bash
# 行数確認
wc -l src/screens/RecordingScreen.tsx  # Expected: ≤1200
wc -l src/screens/CompingScreen.tsx    # Expected: ≤1000

# ビルド確認
npm run typecheck  # Expected: Exit 0
npm run lint       # Expected: Exit 0
npm run build      # Expected: Exit 0
```

### Final Checklist
- [ ] RecordingScreen.tsx ≤ 1200行
- [ ] CompingScreen.tsx ≤ 1000行
- [ ] 5つのカスタムフック作成済み
- [ ] 2つの共有コンポーネント作成済み
- [ ] TypeScript エラーなし
- [ ] Lint エラーなし
- [ ] ビルド成功
- [ ] Recording画面の全機能動作確認済み
- [ ] Comping画面の全機能動作確認済み
