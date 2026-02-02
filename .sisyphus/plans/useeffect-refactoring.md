# useEffect Anti-Pattern Refactoring

## TL;DR

> **Quick Summary**: Refactor React 19 application to eliminate useEffect anti-patterns where user interactions trigger state changes that then trigger side effects via useEffect. Replace with direct handler patterns.
> 
> **Deliverables**:
> - App.tsx: Remove duplicate useEffect
> - RecordingScreen.tsx: Create unified selection helpers, optimize keyboard handler
> - CompingScreen.tsx: Optimize keyboard handler, clean up collapsedTakeIds
> 
> **Estimated Effort**: Medium (3-4 hours)
> **Parallel Execution**: YES - 3 waves
> **Critical Path**: Task 1 (App.tsx) → Task 2 (RecordingScreen helpers) → Task 4 (Update call sites) → Task 6 (Keyboard handlers)

---

## Context

### Original Request
Refactor useEffect anti-patterns in a React 19 application (Vocal Take Manager). User interaction should directly trigger handlers instead of relying on useEffect to detect value changes.

### Interview Summary
**Key Discussions**:
- Identified 6 anti-pattern useEffects across 3 files
- Confirmed legitimate useEffects to preserve (subscriptions, initializations)
- React Compiler LSP errors confirm unstable function dependencies

**Research Findings**:
- RecordingScreen: 11 setSelectedPhraseId calls, 6 setSelectedTakeId calls need updating
- CompingScreen: 10 setCurrentPhraseIndex calls (NO auto-scroll needed - intentional design)
- `suppressAutoScrollRef` exists in RecordingScreen for rehearsal mark operations - must preserve
- collapsedTakeIds cleanup runs on every song change, can be optimized

### Gap Analysis (Self-Conducted)
**Identified Gaps** (addressed):
- Edge case: What if scroll ref is null when calling helper? → Add null check in helper
- Edge case: suppressAutoScrollRef behavior must be preserved → Pass optional flag to helper
- Optimization: collapsedTakeIds could filter by takes change only → Add takes dependency check
- React 19: useCallback may not be needed with React Compiler → Still use for clarity, compiler will optimize

---

## Work Objectives

### Core Objective
Eliminate useEffect anti-patterns by moving side effects directly into event handlers, improving code clarity and reducing unnecessary re-renders.

### Concrete Deliverables
- `src/App.tsx`: Lines 122-151 deleted (duplicate useEffect)
- `src/screens/RecordingScreen.tsx`: 
  - New `selectPhraseWithScroll()` and `selectTakeWithScroll()` helpers
  - All state setter calls updated to use helpers
  - Keyboard handler functions wrapped in useCallback
  - Auto-scroll useEffect removed (lines 714-722, 1064-1071)
- `src/screens/CompingScreen.tsx`:
  - Keyboard handler functions wrapped in useCallback
  - collapsedTakeIds cleanup optimized

### Definition of Done
- [ ] `npm run lint` passes with no new errors
- [ ] `npm run build` completes successfully  
- [ ] Application runs without console errors
- [ ] Keyboard navigation (arrow keys) works in RecordingScreen
- [ ] Keyboard navigation (arrow keys) works in CompingScreen
- [ ] Clicking phrases scrolls view appropriately in RecordingScreen
- [ ] Adding/removing takes scrolls to correct position
- [ ] No regression in existing functionality

### Must Have
- All user interactions directly trigger both state change AND side effect
- Preserve suppressAutoScrollRef behavior for rehearsal marks
- Preserve intentional no-scroll behavior in CompingScreen

### Must NOT Have (Guardrails)
- DO NOT touch legitimate useEffects (subscriptions, document.title, window resize, data loading)
- DO NOT change business logic or feature behavior
- DO NOT add new dependencies to package.json
- DO NOT refactor unrelated code (no scope creep)
- DO NOT change the CompingScreen phrase navigation to include scrolling (intentionally disabled)

---

## Verification Strategy (MANDATORY)

### Test Decision
- **Infrastructure exists**: YES (Vitest, Playwright)
- **User wants tests**: NO (not requested)
- **Framework**: N/A for this task
- **QA approach**: Manual verification via existing app functionality

### Automated Verification (Agent-Executable)

Each task includes verification commands the agent can run directly.

---

## Execution Strategy

### Parallel Execution Waves

