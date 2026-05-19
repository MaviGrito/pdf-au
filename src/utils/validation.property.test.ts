/**
 * Tests de propiedad para validation.ts
 *
 * **Propiedad 6: Validación de formulario de carga rechaza entradas inválidas**
 * Para todo nombre vacío o solo espacios, o archivo sin extensión `.pdf`,
 * `validateUploadForm` SHALL devolver `valid: false`.
 *
 * **Valida: Requisitos 2.6, 2.7**
 */

import { validateUploadForm } from './validation';

describe('validation — Propiedad 6: Validación de formulario rechaza entradas inválidas', () => {
  /**
   * Test 1: nombre vacío o solo espacios → valid: false
   *
   * Para todo string vacío o compuesto únicamente de espacios en blanco,
   * `validateUploadForm` SHALL devolver `valid: false`.
   *
   * Valida: Requisito 2.6
   */
  test('nombre vacío o solo espacios siempre produce valid: false (property-based)', async () => {
    const fc = await import('fast-check');

    // Archivo PDF válido para aislar la validación del nombre
    const validFile = new File(['content'], 'menu.pdf', { type: 'application/pdf' });

    fc.assert(
      fc.property(
        // Genera strings vacíos o compuestos solo de espacios en blanco
        fc.oneof(
          fc.constant(''),
          fc.stringMatching(/^\s+$/),
        ),
        (emptyOrBlankName) => {
          const result = validateUploadForm(emptyOrBlankName, validFile);
          return result.valid === false;
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * Test 2: archivo sin extensión `.pdf` → valid: false
   *
   * Para todo archivo cuyo nombre no termine en `.pdf` (insensible a mayúsculas),
   * `validateUploadForm` SHALL devolver `valid: false`.
   *
   * Valida: Requisito 2.7
   */
  test('archivo sin extensión .pdf siempre produce valid: false (property-based)', async () => {
    const fc = await import('fast-check');

    // Nombre válido para aislar la validación del archivo
    const validName = 'Menú del restaurante';

    // Extensiones que no son .pdf
    const nonPdfExtensions = ['.txt', '.doc', '.docx', '.png', '.jpg', '.jpeg', '.csv', '.xls', '.xlsx', '.zip', ''];

    fc.assert(
      fc.property(
        // Genera nombres de archivo con extensiones que no son .pdf
        fc.oneof(
          // Nombre con extensión no-pdf conocida
          fc.tuple(
            fc.stringMatching(/^[a-zA-Z0-9_-]{1,20}$/),
            fc.constantFrom(...nonPdfExtensions),
          ).map(([base, ext]) => `${base}${ext}`),
          // Nombre sin extensión (solo letras/números)
          fc.stringMatching(/^[a-zA-Z0-9_-]{1,20}$/),
        ),
        (nonPdfFilename) => {
          // Asegurarse de que el nombre no termine en .pdf (case-insensitive)
          if (nonPdfFilename.toLowerCase().endsWith('.pdf')) {
            return true; // Saltar este caso, no es lo que queremos probar
          }

          const file = new File(['content'], nonPdfFilename, { type: 'application/octet-stream' });
          const result = validateUploadForm(validName, file);
          return result.valid === false;
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * Test 3: nombre válido + archivo .pdf → valid: true
   *
   * Para todo nombre no vacío y archivo con extensión `.pdf`,
   * `validateUploadForm` SHALL devolver `valid: true`.
   *
   * Valida: Requisitos 2.6, 2.7 (caso positivo)
   */
  test('nombre válido y archivo .pdf siempre produce valid: true (property-based)', async () => {
    const fc = await import('fast-check');

    fc.assert(
      fc.property(
        // Nombres válidos: al menos un carácter no-espacio
        fc.stringMatching(/\S/).filter((s) => s.trim().length > 0),
        // Nombres de archivo con extensión .pdf (en distintas capitalizaciones)
        fc.oneof(
          fc.stringMatching(/^[a-zA-Z0-9_-]{1,20}$/).map((base) => `${base}.pdf`),
          fc.stringMatching(/^[a-zA-Z0-9_-]{1,20}$/).map((base) => `${base}.PDF`),
          fc.stringMatching(/^[a-zA-Z0-9_-]{1,20}$/).map((base) => `${base}.Pdf`),
        ),
        (validName, pdfFilename) => {
          const file = new File(['content'], pdfFilename, { type: 'application/pdf' });
          const result = validateUploadForm(validName, file);
          return result.valid === true;
        },
      ),
      { numRuns: 100 },
    );
  });
});
