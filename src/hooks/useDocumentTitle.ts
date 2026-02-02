import { useEffect } from 'react';

const DEFAULT_TITLE = 'Vocal Take Manager';

export function useDocumentTitle(title: string | null | undefined): void {
  useEffect(() => {
    if (title) {
      document.title = `${title} - ${DEFAULT_TITLE}`;
    }
    return () => {
      document.title = DEFAULT_TITLE;
    };
  }, [title]);
}