```
Wave 1 (Start Immediately):
├── Task 1: Delete duplicate useEffect in App.tsx [no dependencies]
└── Task 2: Create helper functions in RecordingScreen [no dependencies]

Wave 2 (After Wave 1):
├── Task 3: Optimize collapsedTakeIds cleanup [depends: none, but logically after T2]
├── Task 4: Update all call sites in RecordingScreen [depends: 2]
└── Task 5: Remove old auto-scroll useEffects [depends: 4]

Wave 3 (After Wave 2):
├── Task 6: Wrap keyboard handlers in useCallback (RecordingScreen) [depends: 5]
└── Task 7: Wrap keyboard handlers in useCallback (CompingScreen) [depends: none, parallel with 6]

Wave 4 (Final):
└── Task 8: Final verification and cleanup [depends: 6, 7]
```

### Dependency Matrix

| Task | Depends On | Blocks | Can Parallelize With |
|------|------------|--------|---------------------|
| 1 | None | None | 2 |
| 2 | None | 4 | 1 |
| 3 | None | None | 4, 5 |
| 4 | 2 | 5 | 3 |
| 5 | 4 | 6 | None |
| 6 | 5 | 8 | 7 |
| 7 | None | 8 | 6 |
| 8 | 6, 7 | None | None (final) |

### Agent Dispatch Summary

| Wave | Tasks | Recommended Approach |
|------|-------|---------------------|
| 1 | 1, 2 | Parallel execution - independent files |
| 2 | 3, 4, 5 | Sequential within RecordingScreen |
| 3 | 6, 7 | Parallel - different files |
| 4 | 8 | Sequential verification |

---

## TODOs

- [ ] 1. Delete duplicate useEffect in App.tsx

  **What to do**:
  - Delete the entire useEffect block at lines 122-151
  - This is an exact duplicate of lines 73-115 but missing custom vtm:print events
  - The first useEffect (73-115) is more complete and should be kept

  **Must NOT do**:
  - Do NOT delete lines 73-115 (the original, more complete version)
  - Do NOT modify the preload tokenizer useEffect at line 158

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Simple deletion task, single file, clear target
  - **Skills**: []
    - No special skills needed for deletion
  - **Skills Evaluated but Omitted**:
    - `git-master`: Not needed for single edit

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Task 2)
  - **Blocks**: None
  - **Blocked By**: None (can start immediately)

  **References**:
  - `src/App.tsx:73-115` - The ORIGINAL useEffect to KEEP (more complete, has vtm:print events)
  - `src/App.tsx:122-151` - The DUPLICATE to DELETE (less complete, missing vtm:print events)

  **Acceptance Criteria**:
  - [ ] Lines 122-151 in App.tsx are deleted
  - [ ] Lines 73-115 remain unchanged
  - [ ] `npm run build` passes

  ```bash
  # Agent runs:
  npm run build 2>&1 | head -20
  # Assert: "build" completes without errors
  ```

  **Commit**: YES
  - Message: `fix(app): remove duplicate print mode useEffect`
  - Files: `src/App.tsx`
  - Pre-commit: `npm run lint -- src/App.tsx`

---

- [ ] 2. Create unified selection helper functions in RecordingScreen

  **What to do**:
  - Create `selectPhraseWithScroll(phraseId: string, options?: { suppressScroll?: boolean })` function
    - Sets `selectedPhraseId` state
    - If `!options?.suppressScroll` AND `!suppressAutoScrollRef.current`, calls `scrollToLine(phrase.lineIndex)`
  - Create `selectTakeWithScroll(takeId: string)` function
    - Sets `selectedTakeId` state
    - Scrolls `marksScrollRef.current` horizontally to show the take column
  - Place these functions after the existing scroll functions (around line 710)

  **Must NOT do**:
  - Do NOT modify the existing `scrollToLine` function
  - Do NOT change the `suppressAutoScrollRef` logic
  - Do NOT update call sites yet (Task 4)

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
    - Reason: React component modification with scroll behavior
  - **Skills**: []
    - Standard React patterns, no special skills needed
  - **Skills Evaluated but Omitted**:
    - `frontend-ui-ux`: Not needed, no UI changes

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Task 1)
  - **Blocks**: Task 4
  - **Blocked By**: None (can start immediately)

  **References**:
  - `src/screens/RecordingScreen.tsx:714-722` - Current horizontal scroll useEffect (extract logic into helper)
  - `src/screens/RecordingScreen.tsx:1064-1071` - Current vertical scroll useEffect (extract logic into helper)
  - `src/screens/RecordingScreen.tsx:1041-1059` - `scrollToLine` function (call from helper)
  - `src/screens/RecordingScreen.tsx:206` - `marksScrollRef` declaration
  - `src/screens/RecordingScreen.tsx:118` - `suppressAutoScrollRef` declaration
  - `src/screens/RecordingScreen.tsx:167` - `takeColumnWidth` constant (used for scroll calculation)

  **Acceptance Criteria**:
  - [ ] `selectPhraseWithScroll` function exists and compiles
  - [ ] `selectTakeWithScroll` function exists and compiles
  - [ ] Functions are placed after line 700 (near scroll-related code)
  - [ ] `npm run lint -- src/screens/RecordingScreen.tsx` passes

  ```bash
  # Agent runs:
  npm run lint -- src/screens/RecordingScreen.tsx 2>&1 | head -20
  # Assert: No errors (warnings OK)
  
  grep -n "selectPhraseWithScroll\|selectTakeWithScroll" src/screens/RecordingScreen.tsx | head -5
  # Assert: Both function names appear
  ```

  **Commit**: NO (groups with Task 4)

