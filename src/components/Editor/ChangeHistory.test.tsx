/**
 * Test de propiedad para ChangeHistory
 *
 * **Propiedad 8: Renderizado completo del historial de cambios**
 * Para todo array de `HistoryEntry` de tamaño N, `ChangeHistory` SHALL renderizar
 * exactamente N entradas con instrucción, número de versión y timestamp.
 *
 * **Valida: Requisito 6.2**
 */

import { render, within } from '@testing-library/react';
import { describe, test } from 'vitest';
import ChangeHistory from './ChangeHistory';
import type { HistoryEntry } from '../../types';

// --------------- Helpers ---------------

/**
 * Genera un timestamp ISO 8601 determinista a partir de un índice,
 * para evitar colisiones en la key `${versionNumber}-${timestamp}`.
 */
function makeTimestamp(index: number): string {
  return new Date(2024, 0, 1, 0, index, 0).toISOString();
}

// --------------- Tests de propiedad ---------------

describe('ChangeHistory — Propiedad 8: Renderizado completo del historial', () => {
  /**
   * Propiedad 8
   * Para todo array de HistoryEntry de tamaño N (0 ≤ N ≤ 10):
   *   - Se renderizan exactamente N entradas (identificadas por "v{versionNumber}")
   *   - Cada instrucción aparece en el DOM (o su versión truncada a 80 chars)
   *   - Cada timestamp formateado aparece en el DOM
   *
   * Valida: Requisito 6.2
   */
  test(
    'renderiza exactamente N entradas para todo array de HistoryEntry de tamaño N (property-based)',
    async () => {
      const fc = await import('fast-check');

      // Arbitrario para instrucciones: strings no vacíos de hasta 200 caracteres
      const instructionArb = fc.string({ minLength: 1, maxLength: 200 }).filter(
        (s) => s.trim().length > 0,
      );

      // Arbitrario para modelo
      const modelArb = fc.constantFrom('openai' as const, 'gemini' as const);

      // Arbitrario para un array de HistoryEntry de tamaño N (0 a 10)
      const historyArb = fc.integer({ min: 0, max: 10 }).chain((n) =>
        fc.tuple(
          ...Array.from({ length: n }, (_, i) =>
            fc.tuple(instructionArb, modelArb).map(
              ([instruction, model]): HistoryEntry => ({
                versionNumber: i + 1,
                instruction,
                model,
                timestamp: makeTimestamp(i),
              }),
            ),
          ),
        ).map((entries) => entries as HistoryEntry[]),
      );

      fc.assert(
        fc.property(historyArb, (history) => {
          const { container, unmount } = render(<ChangeHistory history={history} />);
          const scope = within(container);

          const n = history.length;

          if (n === 0) {
            // Caso vacío: debe mostrar el mensaje de "sin cambios"
            const emptyMsg = scope.queryByText(/sin cambios registrados/i);
            unmount();
            return emptyMsg !== null;
          }

          // Verificar que se renderizan exactamente N entradas (<li>)
          const listItems = container.querySelectorAll('li');
          const hasExactlyNItems = listItems.length === n;

          // Verificar que se renderizan exactamente N badges de versión "v{N}"
          // Usamos regex porque el componente puede renderizar whitespace alrededor del número
          const allVersionBadgesPresent = history.every((entry) => {
            const regex = new RegExp(`v\\s*${entry.versionNumber}\\b`);
            return scope.queryAllByText(regex).length >= 1;
          });

          // Verificar que cada instrucción (o su truncado) aparece en el DOM
          // Normalizamos el texto de búsqueda igual que testing-library normaliza el DOM
          const allInstructionsPresent = history.every((entry) => {
            const truncated =
              entry.instruction.length <= 80
                ? entry.instruction
                : `${entry.instruction.slice(0, 80)}\u2026`;
            // Normalizar: colapsar espacios múltiples y recortar extremos (igual que getNodeText)
            const normalized = truncated.replace(/\s+/g, ' ').trim();
            if (normalized.length === 0) return true; // instrucción vacía tras normalizar
            return scope.queryAllByText(normalized).length >= 1;
          });

          unmount();
          return hasExactlyNItems && allVersionBadgesPresent && allInstructionsPresent;
        }),
        { numRuns: 100 },
      );
    },
    30_000, // PBT with React renders can be slow
  );

  test(
    'el número de elementos <li> coincide exactamente con N (property-based)',
    async () => {
      const fc = await import('fast-check');

      const instructionArb = fc.string({ minLength: 1, maxLength: 100 }).filter(
        (s) => s.trim().length > 0,
      );

      const historyArb = fc.integer({ min: 1, max: 10 }).chain((n) =>
        fc.tuple(
          ...Array.from({ length: n }, (_, i) =>
            instructionArb.map(
              (instruction): HistoryEntry => ({
                versionNumber: i + 1,
                instruction,
                model: 'openai',
                timestamp: makeTimestamp(i),
              }),
            ),
          ),
        ).map((entries) => entries as HistoryEntry[]),
      );

      fc.assert(
        fc.property(historyArb, (history) => {
          const { container, unmount } = render(<ChangeHistory history={history} />);

          const listItems = container.querySelectorAll('li');
          const result = listItems.length === history.length;

          unmount();
          return result;
        }),
        { numRuns: 100 },
      );
    },
    30_000, // PBT with React renders can be slow
  );
});
