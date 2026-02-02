import { expect, type Page, test } from '@playwright/test';

const BASE_URL = 'http://localhost:5173';

async function createSongWithManyLines(page: Page, lineCount: number) {
  const lyrics = Array.from(
    { length: lineCount },
    (_, i) => `${i + 1}行目の歌詞です`,
  ).join('\n');

  await page.getByRole('button', { name: '新規' }).click();
  await page.getByLabel('楽曲のタイトル').fill('スクロールテスト');
  await page.getByLabel('歌詞').fill(lyrics);
  await page.getByRole('button', { name: 'OK' }).click();
}

async function addTakes(page: Page, count: number) {
  const addButton = page.getByRole('button', { name: 'テイクを追加' });
  for (let i = 0; i < count; i++) {
    await addButton.click();
    await page.waitForTimeout(100);
  }
}

async function getScrollContainers(page: Page) {
  return page.evaluate(() => {
    const allDivs = Array.from(document.querySelectorAll('div'));

    const lyricsContainer = allDivs.find((el) => {
      const style = getComputedStyle(el);
      return (
        style.overflowY === 'auto' &&
        el.scrollHeight > 500 &&
        el.scrollWidth <= el.clientWidth
      );
    });

    const marksContainer = allDivs.find((el) => {
      const style = getComputedStyle(el);
      return (
        style.overflowY === 'auto' &&
        el.scrollHeight > 500 &&
        el.scrollWidth > el.clientWidth
      );
    });

    if (!lyricsContainer || !marksContainer) {
      return null;
    }

    return {
      lyrics: {
        scrollHeight: lyricsContainer.scrollHeight,
        clientHeight: lyricsContainer.clientHeight,
        maxScroll: lyricsContainer.scrollHeight - lyricsContainer.clientHeight,
        scrollTop: lyricsContainer.scrollTop,
      },
      marks: {
        scrollHeight: marksContainer.scrollHeight,
        clientHeight: marksContainer.clientHeight,
        maxScroll: marksContainer.scrollHeight - marksContainer.clientHeight,
        scrollTop: marksContainer.scrollTop,
        hasHorizontalScrollbar:
          marksContainer.scrollWidth > marksContainer.clientWidth,
      },
    };
  });
}

async function scrollLyricsTo(page: Page, scrollTop: number) {
  await page.evaluate((top) => {
    const allDivs = Array.from(document.querySelectorAll('div'));
    const lyricsContainer = allDivs.find((el) => {
      const style = getComputedStyle(el);
      return (
        style.overflowY === 'auto' &&
        el.scrollHeight > 500 &&
        el.scrollWidth <= el.clientWidth
      );
    });
    if (lyricsContainer) {
      lyricsContainer.scrollTop = top;
      lyricsContainer.dispatchEvent(new Event('scroll'));
    }
  }, scrollTop);
  await page.waitForTimeout(50);
}

async function scrollMarksTo(page: Page, scrollTop: number) {
  await page.evaluate((top) => {
    const allDivs = Array.from(document.querySelectorAll('div'));
    const marksContainer = allDivs.find((el) => {
      const style = getComputedStyle(el);
      return (
        style.overflowY === 'auto' &&
        el.scrollHeight > 500 &&
        el.scrollWidth > el.clientWidth
      );
    });
    if (marksContainer) {
      marksContainer.scrollTop = top;
      marksContainer.dispatchEvent(new Event('scroll'));
    }
  }, scrollTop);
  await page.waitForTimeout(50);
}

