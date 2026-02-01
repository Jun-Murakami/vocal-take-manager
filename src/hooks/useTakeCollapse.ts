import React from 'react';

/**
 * Custom hook for managing take column collapse state.
 *
 * @param takeIds - Array of valid take IDs for cleanup effect
 * @returns Object with collapsedTakeIds and toggleTakeCollapse function
 */
export function useTakeCollapse(takeIds: string[]) {
  const [collapsedTakeIds, setCollapsedTakeIds] = React.useState<Set<string>>(
    () => new Set(),
  );

  /**
   * Toggle collapse state for a specific take.
   * If the take is collapsed, it will be expanded, and vice versa.
   */
  const toggleTakeCollapse = React.useCallback((takeId: string) => {
    setCollapsedTakeIds((prev) => {
      const next = new Set(prev);
      if (next.has(takeId)) {
        next.delete(takeId);
      } else {
        next.add(takeId);
      }
      return next;
    });
  }, []);

  /**
   * Cleanup effect: Remove collapsed IDs that are no longer valid.
   * Runs when takeIds changes.
   */
  React.useEffect(() => {
    setCollapsedTakeIds((prev) => {
      const validIds = new Set(takeIds);
      const next = new Set<string>();
      for (const id of prev) {
        if (validIds.has(id)) {
          next.add(id);
        }
      }
      return next;
    });
  }, [takeIds]);

  return {
    collapsedTakeIds,
    toggleTakeCollapse,
  };
}

/**
 * Type definition for the return value of useTakeCollapse hook.
 */
export type UseTakeCollapseReturn = ReturnType<typeof useTakeCollapse>;
