import { expect, type Page, test } from '@playwright/test';

const BASE_URL = 'http://localhost:5173';

async function createSong(page: Page, title: string, lyrics: string) {
  await page.getByRole('button', { name: '新規' }).click();
  await page.getByLabel('楽曲のタイトル').fill(title);
  await page.getByLabel('歌詞').fill(lyrics);
  await page.getByRole('button', { name: 'OK' }).click();
  await page.waitForSelector('button[aria-label="テイクを折りたたむ"]');
}

async function addTakes(page: Page, count: number) {
  const addButton = page.getByRole('button', { name: 'テイクを追加' });
  for (let i = 0; i < count; i++) {
    await addButton.click();
    await page.waitForTimeout(100);
  }
}

async function getTakeMemoInput(page: Page, takeNumber: number) {
  return page.getByPlaceholder(`T${takeNumber} メモ`);
}

async function goToCompingScreen(page: Page) {
  await page
    .getByRole('button', { name: 'セレクトモードに切り替える' })
    .click();
  await expect(
    page.getByRole('button', { name: 'レコーディングモードに戻る' }),
  ).toBeVisible();
  await page.waitForTimeout(200);
}

test.describe('テイクメモ - レコーディング画面', () => {
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
    await createSong(page, 'テイクメモテスト', '一行目\n二行目\n三行目');
  });

  test('初期テイクのメモ入力欄が表示される', async ({ page }) => {
    const memoInput = await getTakeMemoInput(page, 1);
    await expect(memoInput).toBeVisible();
  });

  test('テイク追加時にメモ入力欄が追加される', async ({ page }) => {
    await addTakes(page, 2);

    const memo1 = await getTakeMemoInput(page, 1);
    const memo2 = await getTakeMemoInput(page, 2);
    const memo3 = await getTakeMemoInput(page, 3);

    await expect(memo1).toBeVisible();
    await expect(memo2).toBeVisible();
    await expect(memo3).toBeVisible();
  });

  test('テイクメモに文字を入力できる', async ({ page }) => {
    const memoInput = await getTakeMemoInput(page, 1);
    await memoInput.fill('テスト用メモ');

    await expect(memoInput).toHaveValue('テスト用メモ');
  });

  test('複数テイクのメモに別々の内容を入力できる', async ({ page }) => {
    await addTakes(page, 2);

    const memo1 = await getTakeMemoInput(page, 1);
    const memo2 = await getTakeMemoInput(page, 2);
    const memo3 = await getTakeMemoInput(page, 3);

    await memo1.fill('テイク1のメモ');
    await memo2.fill('テイク2のメモ');
    await memo3.fill('テイク3のメモ');

    await expect(memo1).toHaveValue('テイク1のメモ');
    await expect(memo2).toHaveValue('テイク2のメモ');
    await expect(memo3).toHaveValue('テイク3のメモ');
  });

  test('テイクメモが保存され再表示時に復元される', async ({ page }) => {
    const memoInput = await getTakeMemoInput(page, 1);
    await memoInput.fill('永続化テストメモ');
    await memoInput.blur();
    await page.waitForTimeout(300);

    await page.getByRole('button', { name: '終了' }).click();
    await page.waitForTimeout(100);

    await page.getByText('テイクメモテスト').click();
    await page.getByRole('button', { name: '開く' }).click();
    await page.waitForTimeout(200);

    const restoredMemo = await getTakeMemoInput(page, 1);
    await expect(restoredMemo).toHaveValue('永続化テストメモ');
  });

  test('複数テイクメモが保存され再表示時に復元される', async ({ page }) => {
    await addTakes(page, 1);

    const memo1 = await getTakeMemoInput(page, 1);
    const memo2 = await getTakeMemoInput(page, 2);

    await memo1.fill('メモ1');
    await memo1.blur();
    await memo2.fill('メモ2');
    await memo2.blur();
    await page.waitForTimeout(300);

    await page.getByRole('button', { name: '終了' }).click();
    await page.waitForTimeout(100);

    await page.getByText('テイクメモテスト').click();
    await page.getByRole('button', { name: '開く' }).click();
    await page.waitForTimeout(200);

    const restoredMemo1 = await getTakeMemoInput(page, 1);
    const restoredMemo2 = await getTakeMemoInput(page, 2);

    await expect(restoredMemo1).toHaveValue('メモ1');
    await expect(restoredMemo2).toHaveValue('メモ2');
  });

  test('テイク削除時に対応するメモも削除される', async ({ page }) => {
    await addTakes(page, 1);

    const memo2 = await getTakeMemoInput(page, 2);
    await memo2.fill('削除されるメモ');
    await memo2.blur();
    await page.waitForTimeout(200);

    await page.getByRole('button', { name: 'テイクを削除' }).click();
    const confirmButton = page.getByRole('button', { name: '削除' }).last();
    await confirmButton.click();
    await page.waitForTimeout(300);

    await expect(memo2).not.toBeVisible();
  });
});

