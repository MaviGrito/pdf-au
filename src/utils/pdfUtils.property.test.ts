/**
 * Tests de propiedad para pdfUtils
 *
 * **Propiedad 4: Formato de nombre de archivo de descarga**
 * Para todo nombre de PDF (string arbitrario) y número de versión N > 0,
 * `buildDownloadFilename` SHALL producir `{slug}-v{N}.pdf`, donde `{slug}` es
 * el nombre en minúsculas con caracteres no alfanuméricos reemplazados por
 * guiones y sin guiones al inicio o al final.
 *
 * **Valida: Requisito 7.2**
 */

import { buildDownloadFilename } from './pdfUtils';

describe('pdfUtils — Propiedad 4: Formato de nombre de archivo de descarga', () => {
  /**
   * Propiedad 4
   * Para todo nombre de PDF y número de versión N > 0:
   *   - El resultado termina en `.pdf`
   *   - El resultado contiene `-v{N}` inmediatamente antes de `.pdf`
   *   - El slug (parte antes de `-v{N}.pdf`) solo contiene caracteres
   *     alfanuméricos en minúsculas y guiones
   *
   * Valida: Requisito 7.2
   */
  test('buildDownloadFilename produce {slug}-v{N}.pdf para cualquier nombre y versión N > 0 (property-based)', async () => {
    const fc = await import('fast-check');

    fc.assert(
      fc.property(
        // Nombres de PDF: strings arbitrarios con al menos un carácter alfanumérico
        fc.stringMatching(/[a-zA-Z0-9]/),
        // Número de versión: entero positivo
        fc.integer({ min: 1, max: 1000 }),
        (pdfName, versionNumber) => {
          const result = buildDownloadFilename(pdfName, versionNumber);

          // 1. El resultado debe terminar en `.pdf`
          const endsWithPdf = result.endsWith('.pdf');

          // 2. El resultado debe contener `-v{N}` antes de `.pdf`
          const versionSuffix = `-v${versionNumber}.pdf`;
          const containsVersionSuffix = result.endsWith(versionSuffix);

          // 3. Extraer el slug (todo lo que está antes de `-v{N}.pdf`)
          const slug = result.slice(0, result.length - versionSuffix.length);

          // 4. El slug solo debe contener caracteres alfanuméricos en minúsculas y guiones
          const slugIsValid = /^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]$/.test(slug);

          // 5. El slug no debe tener guiones al inicio ni al final
          const slugNoLeadingTrailingHyphens = !slug.startsWith('-') && !slug.endsWith('-');

          return (
            endsWithPdf &&
            containsVersionSuffix &&
            slugIsValid &&
            slugNoLeadingTrailingHyphens
          );
        },
      ),
      { numRuns: 100 },
    );
  });

  test('buildDownloadFilename: el resultado siempre termina en .pdf (property-based)', async () => {
    const fc = await import('fast-check');

    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 100 }),
        fc.integer({ min: 1, max: 9999 }),
        (pdfName, versionNumber) => {
          const result = buildDownloadFilename(pdfName, versionNumber);
          return result.endsWith('.pdf');
        },
      ),
      { numRuns: 100 },
    );
  });

  test('buildDownloadFilename: el resultado siempre contiene -v{N} antes de .pdf (property-based)', async () => {
    const fc = await import('fast-check');

    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 100 }),
        fc.integer({ min: 1, max: 9999 }),
        (pdfName, versionNumber) => {
          const result = buildDownloadFilename(pdfName, versionNumber);
          return result.endsWith(`-v${versionNumber}.pdf`);
        },
      ),
      { numRuns: 100 },
    );
  });

  test('buildDownloadFilename: el slug no contiene caracteres no alfanuméricos excepto guiones (property-based)', async () => {
    const fc = await import('fast-check');

    fc.assert(
      fc.property(
        // Nombres con caracteres especiales, espacios, mayúsculas, etc.
        fc.stringMatching(/[a-zA-Z0-9]/),
        fc.integer({ min: 1, max: 9999 }),
        (pdfName, versionNumber) => {
          const result = buildDownloadFilename(pdfName, versionNumber);
          const versionSuffix = `-v${versionNumber}.pdf`;
          const slug = result.slice(0, result.length - versionSuffix.length);

          // El slug solo debe tener letras minúsculas, dígitos y guiones
          return /^[a-z0-9-]+$/.test(slug);
        },
      ),
      { numRuns: 100 },
    );
  });
});