test.describe('スクロール同期 - レコーディング画面', () => {
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
    await createSongWithManyLines(page, 50);
    await addTakes(page, 4);
    await page.waitForTimeout(200);
  });

  test('水平スクロールバーがある時、歌詞とマークエリアのmaxScrollが一致する', async ({
    page,
  }) => {
    const containers = await getScrollContainers(page);

    expect(containers).not.toBeNull();
    expect(containers?.marks.hasHorizontalScrollbar).toBe(true);
    expect(containers?.lyrics.maxScroll).toBe(containers?.marks.maxScroll);
  });

  test('歌詞エリアをスクロールするとマークエリアも同期する', async ({
    page,
  }) => {
    const initialContainers = await getScrollContainers(page);
    if (!initialContainers) {
      throw new Error('Scroll containers not found');
    }

    const targetScroll = Math.floor(initialContainers.lyrics.maxScroll / 2);
    await scrollLyricsTo(page, targetScroll);

    const afterScroll = await getScrollContainers(page);
    expect(afterScroll?.lyrics.scrollTop).toBe(targetScroll);
    expect(afterScroll?.marks.scrollTop).toBe(targetScroll);
  });

  test('マークエリアをスクロールすると歌詞エリアも同期する', async ({
    page,
  }) => {
    const initialContainers = await getScrollContainers(page);
    if (!initialContainers) {
      throw new Error('Scroll containers not found');
    }

    const targetScroll = Math.floor(initialContainers.marks.maxScroll / 2);
    await scrollMarksTo(page, targetScroll);

    const afterScroll = await getScrollContainers(page);
    expect(afterScroll?.marks.scrollTop).toBe(targetScroll);
    expect(afterScroll?.lyrics.scrollTop).toBe(targetScroll);
  });

  test('一番下までスクロールした時、両エリアが同じ位置で止まる', async ({
    page,
  }) => {
    const containers = await getScrollContainers(page);
    if (!containers) {
      throw new Error('Scroll containers not found');
    }

    await scrollLyricsTo(page, containers.lyrics.maxScroll);

    const afterScroll = await getScrollContainers(page);
    expect(afterScroll?.lyrics.scrollTop).toBe(afterScroll?.lyrics.maxScroll);
    expect(afterScroll?.marks.scrollTop).toBe(afterScroll?.marks.maxScroll);
    expect(afterScroll?.lyrics.scrollTop).toBe(afterScroll?.marks.scrollTop);
  });

  test('一番上にスクロールした時、両エリアが0で止まる', async ({ page }) => {
    const containers = await getScrollContainers(page);
    if (!containers) {
      throw new Error('Scroll containers not found');
    }

    await scrollLyricsTo(page, containers.lyrics.maxScroll);
    await scrollLyricsTo(page, 0);

    const afterScroll = await getScrollContainers(page);
    expect(afterScroll?.lyrics.scrollTop).toBe(0);
    expect(afterScroll?.marks.scrollTop).toBe(0);
  });
});

test.describe('スクロール同期 - コンピング画面', () => {
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
    await createSongWithManyLines(page, 50);
    await addTakes(page, 4);
    await page.waitForTimeout(200);

    await page
      .getByRole('button', { name: 'セレクトモードに切り替える' })
      .click();
    await expect(
      page.getByRole('button', { name: 'レコーディングモードに戻る' }),
    ).toBeVisible();
    await page.waitForTimeout(200);
  });

  test('水平スクロールバーがある時、歌詞とマークエリアのmaxScrollが一致する', async ({
    page,
  }) => {
    const containers = await getScrollContainers(page);

    expect(containers).not.toBeNull();
    expect(containers?.marks.hasHorizontalScrollbar).toBe(true);
    expect(containers?.lyrics.maxScroll).toBe(containers?.marks.maxScroll);
  });

  test('歌詞エリアをスクロールするとマークエリアも同期する', async ({
    page,
  }) => {
    const initialContainers = await getScrollContainers(page);
    if (!initialContainers) {
      throw new Error('Scroll containers not found');
    }

    const targetScroll = Math.floor(initialContainers.lyrics.maxScroll / 2);
    await scrollLyricsTo(page, targetScroll);

    const afterScroll = await getScrollContainers(page);
    expect(afterScroll?.lyrics.scrollTop).toBe(targetScroll);
    expect(afterScroll?.marks.scrollTop).toBe(targetScroll);
  });

  test('マークエリアをスクロールすると歌詞エリアも同期する', async ({
    page,
  }) => {
    const initialContainers = await getScrollContainers(page);
    if (!initialContainers) {
      throw new Error('Scroll containers not found');
    }

    const targetScroll = Math.floor(initialContainers.marks.maxScroll / 2);
    await scrollMarksTo(page, targetScroll);

    const afterScroll = await getScrollContainers(page);
    expect(afterScroll?.marks.scrollTop).toBe(targetScroll);
    expect(afterScroll?.lyrics.scrollTop).toBe(targetScroll);
  });

  test('一番下までスクロールした時、両エリアが同じ位置で止まる', async ({
    page,
  }) => {
    const containers = await getScrollContainers(page);
    if (!containers) {
      throw new Error('Scroll containers not found');
    }

    await scrollLyricsTo(page, containers.lyrics.maxScroll);

    const afterScroll = await getScrollContainers(page);
    expect(afterScroll?.lyrics.scrollTop).toBe(afterScroll?.lyrics.maxScroll);
    expect(afterScroll?.marks.scrollTop).toBe(afterScroll?.marks.maxScroll);
    expect(afterScroll?.lyrics.scrollTop).toBe(afterScroll?.marks.scrollTop);
  });

  test('一番上にスクロールした時、両エリアが0で止まる', async ({ page }) => {
    const containers = await getScrollContainers(page);
    if (!containers) {
      throw new Error('Scroll containers not found');
    }

    await scrollLyricsTo(page, containers.lyrics.maxScroll);
    await scrollLyricsTo(page, 0);

    const afterScroll = await getScrollContainers(page);
    expect(afterScroll?.lyrics.scrollTop).toBe(0);
    expect(afterScroll?.marks.scrollTop).toBe(0);
  });
});
