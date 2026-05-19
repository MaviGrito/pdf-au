import type { AppState, AppAction } from '../types';

// --------------- Estado inicial ---------------

export const initialState: AppState = {
  pdfs: [],
  searchQuery: '',
};

// --------------- Reducer puro ---------------

export function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'ADD_PDF':
      return {
        ...state,
        pdfs: [...state.pdfs, action.payload],
      };

    case 'SET_EXTRACTED_CONTENT':
      return {
        ...state,
        pdfs: state.pdfs.map((pdf) =>
          pdf.id === action.payload.pdfId
            ? { ...pdf, extractedContent: action.payload.content, lastModified: new Date().toISOString() }
            : pdf
        ),
      };

    case 'ADD_VERSION':
      return {
        ...state,
        pdfs: state.pdfs.map((pdf) =>
          pdf.id === action.payload.pdfId
            ? {
                ...pdf,
                versions: [...pdf.versions, action.payload.version],
                history: [...pdf.history, action.payload.historyEntry],
                lastModified: new Date().toISOString(),
              }
            : pdf
        ),
      };

    case 'SET_SEARCH_QUERY':
      return {
        ...state,
        searchQuery: action.payload,
      };

    default:
      return state;
  }
}
