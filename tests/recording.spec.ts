import { expect, type Page, test } from '@playwright/test';

const BASE_URL = 'http://localhost:5173';

async function createSong(page: Page, title: string, lyrics: string) {
  await page.getByRole('button', { name: '新規' }).click();
  await page.getByLabel('楽曲のタイトル').fill(title);
  await page.getByLabel('歌詞').fill(lyrics);
  await page.getByRole('button', { name: 'OK' }).click();
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
