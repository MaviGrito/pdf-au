/**
 * Test de propiedad para el round-trip de extracción y generación
 *
 * **Propiedad 1: Round-trip de extracción y generación con preservación de estructura**
 * Para todo `MenuContent` válido generado aleatoriamente, generar PDF con `pdf-lib`
 * y extraer con `pdf-parse` SHALL producir texto que contenga el nombre del restaurante
 * y los nombres de los platos.
 *
 * Nota: El round-trip PDF→texto→MenuContent tiene pérdidas inevitables (IDs, orden
 * interno, etc.), por lo que verificamos que la información clave aparece en el texto
 * extraído en lugar de una equivalencia exacta de objetos.
 *
 * **Valida: Requisitos 9.3, 9.4**
 */

import { PDFDocument as PdfLibDocument, StandardFonts } from 'pdf-lib';
import { PDFParse } from 'pdf-parse';
import type { MenuContent } from '../types/index.ts';

/**
 * Genera un PDF a partir de un MenuContent usando pdf-lib.
 * Escribe el nombre del restaurante, los títulos de sección y los nombres de platos
 * de forma estructurada para que pdf-parse pueda extraerlos.
 */
async function generatePdfFromMenuContent(content: MenuContent): Promise<Uint8Array> {
  const pdfDoc = await PdfLibDocument.create();
  const page = pdfDoc.addPage();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

  const { height } = page.getSize();
  const margin = 50;
  let y = height - margin;
  const lineHeight = 20;

  const drawLine = (text: string, size = 12) => {
    if (y < margin) return;
    page.drawText(text, {
      x: margin,
      y,
      size,
      font,
    });
    y -= lineHeight;
  };

  // Nombre del restaurante
  drawLine(content.restaurantName, 16);
  y -= 10;

  // Secciones y platos
  for (const section of content.sections) {
    drawLine(section.title.toUpperCase(), 13);
    for (const item of section.items) {
      const itemLine = item.price ? `${item.name} ${item.price}` : item.name;
      drawLine(itemLine, 11);
    }
    y -= 5;
  }

  // Notas al pie
  if (content.footerNotes && content.footerNotes.length > 0) {
    y -= 10;
    for (const note of content.footerNotes) {
      drawLine(note, 10);
    }
  }

  return pdfDoc.save();
}

describe('extract-pdf — Propiedad 1: Round-trip de extracción y generación', () => {
  /**
   * Propiedad 1
   * Para todo MenuContent válido generado aleatoriamente:
   *   - El nombre del restaurante aparece en el texto extraído del PDF
   *   - Los nombres de los platos aparecen en el texto extraído del PDF
   *
   * Valida: Requisitos 9.3, 9.4
   */
  test(
    'El texto extraído del PDF contiene el restaurantName y los nombres de platos (property-based)',
    async () => {
      const fc = await import('fast-check');

      // Generador de strings ASCII alfanuméricos sin espacios al inicio/fin
      // Usamos stringMatching con al menos un carácter no-espacio para garantizar
      // que el texto sea visible en el PDF
      const asciiWordArb = fc.stringMatching(/^[A-Za-z0-9][A-Za-z0-9 ]{1,18}[A-Za-z0-9]$/)
        .filter((s) => s.trim().length >= 3);

      // Arbitrario para MenuItem con nombre ASCII alfanumérico
      const menuItemArb = fc.record({
        id: fc.uuid(),
        name: asciiWordArb,
        description: fc.constant(undefined),
        price: fc.constant(undefined),
      });

      // Arbitrario para MenuSection con al menos 1 item
      const menuSectionArb = fc.record({
        id: fc.uuid(),
        title: asciiWordArb,
        items: fc.array(menuItemArb, { minLength: 1, maxLength: 3 }),
      });

      // Arbitrario para MenuContent con al menos 1 sección
      const menuContentArb: fc.Arbitrary<MenuContent> = fc.record({
        restaurantName: asciiWordArb,
        sections: fc.array(menuSectionArb, { minLength: 1, maxLength: 3 }),
        footerNotes: fc.constant(undefined),
      });

      await fc.assert(
        fc.asyncProperty(menuContentArb, async (menuContent) => {
          // 1. Generar PDF con pdf-lib
          const pdfBytes = await generatePdfFromMenuContent(menuContent);

          // 2. Extraer texto con pdf-parse (API de clase PDFParse v2)
          const parser = new PDFParse({ data: pdfBytes });
          const result = await parser.getText();

          // Normalizar espacios: pdf-parse colapsa múltiples espacios consecutivos en uno
          // (comportamiento estándar de extracción de texto PDF)
          const normalizeSpaces = (s: string) => s.replace(/\s+/g, ' ').trim();
          const extractedText = normalizeSpaces(result.text);

          // 3. Verificar que el restaurantName aparece en el texto extraído
          const restaurantNameFound = extractedText.includes(normalizeSpaces(menuContent.restaurantName));

          // 4. Verificar que los nombres de los platos aparecen en el texto extraído
          const allItemNamesFound = menuContent.sections.every((section) =>
            section.items.every((item) => extractedText.includes(normalizeSpaces(item.name))),
          );

          return restaurantNameFound && allItemNamesFound;
        }),
        { numRuns: 20 },
      );
    },
    60_000, // timeout de 60s porque generar PDFs es más lento
  );
});