---

- [ ] 3. Optimize collapsedTakeIds cleanup in both screens

  **What to do**:
  - In RecordingScreen.tsx (lines 440-452):
    - Add a ref to track previous takes length: `const prevTakesLengthRef = useRef(song?.takes.length ?? 0)`
    - Modify useEffect to only run cleanup when takes array actually changes (not on every song update)
    - Alternative: Move cleanup logic into `handleSaveSong` when takes are modified
  - Apply same pattern to CompingScreen.tsx (lines 291-303)

  **Must NOT do**:
  - Do NOT remove the cleanup logic entirely (it's needed for consistency)
  - Do NOT change the filtering logic itself

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Small optimization, clear pattern to follow
  - **Skills**: []
    - Standard React patterns
  - **Skills Evaluated but Omitted**:
    - `visual-engineering`: No UI impact

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 4, 5)
  - **Blocks**: None
  - **Blocked By**: None (logically follows Task 2 but no hard dependency)

  **References**:
  - `src/screens/RecordingScreen.tsx:440-452` - Current cleanup useEffect
  - `src/screens/CompingScreen.tsx:291-303` - Same pattern in CompingScreen
  - `src/screens/RecordingScreen.tsx:132-134` - collapsedTakeIds state declaration

  **Acceptance Criteria**:
  - [ ] Cleanup only runs when takes array changes (add/remove take)
  - [ ] Both RecordingScreen and CompingScreen updated consistently
  - [ ] `npm run lint` passes for both files

  ```bash
  # Agent runs:
  npm run lint -- src/screens/RecordingScreen.tsx src/screens/CompingScreen.tsx 2>&1 | head -20
  # Assert: No errors
  ```

  **Commit**: YES
  - Message: `perf(screens): optimize collapsedTakeIds cleanup to run only on takes change`
  - Files: `src/screens/RecordingScreen.tsx`, `src/screens/CompingScreen.tsx`
  - Pre-commit: `npm run lint`

---

