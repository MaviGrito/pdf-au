import type { Handler } from '@netlify/functions';
import { extractText } from 'unpdf';
import { randomUUID } from 'crypto';
import type { MenuContent, MenuSection, MenuItem } from '../../src/types/index.ts';

// Patrón para detectar notas al pie
const FOOTER_NOTE_PATTERN = /^[*†‡§¶#]/;

// Patrón para detectar títulos de sección:
// - Todo en mayúsculas (mínimo 3 caracteres, sin números)
// - O termina con ":" con pocas palabras
const SECTION_TITLE_PATTERN = /^[A-ZÁÉÍÓÚÜÑ\s\(\)\/]{3,}$|^[A-ZÁÉÍÓÚÜÑ][^.!?]{2,40}:$/;

// Patrón para detectar precios (ej. "12.50", "$12.50", "12,50 €", "MP")
const PRICE_PATTERN = /(?:€|\$|£)\s*\d+(?:[.,]\d{1,2})?|\d+(?:[.,]\d{1,2})?\s*(?:€|\$|£)|\bMP\b|\b\d{1,3}(?:\.\d{2})?\b(?:\s*-\s*\d{1,3}(?:\.\d{2})?)?$/;

/**
 * Parsea el texto extraído del PDF y construye un MenuContent.
 */
function parseMenuText(text: string): MenuContent {
  const lines = text
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length === 0) {
    return { restaurantName: '', sections: [], footerNotes: [] };
  }

  // Primera línea no vacía → nombre del restaurante
  const restaurantName = lines[0];

  const footerNotes: string[] = [];
  const contentLines: string[] = [];

  // Separar notas al pie del resto del contenido
  for (const line of lines.slice(1)) {
    if (FOOTER_NOTE_PATTERN.test(line)) {
      footerNotes.push(line);
    } else {
      contentLines.push(line);
    }
  }

  // Construir secciones a partir de las líneas de contenido
  const sections: MenuSection[] = [];
  let currentSection: MenuSection | null = null;
  let currentItems: MenuItem[] = [];

  const flushSection = () => {
    if (currentSection !== null) {
      currentSection.items = currentItems;
      sections.push(currentSection);
      currentItems = [];
      currentSection = null;
    }
  };

  for (const line of contentLines) {
    const isSectionTitle =
      SECTION_TITLE_PATTERN.test(line) && !PRICE_PATTERN.test(line);

    if (isSectionTitle) {
      flushSection();
      currentSection = {
        id: randomUUID(),
        title: line.replace(/:$/, '').trim(),
        items: [],
      };
    } else {
      // Si no hay sección activa, crear una sección genérica
      if (currentSection === null) {
        currentSection = {
          id: randomUUID(),
          title: 'Menú',
          items: [],
        };
      }

      // Intentar extraer precio de la línea
      const priceMatch = line.match(PRICE_PATTERN);
      const price = priceMatch ? priceMatch[0].trim() : undefined;
      const name = price ? line.replace(PRICE_PATTERN, '').trim() : line;

      if (name.length > 0) {
        currentItems.push({
          id: randomUUID(),
          name,
          price,
        });
      }
    }
  }

  flushSection();

  return {
    restaurantName,
    sections,
    footerNotes: footerNotes.length > 0 ? footerNotes : undefined,
  };
}

export const handler: Handler = async (event) => {
  // Validar método HTTP
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({
        error: 'Método no permitido. Solo se acepta POST.',
        code: 'INVALID_METHOD',
      }),
    };
  }

  // Validar presencia del body
  if (!event.body) {
    return {
      statusCode: 400,
      body: JSON.stringify({
        error: 'El cuerpo de la petición está vacío.',
        code: 'MISSING_BODY',
      }),
    };
  }

  let pdfBase64: string;

  try {
    const body = JSON.parse(event.body) as Record<string, unknown>;

    if (!body.pdfBase64 || typeof body.pdfBase64 !== 'string') {
      return {
        statusCode: 400,
        body: JSON.stringify({
          error: 'El campo pdfBase64 es obligatorio.',
          code: 'MISSING_PDF',
        }),
      };
    }

    pdfBase64 = body.pdfBase64;
  } catch {
    return {
      statusCode: 400,
      body: JSON.stringify({
        error: 'El cuerpo de la petición no es JSON válido.',
        code: 'MISSING_BODY',
      }),
    };
  }

  try {
    // Decodificar base64 a Uint8Array para unpdf
    const pdfBuffer = Buffer.from(pdfBase64, 'base64');
    const uint8Array = new Uint8Array(pdfBuffer);

    // Extraer texto con unpdf (compatible con entornos serverless/edge)
    const { text: pages } = await extractText(uint8Array, { mergePages: true });
    const text = Array.isArray(pages) ? pages.join('\n') : String(pages);

    // Construir MenuContent a partir del texto extraído
    const content: MenuContent = parseMenuText(text);

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content }),
    };
  } catch (error) {
    console.error('[extract-pdf]', error);

    return {
      statusCode: 422,
      body: JSON.stringify({
        error: 'No se pudo procesar el archivo PDF.',
        code: 'PARSE_ERROR',
      }),
    };
  }
};
