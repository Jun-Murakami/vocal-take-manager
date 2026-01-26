/**
 * File export helpers
 * - Provide a consistent way to export .vtm files across browsers
 * - Improve iOS behavior by using Web Share API when available
 */

/**
 * Sanitize filename to avoid invalid characters on common OSes.
 */
function sanitizeFileName(name: string): string {
  // Replace characters that are invalid or problematic in file names.
  return name.replace(/[\\/:*?"<>|]/g, '_').trim();
}

/**
 * Export JSON as a .vtm file.
 * - On iOS, Web Share API with files keeps the extension more reliably.
 * - Fallback uses an anchor download with a blob URL.
 */
export async function exportVtmFile(
  songTitle: string,
  vtmJson: string,
): Promise<void> {
  const safeTitle = sanitizeFileName(songTitle) || 'untitled';
  const fileName = `${safeTitle}.vtm`;

  // Use octet-stream to avoid iOS auto-adding .json
  const file = new File([vtmJson], fileName, {
    type: 'application/octet-stream',
  });

  // iOS Safari: prefer Web Share API to keep filename/extension.
  // NOTE: デスクトップ環境では「Permission denied」で失敗することがあるため、
  //       例外時は通常のダウンロードにフォールバックする。
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({
        title: fileName,
        files: [file],
      });
      return;
    } catch (error) {
      // 共有が拒否/キャンセルされた場合は通常ダウンロードへ切り替える
      // NOTE: Permission denied を含むエラーはPC環境で発生しやすい
      console.warn('Web Share failed, falling back to download:', error);
    }
  }

  // Fallback: regular anchor download.
  const url = URL.createObjectURL(file);
  try {
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = fileName;
    anchor.rel = 'noopener';
    anchor.click();
  } finally {
    URL.revokeObjectURL(url);
  }
}
