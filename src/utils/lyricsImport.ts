/**
 * Lyrics file import helpers
 * - Supports .docx / .odt / .rtf / .txt
 * - .doc is not supported in browser (binary format)
 */
import { strFromU8, unzipSync } from 'fflate';

const decodeRtfHex = (
  hex: string,
  decoder: TextDecoder,
  fallbackOnInvalid?: (code: number) => string | null,
): string => {
  const code = Number.parseInt(hex, 16);
  if (Number.isNaN(code)) {
    return '';
  }
  // 1バイトずつストリームとしてデコードする（マルチバイトに対応）
  // NOTE: デコーダが扱えない値に対してはフォールバックで補正する
  const decoded = decoder.decode(new Uint8Array([code]), { stream: true });
  if (decoded === '\uFFFD' && fallbackOnInvalid) {
    const fallback = fallbackOnInvalid(code);
    if (fallback !== null) {
      return fallback;
    }
  }
  return decoded;
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
  // 段落境界の検出に使うフラグ
  // NOTE:
  // - \par が無いRTFでも \pard が段落境界として使われるケースがある
  // - そのため「段落開始」を明示的に扱い、\pard や \par を見た時点で改行を入れる
  // - 連続する段落開始は空行として扱う（空段落の維持）
  let hasStartedParagraph = false;
  // \pard が直後に来ても二重改行にしないためのフラグ
  // NOTE: 行末の「\」は実質的な改行として扱うため、その直後の \pard は抑制する
  let suppressNextParagraphBreak = false;
  const skipStack: boolean[] = [];
  let skipCurrent = false;
  const decoder = new TextDecoder(encoding);
  // \loch / \hich 用の Latin デコーダ
  // NOTE:
  // - RTFの \loch は低ANSI(通常は Windows-1252) を示す
  // - Windows-1252 が無い場合は ISO-8859-1 で代用し、
  //   表示が崩れやすい 0x85 を手動で補正する
  let latinDecoder: TextDecoder | null = null;
  let latinDecoderEncoding: 'windows-1252' | 'iso-8859-1' = 'iso-8859-1';
  try {
    latinDecoder = new TextDecoder('windows-1252');
    latinDecoderEncoding = 'windows-1252';
  } catch {
    latinDecoder = new TextDecoder('iso-8859-1');
    latinDecoderEncoding = 'iso-8859-1';
  }
  // 現在の文字種モード（RTFの \loch / \hich / \dbch に対応）
  // NOTE: 日本語主体の想定なので初期は dbch（ダブルバイト）
  let currentTextMode: 'dbch' | 'loch' | 'hich' = 'dbch';

  const pushGroup = (skip: boolean) => {
    skipStack.push(skipCurrent);
    skipCurrent = skip;
  };

  const popGroup = () => {
    const prev = skipStack.pop();
    skipCurrent = prev ?? false;
  };

  const startParagraph = () => {
    // NOTE:
    // - 既に段落が始まっているなら、次の段落開始は改行を意味する
    // - 最初の段落開始では改行を出さない（先頭の不要な空行を防ぐ）
    // - 直前に行末の「\」で改行を出している場合は二重改行を避ける
    if (suppressNextParagraphBreak) {
      suppressNextParagraphBreak = false;
      hasStartedParagraph = true;
      return;
    }
    if (hasStartedParagraph) {
      result += '\n';
    }
    hasStartedParagraph = true;
  };

  const writeText = (text: string) => {
    result += text;
    hasStartedParagraph = true;
  };

  const writeLineBreak = () => {
    // NOTE:
    // - \line は段落内の改行として扱う（段落自体は継続）
    // - 直後のテキストが同じ段落で続く前提のため段落開始状態は維持する
    result += '\n';
    hasStartedParagraph = true;
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

      // 行末の「\」は段落区切りとして扱う
      if (next === '\n' || next === '\r') {
        // NOTE:
        // - RTFファイルの改行はレイアウト上の折り返しにも使われる
        // - ただし本ファイルは行末に「\」が付与されており、実際の改行を示している
        // - ここでは段落区切りとして改行を挿入する
        writeLineBreak();
        suppressNextParagraphBreak = true;
        // \r\n の両方を安全に消費する
        if (next === '\r' && rtf[i + 2] === '\n') {
          i += 3;
          continue;
        }
        i += 2;
        continue;
      }

      // \~ は RTF のノンブレークスペース
      // NOTE: 画面表示では通常スペースとして扱う
      if (next === '~') {
        writeText(' ');
        i += 2;
        continue;
      }

      // エスケープされた記号
      if (next === '\\' || next === '{' || next === '}') {
        if (!skipCurrent) {
          writeText(next);
        }
        i += 2;
        continue;
      }

      // 16進エスケープ \'hh
      if (next === "'") {
        const hex = rtf.slice(i + 2, i + 4);
        if (!skipCurrent) {
          // NOTE:
          // - \loch / \hich は英字側（低ANSI）を示すため、
          //   対応するデコーダで解釈する
          // - \dbch は日本語（マルチバイト）を想定し、RTFのコードページを使う
          const useLatinDecoder =
            currentTextMode === 'loch' || currentTextMode === 'hich';
          const activeDecoder = useLatinDecoder ? latinDecoder : decoder;
          const decoded = decodeRtfHex(
            hex,
            activeDecoder ?? decoder,
            (code) => {
              if (!useLatinDecoder) {
                return null;
              }
              // NOTE: ISO-8859-1 は 0x85 を制御文字扱いするため、
              //       Windows-1252 と同じ「…」へ補正する
              if (latinDecoderEncoding === 'iso-8859-1' && code === 0x85) {
                return '…';
              }
              return null;
            },
          );
          writeText(decoded);
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

        if (word === 'loch') {
          // 低ANSI（英字側）へ切り替え
          currentTextMode = 'loch';
          continue;
        }

        if (word === 'hich') {
          // 高ANSI（英字側）へ切り替え
          currentTextMode = 'hich';
          continue;
        }

        if (word === 'dbch') {
          // ダブルバイト（日本語側）へ切り替え
          currentTextMode = 'dbch';
          continue;
        }

        if (word === 'u' && num !== null) {
          // \uN 形式の Unicode（負数は 65536 を加算）
          const codePoint = num < 0 ? num + 65536 : num;
          writeText(String.fromCharCode(codePoint));
          // 代替文字をスキップ
          skipFallbackChars(ucSkipCount);
          continue;
        }

        if (word === 'pard') {
          // \pard は段落の初期化だが、RTFによっては実質的な段落区切り
          // NOTE: 連続する \pard は空行（空段落）として扱う
          startParagraph();
          continue;
        }

        if (word === 'par') {
          // \par は明示的な段落区切り
          startParagraph();
          continue;
        }

        if (word === 'line') {
          // \line は段落内改行
          writeLineBreak();
          continue;
        }

        if (word === 'tab') {
          writeText('\t');
          continue;
        }

        // その他の制御語は無視
        continue;
      }
    }

    // 通常の文字
    if (!skipCurrent) {
      writeText(char);
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