- [ ] 4. Update all call sites to use new helper functions in RecordingScreen

  **What to do**:
  - Replace `setSelectedPhraseId(...)` with `selectPhraseWithScroll(...)` at these locations:
    - Line 306: Initial load → `selectPhraseWithScroll(firstPhrase.id)`
    - Line 509: moveToNextPhrase → `selectPhraseWithScroll(nextPhrase.id)`
    - Line 531: moveToPreviousPhrase → `selectPhraseWithScroll(previousPhrase.id)`
    - Line 733: handleManualSplit → `selectPhraseWithScroll(phraseId, { suppressScroll: true })`
    - Lines 978, 987: handleDeleteLyricsLine → `selectPhraseWithScroll(...)`
    - Line 990: Clear selection → Keep as `setSelectedPhraseId(null)` (no scroll needed)
    - Line 1035: handleManualDeleteDivider → `selectPhraseWithScroll(mergedPhraseId)`
    - Line 1470: Phrase click → `selectPhraseWithScroll(phrase.id)`
    - Line 2149: Mark area click → `selectPhraseWithScroll(phrase.id)`
  
  - Replace `setSelectedTakeId(...)` with `selectTakeWithScroll(...)` at these locations:
    - Line 309: Initial load → Keep as `setSelectedTakeId(...)` (first take, no scroll needed)
    - Line 1088: handleAddTake → `selectTakeWithScroll(newTake.id)`
    - Line 1105: handleRemoveTake → `selectTakeWithScroll(updatedSong.takes[...].id)`
    - Line 1788: Take header click → `selectTakeWithScroll(take.id)`
    - Line 2150: Mark area click → `selectTakeWithScroll(take.id)`

  **Must NOT do**:
  - Do NOT change the logic flow, only the function calls
  - Do NOT update CompingScreen (it intentionally has no auto-scroll)

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
    - Reason: Multiple coordinated edits in React component
  - **Skills**: []
    - Standard search and replace patterns
  - **Skills Evaluated but Omitted**:
    - `git-master`: Not needed for edits

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Sequential (after Task 2)
  - **Blocks**: Task 5
  - **Blocked By**: Task 2

  **References**:
  - `src/screens/RecordingScreen.tsx:306` - Initial phrase selection
  - `src/screens/RecordingScreen.tsx:509` - moveToNextPhrase
  - `src/screens/RecordingScreen.tsx:531` - moveToPreviousPhrase
  - `src/screens/RecordingScreen.tsx:733` - handleManualSplit (needs suppressScroll)
  - `src/screens/RecordingScreen.tsx:978,987,990` - handleDeleteLyricsLine
  - `src/screens/RecordingScreen.tsx:1035` - handleManualDeleteDivider
  - `src/screens/RecordingScreen.tsx:1470` - Phrase click handler
  - `src/screens/RecordingScreen.tsx:2149` - Mark area phrase click
  - `src/screens/RecordingScreen.tsx:1088` - handleAddTake
  - `src/screens/RecordingScreen.tsx:1105` - handleRemoveTake
  - `src/screens/RecordingScreen.tsx:1788` - Take header click
  - `src/screens/RecordingScreen.tsx:2150` - Mark area take click

  **Acceptance Criteria**:
  - [ ] All 11 setSelectedPhraseId calls reviewed and updated appropriately
  - [ ] All 6 setSelectedTakeId calls reviewed and updated appropriately
  - [ ] No direct calls to setSelectedPhraseId remain (except null case)
  - [ ] `npm run lint -- src/screens/RecordingScreen.tsx` passes

  ```bash
  # Agent runs:
  grep -n "setSelectedPhraseId\|setSelectedTakeId" src/screens/RecordingScreen.tsx
  # Assert: Only state declarations and null assignments remain
  
  npm run lint -- src/screens/RecordingScreen.tsx 2>&1 | head -20
  # Assert: No errors
  ```

  **Commit**: NO (groups with Task 5)

---

- [ ] 5. Remove old auto-scroll useEffects from RecordingScreen

  **What to do**:
  - Delete the horizontal scroll useEffect at lines 714-722:
    ```tsx
    useEffect(() => {
      if (!song || !selectedTakeId || !marksScrollRef.current) return;
      // ... scroll logic
    }, [song, selectedTakeId]);
    ```
  - Delete the vertical scroll useEffect at lines 1064-1071:
    ```tsx
    useEffect(() => {
      if (!song || !selectedPhraseId) return;
      // ... scrollToLine logic
    }, [song, selectedPhraseId, scrollToLine]);
    ```
  - These are now handled by the helper functions from Task 2

  **Must NOT do**:
  - Do NOT delete any other useEffects
  - Do NOT modify the scrollToLine function itself

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Simple deletion of two code blocks
  - **Skills**: []
    - No special skills needed
  - **Skills Evaluated but Omitted**:
    - None

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Sequential (after Task 4)
  - **Blocks**: Task 6
  - **Blocked By**: Task 4

  **References**:
  - `src/screens/RecordingScreen.tsx:714-722` - Horizontal scroll useEffect to DELETE
  - `src/screens/RecordingScreen.tsx:1064-1071` - Vertical scroll useEffect to DELETE

  **Acceptance Criteria**:
  - [ ] useEffect with `[song, selectedTakeId]` dependency no longer exists
  - [ ] useEffect with `[song, selectedPhraseId, scrollToLine]` dependency no longer exists
  - [ ] `npm run build` passes
  - [ ] Application compiles without errors

  ```bash
  # Agent runs:
  npm run build 2>&1 | tail -10
  # Assert: Build succeeds
  
  grep -n "selectedTakeId\]" src/screens/RecordingScreen.tsx
  # Assert: No useEffect dependency arrays with just selectedTakeId
  ```

  **Commit**: YES
  - Message: `refactor(recording): replace auto-scroll useEffects with direct handler calls`
  - Files: `src/screens/RecordingScreen.tsx`
  - Pre-commit: `npm run build`

