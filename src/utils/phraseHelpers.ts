import type { Phrase } from '@/types/models';

export function isSelectablePhrase(phrase: Phrase): boolean {
  return phrase.text.trim().length > 0 && !phrase.isRehearsalMark;
}

export interface PhrasesByLine {
  lineIndex: number;
  phrases: Phrase[];
}

export function groupPhrasesByLine(phrases: Phrase[]): PhrasesByLine[] {
  const lineMap = new Map<number, Phrase[]>();

  for (const phrase of phrases) {
    if (phrase.isRehearsalMark) continue;

    const existing = lineMap.get(phrase.lineIndex);
    if (existing) {
      existing.push(phrase);
    } else {
      lineMap.set(phrase.lineIndex, [phrase]);
    }
  }

  return Array.from(lineMap.entries())
    .sort(([a], [b]) => a - b)
    .map(([lineIndex, linePhrases]) => ({
      lineIndex,
      phrases: linePhrases.sort((a, b) => a.order - b.order),
    }));
}

export function findNextSelectablePhrase(
  phrases: Phrase[],
  currentOrder: number,
): Phrase | undefined {
  return phrases.find((p) => p.order > currentOrder && isSelectablePhrase(p));
}

export function findPreviousSelectablePhrase(
  phrases: Phrase[],
  currentOrder: number,
): Phrase | undefined {
  const candidates = phrases.filter(
    (p) => p.order < currentOrder && isSelectablePhrase(p),
  );
  return candidates.length > 0 ? candidates[candidates.length - 1] : undefined;
}

export function getNextSelectableIndex(
  phrases: Phrase[],
  startIndex: number,
): number {
  for (let i = startIndex + 1; i < phrases.length; i += 1) {
    if (isSelectablePhrase(phrases[i])) {
      return i;
    }
  }
  return startIndex;
}

export function getPreviousSelectableIndex(
  phrases: Phrase[],
  startIndex: number,
): number {
  for (let i = startIndex - 1; i >= 0; i -= 1) {
    if (isSelectablePhrase(phrases[i])) {
      return i;
    }
  }
  return startIndex;
}
