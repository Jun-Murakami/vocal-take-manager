import { expect, type Page, test } from '@playwright/test';

const BASE_URL = 'http://localhost:5173';

async function createSong(page: Page, title: string, lyrics: string) {
  await page.getByRole('button', { name: '新規' }).click();
  await page.getByLabel('楽曲のタイトル').fill(title);
  await page.getByLabel('歌詞').fill(lyrics);
  await page.getByRole('button', { name: 'OK' }).click();
}

test.describe('コンピング画面 - 基本表示ワークフロー', () => {
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

  test('コンピング画面が表示される', async ({ page }) => {
    await createSong(page, 'コンピングテスト', 'テスト歌詞');
    await page
      .getByRole('button', { name: 'セレクトモードに切り替える' })
      .click();
    await expect(page.getByText('コンピングテスト').first()).toBeVisible();
    await expect(page.getByText('テスト歌詞').first()).toBeVisible();
  });

  test('レコーディング画面と同じ歌詞が表示', async ({ page }) => {
    await createSong(page, '表示確認テスト', '一行目\n二行目');
    await page
      .getByRole('button', { name: 'セレクトモードに切り替える' })
      .click();

    await expect(page.getByText('表示確認テスト').first()).toBeVisible();
  });

  test('レコーディングモードに戻る', async ({ page }) => {
    await createSong(page, '戻るテスト', '歌詞');
    await page
      .getByRole('button', { name: 'セレクトモードに切り替える' })
      .click();
    await page
      .getByRole('button', { name: 'レコーディングモードに戻る' })
      .click();
    await expect(
      page.getByRole('button', { name: 'セレクトモードに切り替える' }),
    ).toBeVisible();
  });

  test('ソングプロジェクトの書き出しボタンが表示される', async ({ page }) => {
    await createSong(page, '書き出しテスト', '歌詞');
    await page
      .getByRole('button', { name: 'セレクトモードに切り替える' })
      .click();
    await expect(
      page.getByRole('button', { name: 'ソングプロジェクトの書き出し' }),
    ).toBeVisible();
  });

  test('印刷ボタンが表示される', async ({ page }) => {
    await createSong(page, '印刷テスト', '歌詞');
    await page
      .getByRole('button', { name: 'セレクトモードに切り替える' })
      .click();
    await expect(
      page.getByRole('button', { name: '印刷 / PDFの書き出し' }),
    ).toBeVisible();
  });
});

test.describe('コンピング画面 - ナビゲーションワークフロー', () => {
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
    await createSong(page, 'ナビゲーションテスト', '最初\n二番目\n三番目');
    await page
      .getByRole('button', { name: 'セレクトモードに切り替える' })
      .click();
  });

  test('削除ボタンが表示される', async ({ page }) => {
    await expect(page.getByRole('button', { name: '削除' })).toBeVisible();
  });

  test('ナビゲーションボタンが表示される', async ({ page }) => {
    await expect(page.getByRole('button', { name: '削除' })).toBeVisible();
  });

  test('テイク選択ボタンが表示される', async ({ page }) => {
    await expect(page.getByRole('button', { name: '1' })).toBeVisible();
  });

  test('フレーズカウンターが表示される', async ({ page }) => {
    await expect(page.getByText(/\d+ \/ \d+/)).toBeVisible();
  });
});

test.describe('コンピング画面 - 終了ワークフロー', () => {
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
    await createSong(page, '終了テスト', '歌詞');
    await page
      .getByRole('button', { name: 'セレクトモードに切り替える' })
      .click();
  });

  test('終了ボタンでホームに戻る', async ({ page }) => {
    await page.getByRole('button', { name: '終了' }).click();
    await expect(
      page.getByRole('heading', { name: 'VOCAL TAKE MANAGER' }),
    ).toBeVisible();
  });

  test('プロジェクトが一覧に表示される', async ({ page }) => {
    await page.getByRole('button', { name: '終了' }).click();
    await expect(page.getByText('終了テスト')).toBeVisible();
  });
});