---

- [ ] 6. Wrap keyboard handler functions in useCallback (RecordingScreen)

  **What to do**:
  - Wrap these functions in `useCallback` with appropriate dependencies:
    - `handleMarkInput` - deps: `[song, selectedPhraseId, selectedTakeId, markSymbols, handleSaveSong, selectPhraseWithScroll]`
    - `handleClearMark` - deps: `[song, selectedPhraseId, selectedTakeId, handleSaveSong]`
    - `handleMemoInput` - deps: `[song, selectedPhraseId, selectedTakeId, handleSaveSong, showDialog]`
    - `triggerShortcutFeedback` - deps: `[]` (no dependencies, just sets timeout state)
    - `moveToNextPhrase` - deps: `[song, selectedPhraseId, selectPhraseWithScroll]`
    - `moveToPreviousPhrase` - deps: `[song, selectedPhraseId, selectPhraseWithScroll]`
  - Update the keyboard useEffect dependency array to use these stable references

  **Must NOT do**:
  - Do NOT change the logic inside the handler functions
  - Do NOT modify the keyboard event handler logic itself

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
    - Reason: React patterns with useCallback and dependencies
  - **Skills**: []
    - Standard React optimization patterns
  - **Skills Evaluated but Omitted**:
    - None needed

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3 (with Task 7)
  - **Blocks**: Task 8
  - **Blocked By**: Task 5

  **References**:
  - `src/screens/RecordingScreen.tsx:538-560` - handleMarkInput function
  - `src/screens/RecordingScreen.tsx:594-599` - handleClearMark function
  - `src/screens/RecordingScreen.tsx:562-590` - handleMemoInput function
  - `src/screens/RecordingScreen.tsx:385-395` - triggerShortcutFeedback function
  - `src/screens/RecordingScreen.tsx:494-511` - moveToNextPhrase function
  - `src/screens/RecordingScreen.tsx:516-533` - moveToPreviousPhrase function
  - `src/screens/RecordingScreen.tsx:602-687` - Keyboard useEffect with dependency array

  **Acceptance Criteria**:
  - [ ] All 6 handler functions wrapped in useCallback
  - [ ] Keyboard useEffect dependency array updated
  - [ ] LSP errors about unstable dependencies are resolved
  - [ ] `npm run lint` passes

  ```bash
  # Agent runs:
  npm run lint -- src/screens/RecordingScreen.tsx 2>&1 | grep -i "error" | head -10
  # Assert: No errors about "changes on every re-render"
  ```

  **Commit**: YES
  - Message: `perf(recording): stabilize keyboard handler dependencies with useCallback`
  - Files: `src/screens/RecordingScreen.tsx`
  - Pre-commit: `npm run lint`

---

- [ ] 7. Wrap keyboard handler functions in useCallback (CompingScreen)

  **What to do**:
  - Wrap these functions in `useCallback`:
    - `handleSelectTake` - deps: `[song, currentPhraseIndex, handleSaveSong, getNextSelectableIndex]`
    - `handlePrevPhrase` - deps: `[song, currentPhraseIndex, getPreviousSelectableIndex]`
    - `handleNextPhrase` - deps: `[song, currentPhraseIndex, getNextSelectableIndex]`
    - `handleClearSelectedTake` - deps: `[song, currentPhraseIndex, handleSaveSong]`
    - `triggerShortcutFeedback` - deps: `[]`
  - Update the keyboard useEffect dependency array

  **Must NOT do**:
  - Do NOT add auto-scroll to CompingScreen (intentionally disabled per design)
  - Do NOT change the navigation logic

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
    - Reason: React patterns with useCallback
  - **Skills**: []
    - Standard React optimization patterns
  - **Skills Evaluated but Omitted**:
    - None needed

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3 (with Task 6)
  - **Blocks**: Task 8
  - **Blocked By**: None

  **References**:
  - `src/screens/CompingScreen.tsx:619-655` - handleSelectTake function
  - `src/screens/CompingScreen.tsx:658-662` - handlePrevPhrase function
  - `src/screens/CompingScreen.tsx:664-668` - handleNextPhrase function
  - `src/screens/CompingScreen.tsx:602-617` - handleClearSelectedTake function
  - `src/screens/CompingScreen.tsx:232-242` - triggerShortcutFeedback function
  - `src/screens/CompingScreen.tsx:671-736` - Keyboard useEffect with dependency array

  **Acceptance Criteria**:
  - [ ] All 5 handler functions wrapped in useCallback
  - [ ] Keyboard useEffect dependency array updated
  - [ ] LSP errors about unstable dependencies are resolved
  - [ ] `npm run lint` passes

  ```bash
  # Agent runs:
  npm run lint -- src/screens/CompingScreen.tsx 2>&1 | grep -i "error" | head -10
  # Assert: No errors about "changes on every re-render"
  ```

  **Commit**: YES
  - Message: `perf(comping): stabilize keyboard handler dependencies with useCallback`
  - Files: `src/screens/CompingScreen.tsx`
  - Pre-commit: `npm run lint`