test.describe('テイクメモ - コンピング画面', () => {
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
    await createSong(page, 'コンピングメモテスト', '一行目\n二行目\n三行目');
    await goToCompingScreen(page);
  });

  test('初期テイクのメモ入力欄が表示される', async ({ page }) => {
    const memoInput = await getTakeMemoInput(page, 1);
    await expect(memoInput).toBeVisible();
  });

  test('テイクメモに文字を入力できる', async ({ page }) => {
    const memoInput = await getTakeMemoInput(page, 1);
    await memoInput.fill('コンピング用メモ');

    await expect(memoInput).toHaveValue('コンピング用メモ');
  });

  test('テイクメモが保存され再表示時に復元される', async ({ page }) => {
    const memoInput = await getTakeMemoInput(page, 1);
    await memoInput.fill('コンピング永続化テスト');
    await memoInput.blur();
    await page.waitForTimeout(300);

    await page.getByRole('button', { name: '終了' }).click();
    await page.waitForTimeout(100);

    await page.getByText('コンピングメモテスト').click();
    await page.getByRole('button', { name: '開く' }).click();
    await page.waitForTimeout(200);

    await goToCompingScreen(page);

    const restoredMemo = await getTakeMemoInput(page, 1);
    await expect(restoredMemo).toHaveValue('コンピング永続化テスト');
  });
});

test.describe('テイクメモ - 画面間共有', () => {
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
    await createSong(page, '画面共有テスト', '一行目\n二行目');
  });

  test('レコーディング画面で入力したメモがコンピング画面に反映される', async ({
    page,
  }) => {
    const recordingMemo = await getTakeMemoInput(page, 1);
    await recordingMemo.fill('レコーディングで入力');
    await recordingMemo.blur();
    await page.waitForTimeout(500);

    await goToCompingScreen(page);
    await page.waitForTimeout(300);

    const compingMemo = await getTakeMemoInput(page, 1);
    await expect(compingMemo).toHaveValue('レコーディングで入力');
  });

  test('コンピング画面で入力したメモがレコーディング画面に反映される', async ({
    page,
  }) => {
    await goToCompingScreen(page);

    const compingMemo = await getTakeMemoInput(page, 1);
    await compingMemo.fill('コンピングで入力');
    await compingMemo.blur();
    await page.waitForTimeout(500);

    await page
      .getByRole('button', { name: 'レコーディングモードに戻る' })
      .click();
    await page.waitForTimeout(300);

    const recordingMemo = await getTakeMemoInput(page, 1);
    await expect(recordingMemo).toHaveValue('コンピングで入力');
  });

  test('両画面で編集したメモが正しく保存される', async ({ page }) => {
    await addTakes(page, 1);
    await page.waitForTimeout(200);

    const recordingMemo1 = await getTakeMemoInput(page, 1);
    await recordingMemo1.fill('レコーディング1');
    await recordingMemo1.blur();
    await page.waitForTimeout(500);

    await goToCompingScreen(page);
    await page.waitForTimeout(300);

    const compingMemo2 = await getTakeMemoInput(page, 2);
    await compingMemo2.fill('コンピング2');
    await compingMemo2.blur();
    await page.waitForTimeout(500);

    await page
      .getByRole('button', { name: 'レコーディングモードに戻る' })
      .click();
    await page.waitForTimeout(300);

    const finalMemo1 = await getTakeMemoInput(page, 1);
    const finalMemo2 = await getTakeMemoInput(page, 2);

    await expect(finalMemo1).toHaveValue('レコーディング1');
    await expect(finalMemo2).toHaveValue('コンピング2');
  });
});
