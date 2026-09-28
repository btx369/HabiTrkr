import { useState, useCallback, useMemo } from 'react';

export interface UseBulkSelectionReturn {
  isBulkMode: boolean;
  selectedItems: Set<string>;
  toggleBulkMode: () => void;
  toggleItem: (id: string) => void;
  toggleAll: (allIds: string[]) => void;
  clearSelection: () => void;
  isAllSelected: (allIds: string[]) => boolean;
  selectItems: (ids: string[]) => void;
  exitBulkMode: () => void;
}

export function useBulkSelection(): UseBulkSelectionReturn {
  const [isBulkMode, setIsBulkMode] = useState(false);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());

  const toggleBulkMode = useCallback(() => {
    setIsBulkMode(prev => {
      if (prev) {
        // Exiting bulk mode - clear selection
        setSelectedItems(new Set());
      }
      return !prev;
    });
  }, []);

  const exitBulkMode = useCallback(() => {
    setIsBulkMode(false);
    setSelectedItems(new Set());
  }, []);

  const toggleItem = useCallback((id: string) => {
    setSelectedItems(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  }, []);

  const toggleAll = useCallback((allIds: string[]) => {
    setSelectedItems(prev => {
      const allSelected = allIds.length > 0 && allIds.every(id => prev.has(id));
      if (allSelected) {
        // Deselect all
        return new Set();
      } else {
        // Select all
        return new Set(allIds);
      }
    });
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedItems(new Set());
  }, []);

  const isAllSelected = useCallback((allIds: string[]): boolean => {
    return allIds.length > 0 && allIds.every(id => selectedItems.has(id));
  }, [selectedItems]);

  const selectItems = useCallback((ids: string[]) => {
    setSelectedItems(new Set(ids));
  }, []);

  return useMemo(() => ({
    isBulkMode,
    selectedItems,
    toggleBulkMode,
    toggleItem,
    toggleAll,
    clearSelection,
    isAllSelected,
    selectItems,
    exitBulkMode,
  }), [isBulkMode, selectedItems, toggleBulkMode, toggleItem, toggleAll, clearSelection, isAllSelected, selectItems, exitBulkMode]);
}
