import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';

const PageActionsContext = createContext({
  actions: null,
  setActions: () => {},
  clearActions: () => {},
});

export function PageActionsProvider({ children }) {
  const [actions, setActionsState] = useState(null);
  const setActions = useCallback((node) => setActionsState(node), []);
  const clearActions = useCallback(() => setActionsState(null), []);
  const value = useMemo(
    () => ({ actions, setActions, clearActions }),
    [actions, setActions, clearActions],
  );
  return (
    <PageActionsContext.Provider value={value}>
      {children}
    </PageActionsContext.Provider>
  );
}

export function usePageActions() {
  return useContext(PageActionsContext);
}
