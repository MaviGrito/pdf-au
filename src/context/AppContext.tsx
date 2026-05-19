import React, { createContext, useContext, useReducer } from 'react';
import type { AppState, AppAction } from '../types';
import { appReducer, initialState } from './appReducer';

// --------------- Tipo del contexto ---------------

interface AppContextValue {
  state: AppState;
  dispatch: React.Dispatch<AppAction>;
}

// --------------- Creación del contexto ---------------

const AppContext = createContext<AppContextValue | undefined>(undefined);

// --------------- Provider ---------------

interface AppProviderProps {
  children: React.ReactNode;
}

export function AppProvider({ children }: AppProviderProps) {
  const [state, dispatch] = useReducer(appReducer, initialState);

  return (
    <AppContext.Provider value={{ state, dispatch }}>
      {children}
    </AppContext.Provider>
  );
}

// --------------- Hook ---------------

/**
 * Hook para acceder al contexto global de la aplicación.
 * Lanza un error descriptivo si se usa fuera de `AppProvider`.
 */
export function useAppContext(): AppContextValue {
  const context = useContext(AppContext);

  if (context === undefined) {
    throw new Error(
      'useAppContext debe usarse dentro de un <AppProvider>. ' +
      'Asegúrate de envolver tu árbol de componentes con <AppProvider>.'
    );
  }

  return context;
}
