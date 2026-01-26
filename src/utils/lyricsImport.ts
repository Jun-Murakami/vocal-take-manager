/**
 * Lyrics file import helpers
 * - Supports .docx / .odt / .rtf / .txt
 * - .doc is not supported in browser (binary format)
 */
import { strFromU8, unzipSync } from 'fflate';

const decodeRtfHex = (
  hex: string,
  decoder: TextDecoder,
): string => {
  const code = Number.parseInt(hex, 16);
  if (Number.isNaN(code)) {
    return '';
  }
  // 1バイトずつストリームとしてデコードする（マルチバイトに対応）
  return decoder.decode(new Uint8Array([code]), { stream: true });
};

const getRtfEncoding = (buffer: ArrayBuffer): string => {
  // RTFヘッダー内の \ansicpgNNNN を参照して文字コードを判定する
  // NOTE: まずは ISO-8859-1 としてデコードして制御語を読み取る
  const latin1 = new TextDecoder('iso-8859-1');
  const headerText = latin1.decode(buffer.slice(0, 2048));
  const match = headerText.match(/\\ansicpg(\d+)/i);
  const codePage = match?.[1];

  if (codePage === '932') {
    return 'windows-932';
  }
  if (codePage === '65001') {
    return 'utf-8';
  }

  // 既知以外はUTF-8にフォールバックする
  return 'utf-8';
};

const decodeRtfBuffer = (
  buffer: ArrayBuffer,
): { text: string; encoding: string } => {
  // 可能ならRFTのコードページに合わせてデコードする
  const encoding = getRtfEncoding(buffer);
  try {
    return { text: new TextDecoder(encoding).decode(buffer), encoding };
  } catch {
    // windows-932 が無い環境向けのフォールバック
    try {
      return {
        text: new TextDecoder('shift_jis').decode(buffer),
        encoding: 'shift_jis',
      };
    } catch {
      return { text: new TextDecoder('utf-8').decode(buffer), encoding: 'utf-8' };
    }
  }
};

