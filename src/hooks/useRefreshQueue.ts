import { useReducer } from 'react';

export type RefreshState = {
  activeId: string | null;
  queuedIds: string[];
  progress: { done: number; total: number } | null;
};

export type RefreshAction =
  | { type: 'REFRESH_BATCH_START'; ids: string[] }
  | { type: 'REFRESH_ITEM_START'; id: string }
  | { type: 'REFRESH_ITEM_DONE' }
  | { type: 'REFRESH_BATCH_DONE' };

const initialState: RefreshState = {
  activeId: null,
  queuedIds: [],
  progress: null,
};

function refreshReducer(
  state: RefreshState,
  action: RefreshAction,
): RefreshState {
  switch (action.type) {
    case 'REFRESH_BATCH_START':
      return {
        activeId: null,
        queuedIds: action.ids,
        progress: { done: 0, total: action.ids.length },
      };
    case 'REFRESH_ITEM_START':
      return {
        ...state,
        activeId: action.id,
        queuedIds: state.queuedIds.filter((id) => id !== action.id),
      };
    case 'REFRESH_ITEM_DONE':
      return {
        ...state,
        activeId: null,
        progress: state.progress
          ? { ...state.progress, done: state.progress.done + 1 }
          : null,
      };
    case 'REFRESH_BATCH_DONE':
      return initialState;
  }
}

export function useRefreshQueue() {
  return useReducer(refreshReducer, initialState);
}
