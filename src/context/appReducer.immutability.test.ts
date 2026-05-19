/**
 * Tests de propiedad para inmutabilidad de versiones anteriores
 *
 * **Propiedad 3: Inmutabilidad de versiones anteriores al seleccionar**
 * Para todo PDFDocument con versiones V_1...V_n y cualquier índice k donde
 * 1 ≤ k ≤ n, ninguna acción del reducer (ADD_PDF, SET_EXTRACTED_CONTENT,
 * ADD_VERSION, SET_SEARCH_QUERY) SHALL mutar las versiones existentes del array.
 * Específicamente, tras despachar ADD_VERSION para un PDF con N versiones,
 * las primeras N versiones (índices 0..N-1) del array resultante SHALL ser
 * idénticas en contenido a las versiones originales.
 *
 * **Valida: Requisitos 6.3, 6.4**
 */

import { appReducer, initialState } from './appReducer';
import type {
  PDFDocument,
  Version,
  HistoryEntry,
  MenuContent,
  AppState,
} from '../types';

// --------------- Helpers ---------------

function makeVersion(versionNumber: number): Version {
  return {
    id: `version-${versionNumber}`,
    versionNumber,
    pdfBase64: 'dGVzdA==',
    content: { restaurantName: `Restaurant ${versionNumber}`, sections: [] },
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

function versionsAreEqual(a: Version, b: Version): boolean {
  return (
    a.id === b.id &&
    a.versionNumber === b.versionNumber &&
    a.pdfBase64 === b.pdfBase64 &&
    JSON.stringify(a.content) === JSON.stringify(b.content)
  );
}

// --------------- Tests de propiedad — Propiedad 3 ---------------

describe('appReducer — Propiedad 3: Inmutabilidad de versiones anteriores', () => {
  /**
   * Propiedad 3 — Test principal
   *
   * Para todo PDFDocument con N versiones, al despachar ADD_VERSION:
   * - Las primeras N versiones del array resultante (índices 0..N-1) son
   *   idénticas en contenido a las versiones originales.
   * - El array de versiones original no es mutado (el estado previo no cambia).
   *
   * Valida: Requisitos 6.3, 6.4
   */
  test('ADD_VERSION no altera las versiones anteriores (índices 0..N-1) (property-based)', async () => {
    const fc = await import('fast-check');

    fc.assert(
      fc.property(fc.integer({ min: 0, max: 10 }), (n) => {
        const pdfDoc = makePdfDocument(n);
        const nextNumber = n + 1;

        const originalVersionsSnapshot = pdfDoc.versions.map((v) => ({
          ...v,
          content: JSON.parse(JSON.stringify(v.content)) as MenuContent,
        }));

        const newVersion: Version = {
          id: `new-version-${nextNumber}`,
          versionNumber: nextNumber,
          pdfBase64: 'bmV3cGRm',
          content: { restaurantName: 'Nuevo Restaurante', sections: [] },
          createdAt: new Date().toISOString(),
        };

        const newHistoryEntry: HistoryEntry = {
          versionNumber: nextNumber,
          instruction: 'instrucción de prueba',
          model: 'openai',
          timestamp: new Date().toISOString(),
        };

        const state: AppState = { ...initialState, pdfs: [pdfDoc] };

        const nextState = appReducer(state, {
          type: 'ADD_VERSION',
          payload: { pdfId: pdfDoc.id, version: newVersion, historyEntry: newHistoryEntry },
        });

        const updatedDoc = nextState.pdfs.find((p) => p.id === pdfDoc.id);
        if (!updatedDoc) return false;

        for (let i = 0; i < n; i++) {
          if (!versionsAreEqual(updatedDoc.versions[i], originalVersionsSnapshot[i])) {
            return false;
          }
        }

        return true;
      }),
      { numRuns: 100 },
    );
  });

  test('ADD_VERSION no muta el array de versiones del estado anterior (property-based)', async () => {
    const fc = await import('fast-check');

    fc.assert(
      fc.property(fc.integer({ min: 0, max: 10 }), (n) => {
        const pdfDoc = makePdfDocument(n);
        const nextNumber = n + 1;

        const state: AppState = { ...initialState, pdfs: [pdfDoc] };

        const originalVersionsRef = state.pdfs[0].versions;
        const originalLength = originalVersionsRef.length;

        const newVersion: Version = {
          id: `new-version-${nextNumber}`,
          versionNumber: nextNumber,
          pdfBase64: 'bmV3cGRm',
          content: { restaurantName: 'Test', sections: [] },
          createdAt: new Date().toISOString(),
        };

        const newHistoryEntry: HistoryEntry = {
          versionNumber: nextNumber,
          instruction: 'test',
          model: 'gemini',
          timestamp: new Date().toISOString(),
        };

        appReducer(state, {
          type: 'ADD_VERSION',
          payload: { pdfId: pdfDoc.id, version: newVersion, historyEntry: newHistoryEntry },
        });

        return originalVersionsRef.length === originalLength;
      }),
      { numRuns: 100 },
    );
  });

  test('SET_EXTRACTED_CONTENT no altera las versiones existentes del PDF (property-based)', async () => {
    const fc = await import('fast-check');

    fc.assert(
      fc.property(fc.integer({ min: 0, max: 10 }), (n) => {
        const pdfDoc = makePdfDocument(n);
        const originalVersionsSnapshot = pdfDoc.versions.map((v) => ({ ...v }));

        const newContent: MenuContent = { restaurantName: 'Updated', sections: [] };
        const state: AppState = { ...initialState, pdfs: [pdfDoc] };

        const nextState = appReducer(state, {
          type: 'SET_EXTRACTED_CONTENT',
          payload: { pdfId: pdfDoc.id, content: newContent },
        });

        const updatedDoc = nextState.pdfs.find((p) => p.id === pdfDoc.id);
        if (!updatedDoc) return false;

        if (updatedDoc.versions.length !== originalVersionsSnapshot.length) return false;

        for (let i = 0; i < originalVersionsSnapshot.length; i++) {
          if (updatedDoc.versions[i].id !== originalVersionsSnapshot[i].id) return false;
          if (updatedDoc.versions[i].versionNumber !== originalVersionsSnapshot[i].versionNumber) return false;
        }

        return true;
      }),
      { numRuns: 100 },
    );
  });

  test('SET_SEARCH_QUERY no altera las versiones de ningún PDF (property-based)', async () => {
    const fc = await import('fast-check');

    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 5 }),
        fc.string({ minLength: 0, maxLength: 50 }),
        (numPdfs, query) => {
          const pdfs = Array.from({ length: numPdfs }, (_, i) =>
            makePdfDocument(i % 4, `pdf-${i}`),
          );

          const originalSnapshots = pdfs.map((p) => ({
            id: p.id,
            versionsLength: p.versions.length,
            versionIds: p.versions.map((v) => v.id),
          }));

          const state: AppState = { ...initialState, pdfs };

          const nextState = appReducer(state, {
            type: 'SET_SEARCH_QUERY',
            payload: query,
          });

          for (const snapshot of originalSnapshots) {
            const doc = nextState.pdfs.find((p) => p.id === snapshot.id);
            if (!doc) return false;
            if (doc.versions.length !== snapshot.versionsLength) return false;
            for (let i = 0; i < snapshot.versionIds.length; i++) {
              if (doc.versions[i].id !== snapshot.versionIds[i]) return false;
            }
          }

          return true;
        },
      ),
      { numRuns: 100 },
    );
  });

  test('múltiples ADD_VERSION consecutivos preservan todas las versiones anteriores (property-based)', async () => {
    const fc = await import('fast-check');

    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 5 }),
        fc.integer({ min: 1, max: 5 }),
        (initialN, extraVersions) => {
          const pdfDoc = makePdfDocument(initialN);
          let currentState: AppState = { ...initialState, pdfs: [pdfDoc] };
          const allVersionIds: string[] = pdfDoc.versions.map((v) => v.id);

          for (let i = 0; i < extraVersions; i++) {
            const currentDoc = currentState.pdfs.find((p) => p.id === pdfDoc.id)!;
            const nextNumber = currentDoc.versions.length + 1;
            const newVersionId = `added-version-${i}`;

            const newVersion: Version = {
              id: newVersionId,
              versionNumber: nextNumber,
              pdfBase64: 'dGVzdA==',
              content: { restaurantName: `Restaurante ${i}`, sections: [] },
              createdAt: new Date().toISOString(),
            };

            const newHistoryEntry: HistoryEntry = {
              versionNumber: nextNumber,
              instruction: `instrucción ${i}`,
              model: 'openai',
              timestamp: new Date().toISOString(),
            };

            currentState = appReducer(currentState, {
              type: 'ADD_VERSION',
              payload: { pdfId: pdfDoc.id, version: newVersion, historyEntry: newHistoryEntry },
            });

            allVersionIds.push(newVersionId);

            const updatedDoc = currentState.pdfs.find((p) => p.id === pdfDoc.id)!;
            for (let j = 0; j < allVersionIds.length; j++) {
              if (updatedDoc.versions[j].id !== allVersionIds[j]) return false;
            }
          }

          return true;
        },
      ),
      { numRuns: 100 },
    );
  });
});
