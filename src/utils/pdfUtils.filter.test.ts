/**
 * Test de propiedad para el filtrado de búsqueda de PDFs
 *
 * **Propiedad 5: Filtrado de búsqueda por nombre (completitud y corrección)**
 * Para toda lista de PDFs y texto de búsqueda T, `filterPDFs` SHALL devolver
 * exactamente los PDFs cuyo nombre contiene T (insensible a mayúsculas):
 * todos los que coinciden aparecen, ninguno que no coincide aparece.
 *
 * **Valida: Requisito 1.3**
 */

import { filterPDFs } from './pdfUtils';
import type { PDFDocument } from '../types';

// --------------- Helper ---------------

function makePDFDocument(id: string, name: string): PDFDocument {
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

// --------------- Test de propiedad ---------------

describe('filterPDFs — Propiedad 5: Filtrado de búsqueda por nombre (completitud y corrección)', () => {
  /**
   * Propiedad 5
   * Para toda lista de PDFs y texto de búsqueda T:
   *   - Completitud: todos los PDFs cuyo nombre contiene T (case-insensitive) están en el resultado
   *   - Corrección: ningún PDF cuyo nombre NO contiene T está en el resultado
   *
   * Valida: Requisito 1.3
   */
  test('filterPDFs devuelve exactamente los PDFs cuyo nombre contiene la query (property-based)', async () => {
    const fc = await import('fast-check');

    fc.assert(
      fc.property(
        // Lista de PDFs con nombres variados (puede estar vacía)
        fc.array(
          fc.record({
            id: fc.uuid(),
            name: fc.string({ minLength: 0, maxLength: 50 }),
          }),
          { minLength: 0, maxLength: 20 },
        ),
        // Query de búsqueda arbitraria (incluyendo vacía)
        fc.string({ minLength: 0, maxLength: 20 }),
        (rawPdfs, query) => {
          const pdfs = rawPdfs.map(({ id, name }) => makePDFDocument(id, name));
          const results = filterPDFs(pdfs, query);

          const normalizedQuery = query.trim().toLowerCase();

          // Si la query está vacía (o solo espacios), se devuelven todos
          if (!normalizedQuery) {
            return results.length === pdfs.length;
          }

          // Completitud: todo PDF que coincide debe estar en el resultado
          const allMatchingAreIncluded = pdfs
            .filter((p) => p.name.toLowerCase().includes(normalizedQuery))
            .every((p) => results.some((r) => r.id === p.id));

          // Corrección: ningún PDF que no coincide debe estar en el resultado
          const noNonMatchingAreIncluded = pdfs
            .filter((p) => !p.name.toLowerCase().includes(normalizedQuery))
            .every((p) => !results.some((r) => r.id === p.id));

          return allMatchingAreIncluded && noNonMatchingAreIncluded;
        },
      ),
      { numRuns: 100 },
    );
  });

  test('filterPDFs con query vacía devuelve todos los PDFs (property-based)', async () => {
    const fc = await import('fast-check');

    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            id: fc.uuid(),
            name: fc.string({ minLength: 0, maxLength: 50 }),
          }),
          { minLength: 0, maxLength: 20 },
        ),
        // Queries que son vacías o solo espacios
        fc.oneof(
          fc.constant(''),
          fc.stringMatching(/^ +$/),
        ),
        (rawPdfs, emptyQuery) => {
          const pdfs = rawPdfs.map(({ id, name }) => makePDFDocument(id, name));
          const results = filterPDFs(pdfs, emptyQuery);
          return results.length === pdfs.length;
        },
      ),
      { numRuns: 100 },
    );
  });

  test('filterPDFs es insensible a mayúsculas (property-based)', async () => {
    const fc = await import('fast-check');

    fc.assert(
      fc.property(
        // Nombres de PDF con letras ASCII para garantizar transformaciones de caso predecibles
        fc.array(
          fc.record({
            id: fc.uuid(),
            name: fc.stringMatching(/^[a-zA-Z0-9 ]{1,30}$/),
          }),
          { minLength: 1, maxLength: 15 },
        ),
        // Query con letras ASCII
        fc.stringMatching(/^[a-zA-Z0-9]{1,10}$/),
        (rawPdfs, query) => {
          const pdfs = rawPdfs.map(({ id, name }) => makePDFDocument(id, name));

          const resultsLower = filterPDFs(pdfs, query.toLowerCase());
          const resultsUpper = filterPDFs(pdfs, query.toUpperCase());

          // Ambas queries deben producir el mismo conjunto de IDs
          const idsLower = new Set(resultsLower.map((p) => p.id));
          const idsUpper = new Set(resultsUpper.map((p) => p.id));

          if (idsLower.size !== idsUpper.size) return false;
          for (const id of idsLower) {
            if (!idsUpper.has(id)) return false;
          }
          return true;
        },
      ),
      { numRuns: 100 },
    );
  });
});
