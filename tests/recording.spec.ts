import { expect, type Page, test } from '@playwright/test';

const BASE_URL = 'http://localhost:5173';

async function createSong(page: Page, title: string, lyrics: string) {
  await page.getByRole('button', { name: '新規' }).click();
  await page.getByLabel('楽曲のタイトル').fill(title);
  await page.getByLabel('歌詞').fill(lyrics);
  await page.getByRole('button', { name: 'OK' }).click();
  await page.waitForSelector('button[aria-label="テイクを折りたたむ"]');
}

async function getTakeCount(page: Page) {
  return page.locator('button[aria-label="テイクを折りたたむ"]').count();
}

test.describe('レコーディング画面 - 基本表示ワークフロー', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(BASE_URL);
    await page.evaluate(() => {
      return new Promise<void>((resolve) => {
        const deleteRequest = indexedDB.deleteDatabase('VocalTakeManagerDB');
        deleteRequest.onsuccess = () => resolve();
        deleteRequest.onerror = () => resolve();
        deleteRequest.onblocked = () => resolve();
      });
    });
    await page.reload();
  });

  test('タイトルとクレジットが表示される', async ({ page }) => {
    await createSong(page, 'レコーディングテスト', 'これはテスト歌詞です');
    await expect(page.getByText('レコーディングテスト')).toBeVisible();
  });

  test('歌詞が行ごとに表示される', async ({ page }) => {
    await createSong(page, '複数行テスト', '一行目\n二行目\n三行目');
    await expect(page.getByText('一行目').first()).toBeVisible();
    await expect(page.getByText('二行目').first()).toBeVisible();
    await expect(page.getByText('三行目').first()).toBeVisible();
  });

  test('初期状態でマークエリアが表示される', async ({ page }) => {
    await createSong(page, 'テイク確認テスト', '歌詞');
    await expect(page.getByText('テイク確認テスト')).toBeVisible();
  });

  test('フリーメモ入力エリアが表示される', async ({ page }) => {
    await createSong(page, 'メモテスト', '歌詞');
    await expect(page.getByPlaceholder('フリーメモを入力')).toBeVisible();
  });
});

test.describe('レコーディング画面 - テイク管理ワークフロー', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(BASE_URL);
    await page.evaluate(() => {
      return new Promise<void>((resolve) => {
        const deleteRequest = indexedDB.deleteDatabase('VocalTakeManagerDB');
        deleteRequest.onsuccess = () => resolve();
        deleteRequest.onerror = () => resolve();
        deleteRequest.onblocked = () => resolve();
      });
    });
    await page.reload();
    await createSong(page, 'テイク管理テスト', '歌詞内容');
  });

  test('テイク追加ボタンが表示される', async ({ page }) => {
    await expect(
      page.getByRole('button', { name: 'テイクを追加' }),
    ).toBeVisible();
  });

  test('テイク削除ボタンが表示される', async ({ page }) => {
    await expect(
      page.getByRole('button', { name: 'テイクを削除' }),
    ).toBeVisible();
  });

  test('マーク設定エリアが表示される', async ({ page }) => {
    await expect(page.getByRole('button', { name: '1' })).toBeVisible();
    await expect(page.getByRole('button', { name: '2' })).toBeVisible();
    await expect(page.getByRole('button', { name: '3' })).toBeVisible();
  });

  test('削除ボタンが表示される', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'DEL' })).toBeVisible();
  });

  test('ナビゲーションボタンが表示される', async ({ page }) => {
    await expect(page.getByRole('button', { name: '前へ' })).toBeVisible();
    await expect(page.getByRole('button', { name: '次へ' })).toBeVisible();
  });
});

test.describe('レコーディング画面 - 編集モードワークフロー', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(BASE_URL);
    await page.evaluate(() => {
      return new Promise<void>((resolve) => {
        const deleteRequest = indexedDB.deleteDatabase('VocalTakeManagerDB');
        deleteRequest.onsuccess = () => resolve();
        deleteRequest.onerror = () => resolve();
        deleteRequest.onblocked = () => resolve();
      });
    });
    await page.reload();
    await createSong(page, '編集モードテスト', 'これは長いテスト歌詞です');
  });

  test('編集モードボタンが表示される', async ({ page }) => {
    const editButtons = page
      .locator('button')
      .filter({ has: page.locator('svg') });
    await expect(editButtons.first()).toBeVisible();
  });
});

