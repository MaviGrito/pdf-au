/**
 * Tests unitarios para PDFList
 *
 * Verifica:
 * - La grilla renderiza el número correcto de tarjetas
 * - El campo de búsqueda filtra correctamente los PDFs
 *
 * Requisitos: 1.1, 1.3
 */

import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi } from 'vitest';
import PDFList from './PDFList';
import type { PDFDocument, AppState } from '../../types';
import * as AppContextModule from '../../context/AppContext';

// --------------- Helpers ---------------

function makePDF(id: string, name: string): PDFDocument {
  return {
    id,
    name,
    description: undefined,
    originalPdfBase64: 'dGVzdA==',
    extractedContent: null,
    versions: [],
    history: [],
    lastModified: new Date().toISOString(),
  };
}

function renderWithContext(state: AppState) {
  const dispatch = vi.fn();

  vi.spyOn(AppContextModule, 'useAppContext').mockReturnValue({ state, dispatch });

  return render(
    <MemoryRouter>
      <PDFList />
    </MemoryRouter>,
  );
}

// --------------- Tests ---------------

describe('PDFList — grilla de tarjetas', () => {
  it('renderiza el número correcto de tarjetas cuando hay PDFs', () => {
    const pdfs = [
      makePDF('1', 'Carta de verano'),
      makePDF('2', 'Menú del día'),
      makePDF('3', 'Carta de postres'),
    ];

    renderWithContext({ pdfs, searchQuery: '' });

    // Cada PDFCard tiene role="button" con el nombre del PDF como heading
    const cards = screen.getAllByRole('button', { name: /carta|menú/i });
    expect(cards).toHaveLength(3);
  });

  it('muestra el estado vacío cuando no hay PDFs', () => {
    renderWithContext({ pdfs: [], searchQuery: '' });

    expect(
      screen.getByText('No hay menús todavía. Sube tu primer PDF.'),
    ).toBeInTheDocument();
  });

  it('muestra el estado vacío con mensaje de búsqueda cuando hay query pero no hay resultados', () => {
    const pdfs = [makePDF('1', 'Carta de verano')];

    renderWithContext({ pdfs, searchQuery: 'xyz_no_existe' });

    expect(
      screen.getByText('No se encontraron menús con ese nombre.'),
    ).toBeInTheDocument();
  });

  it('renderiza exactamente una tarjeta cuando solo un PDF coincide con la búsqueda', () => {
    const pdfs = [
      makePDF('1', 'Carta de verano'),
      makePDF('2', 'Menú del día'),
      makePDF('3', 'Carta de postres'),
    ];

    // searchQuery ya filtrado por filterPDFs — simulamos el estado con query activa
    // filterPDFs filtra por nombre, así que pasamos la query y los PDFs completos
    // pero el componente llama a filterPDFs internamente con state.pdfs y state.searchQuery
    renderWithContext({ pdfs, searchQuery: 'verano' });

    // Solo "Carta de verano" contiene "verano"
    expect(screen.getByText('Carta de verano')).toBeInTheDocument();
    expect(screen.queryByText('Menú del día')).not.toBeInTheDocument();
    expect(screen.queryByText('Carta de postres')).not.toBeInTheDocument();
  });
});

describe('PDFList — campo de búsqueda', () => {
  it('el campo de búsqueda tiene el valor del searchQuery del estado', () => {
    const pdfs = [makePDF('1', 'Carta de verano')];

    renderWithContext({ pdfs, searchQuery: 'verano' });

    const input = screen.getByRole('searchbox');
    expect(input).toHaveValue('verano');
  });

  it('despacha SET_SEARCH_QUERY al escribir en el campo de búsqueda', () => {
    const dispatch = vi.fn();
    vi.spyOn(AppContextModule, 'useAppContext').mockReturnValue({
      state: { pdfs: [], searchQuery: '' },
      dispatch,
    });

    render(
      <MemoryRouter>
        <PDFList />
      </MemoryRouter>,
    );

    const input = screen.getByRole('searchbox');
    fireEvent.change(input, { target: { value: 'carta' } });

    expect(dispatch).toHaveBeenCalledWith({
      type: 'SET_SEARCH_QUERY',
      payload: 'carta',
    });
  });

  it('filtra correctamente: muestra solo los PDFs que coinciden con la búsqueda', () => {
    const pdfs = [
      makePDF('1', 'Carta de verano'),
      makePDF('2', 'Menú del día'),
      makePDF('3', 'Carta de postres'),
    ];

    // "carta" debe mostrar "Carta de verano" y "Carta de postres"
    renderWithContext({ pdfs, searchQuery: 'carta' });

    expect(screen.getByText('Carta de verano')).toBeInTheDocument();
    expect(screen.getByText('Carta de postres')).toBeInTheDocument();
    expect(screen.queryByText('Menú del día')).not.toBeInTheDocument();
  });

  it('la búsqueda es insensible a mayúsculas', () => {
    const pdfs = [
      makePDF('1', 'Carta de Verano'),
      makePDF('2', 'menú del día'),
    ];

    renderWithContext({ pdfs, searchQuery: 'CARTA' });

    expect(screen.getByText('Carta de Verano')).toBeInTheDocument();
    expect(screen.queryByText('menú del día')).not.toBeInTheDocument();
  });

  it('con query vacía muestra todos los PDFs', () => {
    const pdfs = [
      makePDF('1', 'Carta de verano'),
      makePDF('2', 'Menú del día'),
    ];

    renderWithContext({ pdfs, searchQuery: '' });

    expect(screen.getByText('Carta de verano')).toBeInTheDocument();
    expect(screen.getByText('Menú del día')).toBeInTheDocument();
  });
});
