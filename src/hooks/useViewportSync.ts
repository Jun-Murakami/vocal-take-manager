import { useCallback, useEffect, useLayoutEffect, useState } from 'react';

/**
 * Custom hook for managing marks area viewport width and scrollbar height.
 *
 * This hook measures the visible width of the marks scroll container and the height
 * of the horizontal scrollbar, updating these measurements when the DOM changes,
 * the window is resized, or when the number of takes/collapsed state changes.
 *
 * @param marksScrollRef - Reference to the marks scroll container element
 * @param songExists - Whether a song is currently loaded (triggers remeasurement)
 * @param takeCount - Number of takes (triggers remeasurement when changed)
 * @param collapsedCount - Number of collapsed takes (triggers remeasurement when changed)
 * @returns Object containing marksViewportWidth, marksHorizontalScrollbarHeight, and updateMarksViewportWidth
 */
export function useViewportSync(
  marksScrollRef: React.RefObject<HTMLDivElement | null>,
  songExists: boolean,
  takeCount: number,
  collapsedCount: number,
) {
  // テイクマークエリアの可視幅（現在の画面幅に応じて更新する）
  const [marksViewportWidth, setMarksViewportWidth] = useState(0);
  // 横スクロールバーの高さ（歌詞側の下余白調整に使う）
  const [marksHorizontalScrollbarHeight, setMarksHorizontalScrollbarHeight] =
    useState(0);

  /**
   * テイクマークエリアの「見えている横幅」を取得して保持する。
   * - 選択中テイクを歌詞のすぐ右に揃えるため、末尾に必要な余白幅を算出する
   * - 画面リサイズやテイク数変更で幅が変わるため都度更新する
   * - 描画タイミングによって ref が null の場合があるため、null なら 0 として保持する
   */
  const updateMarksViewportWidth = useCallback(() => {
    const viewport = marksScrollRef.current;
    // DOM が未確定のタイミングでも安全に取得できるようにしておく
    const viewportWidth = viewport?.clientWidth ?? 0;
    setMarksViewportWidth(viewportWidth);

    // 横スクロールバー分だけ高さが縮むため、その差分を取得して歌詞側に補正する
    const scrollbarHeight = viewport
      ? viewport.offsetHeight - viewport.clientHeight
      : 0;
    setMarksHorizontalScrollbarHeight(scrollbarHeight);
  }, [marksScrollRef]);

  useLayoutEffect(() => {
    // 初回描画時に幅を再計算する
    // NOTE: 初回は ref が null のことがあるため 0 になる可能性がある
    updateMarksViewportWidth();
  }, [updateMarksViewportWidth]);

  useLayoutEffect(() => {
    // 楽曲ロード後に ref が有効化されるため、必ず再計測する
    // NOTE: これを行わないと末尾余白が 0 のままになり、選択テイクの左寄せが効かない
    if (!songExists) return;
    updateMarksViewportWidth();
  }, [songExists, updateMarksViewportWidth]);

  useLayoutEffect(() => {
    // テイク数や折りたたみ状態が変わると横スクロールバーの有無が変化するため、
    // 描画直後のタイミングで再計測して歌詞側の下余白を確実に追従させる
    // NOTE: production では StrictMode の二重実行がないため、更新タイミングがズレると
    //       スクロールバー高さが 0 のまま固定されるケースがある
    if (!songExists) return;
    // 依存関係として明示的に参照し、状態変更時に必ず再計測する
    if (takeCount >= 0 && collapsedCount >= 0) {
      updateMarksViewportWidth();
    }
  }, [takeCount, collapsedCount, songExists, updateMarksViewportWidth]);

  useEffect(() => {
    // ウィンドウサイズ変更に追従して、末尾の余白幅を更新する
    const handleResize = () => updateMarksViewportWidth();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [updateMarksViewportWidth]);

  return {
    marksViewportWidth,
    marksHorizontalScrollbarHeight,
    updateMarksViewportWidth,
  };
}