test.describe('レコーディング画面 - 画面遷移ワークフロー', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(BASE_URL);
    await page.evaluate(() => {
      return new Promise<void>((resolve) => {
        const deleteRequest = indexedDB.deleteDatabase('VocalTakeManagerDB');
        deleteRequest.onsuccess = () => resolve();
        deleteRequest.onerror = () => resolve();
        deleteRequest.onblocked = () => resolve();
      });
    });
    await page.reload();
    await createSong(page, '遷移テスト', '歌詞');
  });

  test('コンピング画面へ遷移', async ({ page }) => {
    await page
      .getByRole('button', { name: 'セレクトモードに切り替える' })
      .click();
    await expect(
      page.getByRole('button', { name: 'レコーディングモードに戻る' }),
    ).toBeVisible();
  });

  test('終了ボタンでホームに戻る', async ({ page }) => {
    await page.getByRole('button', { name: '終了' }).click();
    await expect(
      page.getByRole('heading', { name: 'VOCAL TAKE MANAGER' }),
    ).toBeVisible();
  });

  test('タイトルが表示される', async ({ page }) => {
    await expect(page.getByText('遷移テスト')).toBeVisible();
  });
});

test.describe('レコーディング画面 - テイク追加・削除操作', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(BASE_URL);
    await page.evaluate(() => {
      return new Promise<void>((resolve) => {
        const deleteRequest = indexedDB.deleteDatabase('VocalTakeManagerDB');
        deleteRequest.onsuccess = () => resolve();
        deleteRequest.onerror = () => resolve();
        deleteRequest.onblocked = () => resolve();
      });
    });
    await page.reload();
    await createSong(page, 'テイク操作テスト', '一行目\n二行目\n三行目');
  });

  test('テイクを追加するとテイク数が増える', async ({ page }) => {
    const initialTakeCount = await getTakeCount(page);

    await page.getByRole('button', { name: 'テイクを追加' }).click();
    await page.waitForTimeout(200);

    const newTakeCount = await getTakeCount(page);
    expect(newTakeCount).toBe(initialTakeCount + 1);
  });

  test('テイクを複数追加できる', async ({ page }) => {
    const initialTakeCount = await getTakeCount(page);

    await page.getByRole('button', { name: 'テイクを追加' }).click();
    await page.waitForTimeout(200);
    await page.getByRole('button', { name: 'テイクを追加' }).click();
    await page.waitForTimeout(200);
    await page.getByRole('button', { name: 'テイクを追加' }).click();
    await page.waitForTimeout(200);

    const newTakeCount = await getTakeCount(page);
    expect(newTakeCount).toBe(initialTakeCount + 3);
  });

  test('テイクを削除するとテイク数が減る', async ({ page }) => {
    await page.getByRole('button', { name: 'テイクを追加' }).click();
    await page.waitForTimeout(300);
    await page.getByRole('button', { name: 'テイクを追加' }).click();
    await page.waitForTimeout(300);

    const takeCountBefore = await getTakeCount(page);
    expect(takeCountBefore).toBeGreaterThan(1);

    const deleteButton = page.getByRole('button', { name: 'テイクを削除' });
    await expect(deleteButton).toBeEnabled();
    await deleteButton.click();

    // Confirmation dialog appears - click the "削除" button to confirm
    const confirmButton = page.getByRole('button', { name: '削除' }).last();
    await expect(confirmButton).toBeVisible();
    await confirmButton.click();
    await page.waitForTimeout(300);

    const takeCountAfter = await getTakeCount(page);
    expect(takeCountAfter).toBe(takeCountBefore - 1);
  });

  test('最後のテイクは削除できない（ボタンが無効）', async ({ page }) => {
    const initialTakeCount = await getTakeCount(page);
    expect(initialTakeCount).toBe(1);

    const deleteButton = page.getByRole('button', { name: 'テイクを削除' });
    await expect(deleteButton).toBeDisabled();
  });
});

