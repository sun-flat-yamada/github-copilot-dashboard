import { useState, useCallback } from 'react';

export interface UseAccordionGroupOptions {
  initialExpandedIds?: string[];
  allIds?: string[];
}

export function useAccordionGroup(options: UseAccordionGroupOptions = {}) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(
    () => new Set(options.initialExpandedIds || [])
  );

  const isExpanded = useCallback(
    (id: string) => expandedIds.has(id),
    [expandedIds]
  );

  const toggle = useCallback((id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const expandAll = useCallback((ids?: string[]) => {
    const targetIds = ids || options.allIds || [];
    setExpandedIds(new Set(targetIds));
  }, [options.allIds]);

  const collapseAll = useCallback(() => {
    setExpandedIds(new Set());
  }, []);

  return {
    expandedIds,
    isExpanded,
    toggle,
    expandAll,
    collapseAll,
  };
}