const stripRtf = (rtf: string, encoding: string): string => {
  // RTF を簡易パースして本文だけを抽出する
  // - フォントテーブルなどのメタ情報グループは無視する
  // - \uN で指定された Unicode を優先して取り込む
  // - \ucN で指定された「代替文字数」をスキップする
  const ignoredDestinations = new Set([
    'fonttbl',
    'colortbl',
    'stylesheet',
    'info',
    'pict',
    'object',
    'filetbl',
    'datastore',
    'themedata',
    'xmlopen',
  ]);

  let result = '';
  let i = 0;
  let ucSkipCount = 1;
  const skipStack: boolean[] = [];
  let skipCurrent = false;
  const decoder = new TextDecoder(encoding);

  const pushGroup = (skip: boolean) => {
    skipStack.push(skipCurrent);
    skipCurrent = skip;
  };

  const popGroup = () => {
    const prev = skipStack.pop();
    skipCurrent = prev ?? false;
  };

  const skipFallbackChars = (count: number) => {
    let skipped = 0;
    while (skipped < count && i < rtf.length) {
      if (rtf[i] === '\\' && rtf[i + 1] === "'") {
        // \'hh は4文字分のシーケンス
        i += 4;
        skipped += 1;
        continue;
      }
      i += 1;
      skipped += 1;
    }
  };

  while (i < rtf.length) {
    const char = rtf[i];

    // RTF内の生の改行はレイアウト用なので無視する
    if (char === '\r' || char === '\n') {
      i += 1;
      continue;
    }

    if (char === '{') {
      // 新しいグループの開始
      // NOTE: 次が \* ならそのグループ全体を無視する
      if (rtf[i + 1] === '\\' && rtf[i + 2] === '*') {
        pushGroup(true);
        i += 3;
        continue;
      }

      pushGroup(skipCurrent);
      i += 1;
      continue;
    }

    if (char === '}') {
      // グループの終了
      popGroup();
      i += 1;
      continue;
    }

    if (char === '\\') {
      const next = rtf[i + 1] || '';

      // エスケープされた改行などは無視する
      if (next === '\n' || next === '\r') {
        i += 2;
        continue;
      }

      // エスケープされた記号
      if (next === '\\' || next === '{' || next === '}') {
        if (!skipCurrent) {
          result += next;
        }
        i += 2;
        continue;
      }

      // 16進エスケープ \'hh
      if (next === "'") {
        const hex = rtf.slice(i + 2, i + 4);
        if (!skipCurrent) {
          result += decodeRtfHex(hex, decoder);
        }
        i += 4;
        continue;
      }

      // 制御語の読み取り
      const match = rtf.slice(i + 1).match(/^([a-zA-Z]+)(-?\d+)? ?/);
      if (match) {
        const [, word, numStr] = match;
        const num = numStr ? Number.parseInt(numStr, 10) : null;
        i += 1 + match[0].length;

        if (skipCurrent) {
          // 無視グループ内は制御語だけ消費する
          continue;
        }

        // 目的地指定のグループを無視する
        if (ignoredDestinations.has(word)) {
          skipCurrent = true;
          continue;
        }

        if (word === 'uc' && num !== null) {
          // \ucN は代替文字数（\u の後に続く文字数）
          ucSkipCount = Math.max(0, num);
          continue;
        }

        if (word === 'u' && num !== null) {
          // \uN 形式の Unicode（負数は 65536 を加算）
          const codePoint = num < 0 ? num + 65536 : num;
          result += String.fromCharCode(codePoint);
          // 代替文字をスキップ
          skipFallbackChars(ucSkipCount);
          continue;
        }

        if (word === 'par' || word === 'line') {
          result += '\n';
          continue;
        }

        if (word === 'tab') {
          result += '\t';
          continue;
        }

        // その他の制御語は無視
        continue;
      }
    }

    // 通常の文字
    if (!skipCurrent) {
      result += char;
    }
    i += 1;
  }

  // デコーダのバッファをフラッシュする
  result += decoder.decode();
  return result;
};

const extractTextFromDocxXml = (xml: string): string => {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xml, 'application/xml');
  const paragraphs = Array.from(doc.getElementsByTagName('w:p'));

  return paragraphs
    .map((paragraph) => {
      const texts = Array.from(paragraph.getElementsByTagName('w:t')).map(
        (node) => node.textContent || '',
      );
      return texts.join('');
    })
    .join('\n');
};

const extractTextFromOdtXml = (xml: string): string => {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xml, 'application/xml');
  const paragraphs = Array.from(doc.getElementsByTagName('text:p'));

  return paragraphs
    .map((paragraph) => paragraph.textContent || '')
    .join('\n');
};

const getZipEntryText = (zip: Record<string, Uint8Array>, path: string): string => {
  const entry = zip[path];
  if (!entry) {
    throw new Error(`必要なファイルが見つかりませんでした: ${path}`);
  }
  return strFromU8(entry);
};

export const importLyricsFromFile = async (file: File): Promise<string> => {
  const extension = file.name.toLowerCase().split('.').pop() || '';

  if (extension === 'txt') {
    return file.text();
  }

  if (extension === 'rtf') {
    const buffer = await file.arrayBuffer();
    const { text, encoding } = decodeRtfBuffer(buffer);
    return stripRtf(text, encoding);
  }

  if (extension === 'doc') {
    throw new Error(
      '.doc 形式はブラウザでの解析が難しいため非対応です。docx / odt / rtf / txt をご利用ください。',
    );
  }

  if (extension === 'docx' || extension === 'odt') {
    const buffer = await file.arrayBuffer();
    const zip = unzipSync(new Uint8Array(buffer));
    if (extension === 'docx') {
      const xml = getZipEntryText(zip, 'word/document.xml');
      return extractTextFromDocxXml(xml);
    }
    const xml = getZipEntryText(zip, 'content.xml');
    return extractTextFromOdtXml(xml);
  }

  throw new Error('対応していないファイル形式です。');
};