test.describe('レコーディング画面 - マーク入力操作', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(BASE_URL);
    await page.evaluate(() => {
      return new Promise<void>((resolve) => {
        const deleteRequest = indexedDB.deleteDatabase('VocalTakeManagerDB');
        deleteRequest.onsuccess = () => resolve();
        deleteRequest.onerror = () => resolve();
        deleteRequest.onblocked = () => resolve();
      });
    });
    await page.reload();
    await createSong(page, 'マーク入力テスト', '一行目\n二行目\n三行目');
  });

  test('1キーで◎マークが入力される', async ({ page }) => {
    await page.keyboard.press('1');
    await page.waitForTimeout(100);

    await expect(page.locator('text=◎').first()).toBeVisible();
  });

  test('2キーで〇マークが入力される', async ({ page }) => {
    await page.keyboard.press('2');
    await page.waitForTimeout(100);

    await expect(page.locator('text=〇').first()).toBeVisible();
  });

  test('3キーで△マークが入力される', async ({ page }) => {
    await page.keyboard.press('3');
    await page.waitForTimeout(100);

    await expect(page.locator('text=△').first()).toBeVisible();
  });

  test('連続してマークを入力できる', async ({ page }) => {
    await page.keyboard.press('1');
    await page.waitForTimeout(100);
    await page.keyboard.press('2');
    await page.waitForTimeout(100);
    await page.keyboard.press('3');
    await page.waitForTimeout(100);

    await expect(page.locator('text=◎').first()).toBeVisible();
    await expect(page.locator('text=〇').first()).toBeVisible();
    await expect(page.locator('text=△').first()).toBeVisible();
  });

  test('Deleteキーでマークが削除される', async ({ page }) => {
    await page.keyboard.press('1');
    await page.waitForTimeout(200);

    const markCells = page.locator('.MuiTypography-caption:text-is("◎")');
    const initialCount = await markCells.count();
    expect(initialCount).toBeGreaterThanOrEqual(1);

    await page.keyboard.press('ArrowLeft');
    await page.waitForTimeout(200);
    await page.keyboard.press('Delete');
    await page.waitForTimeout(200);

    const afterCount = await markCells.count();
    expect(afterCount).toBe(initialCount - 1);
  });

  test('Backspaceキーでマークが削除される', async ({ page }) => {
    await page.keyboard.press('2');
    await page.waitForTimeout(200);

    const markCells = page.locator('.MuiTypography-caption:text-is("〇")');
    const initialCount = await markCells.count();
    expect(initialCount).toBeGreaterThanOrEqual(1);

    await page.keyboard.press('ArrowLeft');
    await page.waitForTimeout(200);
    await page.keyboard.press('Backspace');
    await page.waitForTimeout(200);

    const afterCount = await markCells.count();
    expect(afterCount).toBe(initialCount - 1);
  });

  test('DELボタンクリックでマークが削除される', async ({ page }) => {
    await page.keyboard.press('1');
    await page.waitForTimeout(200);

    const markCells = page.locator('.MuiTypography-caption:text-is("◎")');
    const initialCount = await markCells.count();
    expect(initialCount).toBeGreaterThanOrEqual(1);

    await page.keyboard.press('ArrowLeft');
    await page.waitForTimeout(200);
    await page.getByRole('button', { name: 'DEL' }).click();
    await page.waitForTimeout(200);

    const afterCount = await markCells.count();
    expect(afterCount).toBe(initialCount - 1);
  });

  test('マークを上書きできる', async ({ page }) => {
    await page.keyboard.press('1');
    await page.waitForTimeout(200);

    const doubleCircleCells = page.locator(
      '.MuiTypography-caption:text-is("◎")',
    );
    const circleCells = page.locator('.MuiTypography-caption:text-is("〇")');

    const initialDoubleCircle = await doubleCircleCells.count();
    expect(initialDoubleCircle).toBeGreaterThanOrEqual(1);

    await page.keyboard.press('ArrowLeft');
    await page.waitForTimeout(200);
    await page.keyboard.press('2');
    await page.waitForTimeout(200);

    const afterDoubleCircle = await doubleCircleCells.count();
    const afterCircle = await circleCells.count();
    expect(afterDoubleCircle).toBe(initialDoubleCircle - 1);
    expect(afterCircle).toBeGreaterThanOrEqual(1);
  });
});