---

- [ ] 8. Final verification and cleanup

  **What to do**:
  - Run full lint check across all modified files
  - Run build to ensure no compilation errors
  - Start dev server and manually verify:
    - RecordingScreen: Arrow key navigation scrolls view
    - RecordingScreen: Clicking phrase scrolls view
    - RecordingScreen: Adding take scrolls to new take
    - CompingScreen: Arrow key navigation works (no scroll expected)
    - Print functionality still works (App.tsx change)

  **Must NOT do**:
  - Do NOT make additional changes unless verification fails

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Verification only, no complex changes
  - **Skills**: [`playwright`]
    - For browser-based verification
  - **Skills Evaluated but Omitted**:
    - None needed

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Final (sequential)
  - **Blocks**: None (final task)
  - **Blocked By**: Tasks 6, 7

  **References**:
  - All modified files from previous tasks
  - `package.json` - npm scripts for lint/build

  **Acceptance Criteria**:
  - [ ] `npm run lint` passes with no errors
  - [ ] `npm run build` succeeds
  - [ ] Dev server starts without errors

  ```bash
  # Agent runs:
  npm run lint 2>&1 | tail -5
  # Assert: No errors
  
  npm run build 2>&1 | tail -5
  # Assert: Build succeeds
  
  # Start dev server and verify in browser via playwright
  ```

  **For Browser Verification** (using playwright skill):
  ```
  1. Navigate to: http://localhost:5173
  2. Click on any song to open RecordingScreen
  3. Click on a phrase in the middle of the list
  4. Assert: View scrolls to center the clicked phrase
  5. Press ArrowRight key
  6. Assert: View scrolls to next phrase
  7. Click "Add Take" button
  8. Assert: View scrolls horizontally to show new take
  9. Screenshot: .sisyphus/evidence/task-8-recording-scroll.png
  10. Navigate to CompingScreen
  11. Press ArrowLeft/ArrowRight keys
  12. Assert: Navigation works (no scroll expected)
  ```

  **Commit**: NO (verification only)

---

## Commit Strategy

| After Task | Message | Files | Verification |
|------------|---------|-------|--------------|
| 1 | `fix(app): remove duplicate print mode useEffect` | App.tsx | npm run build |
| 3 | `perf(screens): optimize collapsedTakeIds cleanup to run only on takes change` | RecordingScreen.tsx, CompingScreen.tsx | npm run lint |
| 5 | `refactor(recording): replace auto-scroll useEffects with direct handler calls` | RecordingScreen.tsx | npm run build |
| 6 | `perf(recording): stabilize keyboard handler dependencies with useCallback` | RecordingScreen.tsx | npm run lint |
| 7 | `perf(comping): stabilize keyboard handler dependencies with useCallback` | CompingScreen.tsx | npm run lint |

---

## Success Criteria

### Verification Commands
```bash
npm run lint          # Expected: 0 errors
npm run build         # Expected: Build succeeds
npm run dev           # Expected: Server starts, app works
```

### Final Checklist
- [ ] All "Must Have" present (direct handler patterns)
- [ ] All "Must NOT Have" absent (legitimate useEffects untouched)
- [ ] LSP errors about unstable dependencies resolved
- [ ] Keyboard navigation works in both screens
- [ ] Scroll behavior works in RecordingScreen
- [ ] No scroll in CompingScreen (intentional)
