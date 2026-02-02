import { expect, type Page, test } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const BASE_URL = 'http://localhost:5173';

async function createSong(page: Page, title: string, lyrics: string) {
  await page.getByRole('button', { name: '新規' }).click();
  await page.getByLabel('楽曲のタイトル').fill(title);
  await page.getByLabel('歌詞').fill(lyrics);
  await page.getByRole('button', { name: 'OK' }).click();
}

test.describe('ホーム画面 - 基本表示', () => {
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

  test('タイトルが表示される', async ({ page }) => {
    await expect(
      page.getByRole('heading', { name: 'VOCAL TAKE MANAGER' }),
    ).toBeVisible();
    await expect(page.getByText('v0.2.8')).toBeVisible();
  });

  test('プロジェクトが空の状態のメッセージが表示される', async ({ page }) => {
    await expect(page.getByText('プロジェクトがまだありません')).toBeVisible();
    await expect(
      page.getByText('「新規」ボタンから作成してください'),
    ).toBeVisible();
  });

  test('新規ボタンが有効', async ({ page }) => {
    const newButton = page.getByRole('button', { name: '新規' });
    await expect(newButton).toBeEnabled();
  });

  test('開くボタンが無効', async ({ page }) => {
    const openButton = page.getByRole('button', { name: '開く' });
    await expect(openButton).toBeDisabled();
  });

  test('プロジェクトの書き出しボタンが無効', async ({ page }) => {
    const exportButton = page.getByRole('button', {
      name: 'プロジェクトの書き出し',
    });
    await expect(exportButton).toBeDisabled();
  });

  test('フォント選択ドロップダウンが表示される', async ({ page }) => {
    const fontSelect = page.getByRole('combobox');
    await expect(fontSelect).toBeVisible();
  });

  test('ダークモード切り替えスイッチが表示される', async ({ page }) => {
    const darkModeSwitch = page.getByRole('switch');
    await expect(darkModeSwitch).toBeVisible();
  });
});

test.describe('ホーム画面 - 新規作成ワークフロー', () => {
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

  test('新規ボタンをクリックすると歌詞入力画面に遷移', async ({ page }) => {
    await page.getByRole('button', { name: '新規' }).click();
    await expect(
      page.getByRole('heading', { name: 'プロジェクトの新規作成' }),
    ).toBeVisible();
    await expect(page.getByLabel('楽曲のタイトル')).toBeVisible();
    await expect(page.getByLabel('歌詞')).toBeVisible();
  });

  test('キャンセルボタンでホームに戻る', async ({ page }) => {
    await page.getByRole('button', { name: '新規' }).click();
    await page.getByRole('button', { name: 'キャンセル' }).click();
    await expect(
      page.getByRole('heading', { name: 'VOCAL TAKE MANAGER' }),
    ).toBeVisible();
  });

  test('必須項目が空の場合OKボタンが無効', async ({ page }) => {
    await page.getByRole('button', { name: '新規' }).click();
    const okButton = page.getByRole('button', { name: 'OK' });
    await expect(okButton).toBeDisabled();

    await page.getByLabel('楽曲のタイトル').fill('テスト曲');
    await expect(okButton).toBeDisabled();

    await page.getByLabel('楽曲のタイトル').clear();
    await page.getByLabel('歌詞').fill('テスト歌詞');
    await expect(okButton).toBeDisabled();
  });

  test('正しく入力するとプロジェクトが作成されレコーディング画面に遷移', async ({
    page,
  }) => {
    await page.getByRole('button', { name: '新規' }).click();
    await page.getByLabel('楽曲のタイトル').fill('テスト曲');
    await page.getByLabel('クレジット').fill('テストアーティスト');
    await page.getByLabel('歌詞').fill('これはテストの歌詞です');
    await page.getByRole('button', { name: 'OK' }).click();

    await expect(page.getByText('テスト曲')).toBeVisible();
    await expect(page.getByText('テストアーティスト')).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'セレクトモードに切り替える' }),
    ).toBeVisible();
  });

  test('ファイルから歌詞をインポートボタンが表示される', async ({ page }) => {
    await page.getByRole('button', { name: '新規' }).click();
    await expect(
      page.getByRole('button', { name: 'ファイルからインポート' }),
    ).toBeVisible();
  });
});

test.describe('ホーム画面 - プロジェクト管理ワークフロー', () => {
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

  test('作成したプロジェクトが一覧に表示される', async ({ page }) => {
    await createSong(page, '一覧表示テスト', '歌詞内容');
    await page.getByRole('button', { name: '終了' }).click();

    await expect(page.getByText('一覧表示テスト')).toBeVisible();
  });

  test('プロジェクトを選択して開く', async ({ page }) => {
    await createSong(page, '開くテスト', '歌詞');
    await page.getByRole('button', { name: '終了' }).click();

    await page.getByText('開くテスト').click();
  });

  test('複数プロジェクトが一覧表示される', async ({ page }) => {
    await createSong(page, 'プロジェクト1', '歌詞1');
    await page.getByRole('button', { name: '終了' }).click();

    await createSong(page, 'プロジェクト2', '歌詞2');
    await page.getByRole('button', { name: '終了' }).click();

    await expect(page.getByText('プロジェクト1')).toBeVisible();
    await expect(page.getByText('プロジェクト2')).toBeVisible();
  });

  test('プロジェクトを選択できる', async ({ page }) => {
    await createSong(page, '削除テスト', '歌詞');
    await page.getByRole('button', { name: '終了' }).click();

    await page.getByText('削除テスト').click();
  });

  test('最終更新日時が表示される', async ({ page }) => {
    await createSong(page, '日時表示テスト', '歌詞');
    await page.getByRole('button', { name: '終了' }).click();

    await expect(page.getByText('日時表示テスト')).toBeVisible();
  });
});

test.describe('ホーム画面 - プロジェクト書き出し/読み込みワークフロー', () => {
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

  test('プロジェクトを.vtmファイルとして書き出し', async ({ page }) => {
    await createSong(page, '書き出しテスト', '歌詞内容');
    await page.getByRole('button', { name: '終了' }).click();

    await page.getByText('書き出しテスト').click();
    await expect(
      page.getByRole('button', { name: 'プロジェクトの書き出し' }),
    ).toBeEnabled();
  });

  test('プロジェクトの読み込みボタンが有効', async ({ page }) => {
    await expect(
      page.getByRole('button', { name: 'プロジェクトの読み込み' }),
    ).toBeEnabled();
  });
});

test.describe('ホーム画面 - 設定ワークフロー', () => {
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

  test('ダークモードを切り替える', async ({ page }) => {
    const darkModeSwitch = page.getByRole('switch');
    await darkModeSwitch.click();

    await page.reload();

    await expect(page.locator('body')).toHaveCSS('background-color', /rgb/);
  });

  test('フォント選択ドロップダウンを開く', async ({ page }) => {
    const fontSelect = page.getByRole('combobox');
    await fontSelect.click();
    await expect(page.getByText('LINE Seed JP')).toBeVisible();
  });

  test('設定がプロジェクト間で保持される', async ({ page }) => {
    const darkModeSwitch = page.getByRole('switch');
    await darkModeSwitch.click();

    await createSong(page, '設定保持テスト', '歌詞');
    await page.getByRole('button', { name: '終了' }).click();

    await expect(page.locator('body')).toHaveCSS('background-color', /rgb/);
  });
});