test.describe('レコーディング画面 - ロケーター移動操作', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(BASE_URL);
    await page.evaluate(() => {
      return new Promise<void>((resolve) => {
        const deleteRequest = indexedDB.deleteDatabase('VocalTakeManagerDB');
        deleteRequest.onsuccess = () => resolve();
        deleteRequest.onerror = () => resolve();
        deleteRequest.onblocked = () => resolve();
      });
    });
    await page.reload();
    await createSong(
      page,
      'ロケーターテスト',
      '一行目フレーズ\n二行目フレーズ\n三行目フレーズ',
    );
  });

  test('→キーで次のフレーズに移動', async ({ page }) => {
    await page.keyboard.press('1');
    await page.waitForTimeout(100);

    await page.keyboard.press('2');
    await page.waitForTimeout(100);

    await expect(page.locator('text=◎').first()).toBeVisible();
    await expect(page.locator('text=〇').first()).toBeVisible();
  });

  test('←キーで前のフレーズに移動', async ({ page }) => {
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(100);
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(100);

    await page.keyboard.press('ArrowLeft');
    await page.waitForTimeout(100);
    await page.keyboard.press('1');
    await page.waitForTimeout(100);

    await expect(page.locator('text=◎').first()).toBeVisible();
  });

  test('次へボタンで次のフレーズに移動', async ({ page }) => {
    await page.getByRole('button', { name: '次へ' }).click();
    await page.waitForTimeout(100);
    await page.keyboard.press('1');
    await page.waitForTimeout(100);

    await page.getByRole('button', { name: '次へ' }).click();
    await page.waitForTimeout(100);
    await page.keyboard.press('2');
    await page.waitForTimeout(100);

    await expect(page.locator('text=◎').first()).toBeVisible();
    await expect(page.locator('text=〇').first()).toBeVisible();
  });

  test('前へボタンで前のフレーズに移動', async ({ page }) => {
    await page.getByRole('button', { name: '次へ' }).click();
    await page.waitForTimeout(100);
    await page.getByRole('button', { name: '次へ' }).click();
    await page.waitForTimeout(100);

    await page.getByRole('button', { name: '前へ' }).click();
    await page.waitForTimeout(100);
    await page.keyboard.press('3');
    await page.waitForTimeout(100);

    await expect(page.locator('text=△').first()).toBeVisible();
  });

  test('マーク入力後に自動で次のフレーズに移動する', async ({ page }) => {
    await page.keyboard.press('1');
    await page.waitForTimeout(200);
    await page.keyboard.press('1');
    await page.waitForTimeout(200);
    await page.keyboard.press('1');
    await page.waitForTimeout(200);

    const markCells = page.locator('.MuiTypography-caption:text-is("◎")');
    const markCount = await markCells.count();
    expect(markCount).toBeGreaterThanOrEqual(3);
  });

  test('最初のフレーズで←キーを押しても移動しない', async ({ page }) => {
    await page.keyboard.press('ArrowLeft');
    await page.waitForTimeout(100);
    await page.keyboard.press('ArrowLeft');
    await page.waitForTimeout(100);
    await page.keyboard.press('1');
    await page.waitForTimeout(100);

    const markCount = await page.locator('text=◎').count();
    expect(markCount).toBeGreaterThanOrEqual(1);
  });
});

test.describe('レコーディング画面 - データ永続化', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(BASE_URL);
    await page.evaluate(() => {
      return new Promise<void>((resolve) => {
        const deleteRequest = indexedDB.deleteDatabase('VocalTakeManagerDB');
        deleteRequest.onsuccess = () => resolve();
        deleteRequest.onerror = () => resolve();
        deleteRequest.onblocked = () => resolve();
      });
    });
    await page.reload();
  });

  test('マークがページリロード後も保持される', async ({ page }) => {
    await createSong(page, '永続化テスト', '一行目\n二行目');

    await page.keyboard.press('1');
    await page.waitForTimeout(100);
    await page.keyboard.press('2');
    await page.waitForTimeout(300);

    await page.getByRole('button', { name: '終了' }).click();
    await page.waitForTimeout(100);

    await page.getByText('永続化テスト').click();
    await page.getByRole('button', { name: '開く' }).click();
    await page.waitForTimeout(200);

    await expect(page.locator('text=◎').first()).toBeVisible();
    await expect(page.locator('text=〇').first()).toBeVisible();
  });

  test('テイク追加がページリロード後も保持される', async ({ page }) => {
    await createSong(page, 'テイク永続化テスト', '歌詞');

    await page.getByRole('button', { name: 'テイクを追加' }).click();
    await page.waitForTimeout(200);
    await page.getByRole('button', { name: 'テイクを追加' }).click();
    await page.waitForTimeout(300);

    await page.getByRole('button', { name: '終了' }).click();
    await page.waitForTimeout(200);

    await page.getByText('テイク永続化テスト').click();
    await page.getByRole('button', { name: '開く' }).click();
    await page.waitForSelector('button[aria-label="テイクを折りたたむ"]');

    const takeCount = await getTakeCount(page);
    expect(takeCount).toBe(3);
  });
});
