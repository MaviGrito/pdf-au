/**
 * Tests de propiedad para el appReducer
 *
 * **Propiedad 2: Numeración secuencial de versiones e historial**
 * Para todo PDFDocument con N versiones, al despachar ADD_VERSION el estado
 * resultante SHALL tener N+1 versiones con número N+1 y N+1 entradas en el historial.
 *
 * **Valida: Requisitos 6.1, 6.2**
 */

import { appReducer, initialState } from './appReducer';
import type {
  PDFDocument,
  Version,
  HistoryEntry,
  AppState,
} from '../types';

// --------------- Helpers ---------------

function makeVersion(versionNumber: number): Version {
  return {
    id: `version-${versionNumber}`,
    versionNumber,
    pdfBase64: 'dGVzdA==',
    content: { restaurantName: 'Test', sections: [] },
    createdAt: new Date().toISOString(),
  };
}

function makeHistoryEntry(versionNumber: number): HistoryEntry {
  return {
    versionNumber,
    instruction: `instruction ${versionNumber}`,
    model: 'openai',
    timestamp: new Date().toISOString(),
  };
}

function makePdfDocument(n: number, id: string = 'test-pdf-id'): PDFDocument {
  return {
    id,
    name: 'Test PDF',
    description: 'Test description',
    originalPdfBase64: 'dGVzdA==',
    extractedContent: null,
    versions: Array.from({ length: n }, (_, i) => makeVersion(i + 1)),
    history: Array.from({ length: n }, (_, i) => makeHistoryEntry(i + 1)),
    lastModified: new Date().toISOString(),
  };
}

// --------------- Tests de propiedad ---------------

describe('appReducer — Propiedad 2: Numeración secuencial de versiones e historial', () => {
  /**
   * Propiedad 2
   * Para todo PDFDocument con N versiones, al despachar ADD_VERSION:
   *   - El documento resultante tiene N+1 versiones
   *   - La nueva versión tiene versionNumber === N+1
   *   - El historial tiene N+1 entradas
   *
   * Valida: Requisitos 6.1, 6.2
   */
  test('ADD_VERSION incrementa versiones e historial en exactamente 1 (property-based)', async () => {
    const fc = await import('fast-check');

    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 10 }),
        fc.string({ minLength: 1, maxLength: 200 }),
        fc.constantFrom('openai' as const, 'gemini' as const),
        (n, instruction, model) => {
          const pdfDoc = makePdfDocument(n);
          const newVersionNumber = n + 1;

          const newVersion: Version = {
            id: 'new-version-id',
            versionNumber: newVersionNumber,
            pdfBase64: 'bmV3cGRm',
            content: { restaurantName: 'New Restaurant', sections: [] },
            createdAt: new Date().toISOString(),
          };

          const newHistoryEntry: HistoryEntry = {
            versionNumber: newVersionNumber,
            instruction,
            model,
            timestamp: new Date().toISOString(),
          };

          const state: AppState = {
            ...initialState,
            pdfs: [pdfDoc],
          };

          const nextState = appReducer(state, {
            type: 'ADD_VERSION',
            payload: {
              pdfId: pdfDoc.id,
              version: newVersion,
              historyEntry: newHistoryEntry,
            },
          });

          const updatedDoc = nextState.pdfs.find((p) => p.id === pdfDoc.id);
          if (!updatedDoc) return false;

          // N+1 versiones
          const hasNPlusOneVersions = updatedDoc.versions.length === n + 1;

          // La última versión tiene versionNumber === N+1
          const lastVersion = updatedDoc.versions[updatedDoc.versions.length - 1];
          const lastVersionNumberIsNPlusOne = lastVersion.versionNumber === newVersionNumber;

          // N+1 entradas en el historial
          const hasNPlusOneHistory = updatedDoc.history.length === n + 1;

          return hasNPlusOneVersions && lastVersionNumberIsNPlusOne && hasNPlusOneHistory;
        },
      ),
      { numRuns: 100 },
    );
  });

  test('ADD_VERSION no modifica otros documentos en el estado (property-based)', async () => {
    const fc = await import('fast-check');

    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 10 }),
        fc.integer({ min: 0, max: 10 }),
        (n1, n2) => {
          const targetDoc = makePdfDocument(n1, 'target-id');
          const otherDoc = makePdfDocument(n2, 'other-id');

          const newVersionNumber = n1 + 1;

          const newVersion: Version = {
            id: 'new-version-id',
            versionNumber: newVersionNumber,
            pdfBase64: 'bmV3cGRm',
            content: { restaurantName: 'Test', sections: [] },
            createdAt: new Date().toISOString(),
          };

          const newHistoryEntry: HistoryEntry = {
            versionNumber: newVersionNumber,
            instruction: 'test instruction',
            model: 'openai',
            timestamp: new Date().toISOString(),
          };

          const state: AppState = {
            ...initialState,
            pdfs: [targetDoc, otherDoc],
          };

          const nextState = appReducer(state, {
            type: 'ADD_VERSION',
            payload: {
              pdfId: targetDoc.id,
              version: newVersion,
              historyEntry: newHistoryEntry,
            },
          });

          const unchangedDoc = nextState.pdfs.find((p) => p.id === otherDoc.id);
          if (!unchangedDoc) return false;

          return (
            unchangedDoc.versions.length === otherDoc.versions.length &&
            unchangedDoc.history.length === otherDoc.history.length
          );
        },
      ),
      { numRuns: 100 },
    );
  });

  test('ADD_VERSION preserva las versiones anteriores intactas (property-based)', async () => {
    const fc = await import('fast-check');

    fc.assert(
      fc.property(fc.integer({ min: 0, max: 10 }), (n) => {
        const pdfDoc = makePdfDocument(n);
        const newVersionNumber = n + 1;

        const newVersion: Version = {
          id: 'new-version-id',
          versionNumber: newVersionNumber,
          pdfBase64: 'bmV3cGRm',
          content: { restaurantName: 'Test', sections: [] },
          createdAt: new Date().toISOString(),
        };

        const newHistoryEntry: HistoryEntry = {
          versionNumber: newVersionNumber,
          instruction: 'test instruction',
          model: 'gemini',
          timestamp: new Date().toISOString(),
        };

        const state: AppState = {
          ...initialState,
          pdfs: [pdfDoc],
        };

        const nextState = appReducer(state, {
          type: 'ADD_VERSION',
          payload: {
            pdfId: pdfDoc.id,
            version: newVersion,
            historyEntry: newHistoryEntry,
          },
        });

        const updatedDoc = nextState.pdfs.find((p) => p.id === pdfDoc.id);
        if (!updatedDoc) return false;

        // Las primeras N versiones deben ser idénticas a las originales
        for (let i = 0; i < n; i++) {
          if (updatedDoc.versions[i].id !== pdfDoc.versions[i].id) return false;
          if (updatedDoc.versions[i].versionNumber !== pdfDoc.versions[i].versionNumber) return false;
        }

        return true;
      }),
      { numRuns: 100 },
    );
  });
});
