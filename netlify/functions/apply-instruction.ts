import type { Handler } from '@netlify/functions';
import { PDFDocument as LibPDFDocument, StandardFonts, rgb } from 'pdf-lib';
import type {
  MenuContent,
  AIModel,
  ApplyInstructionResponse,
} from '../../src/types/index.ts';

// --------------- Tipos internos ---------------

interface CallResult {
  pdfBase64: string;
  updatedContent: MenuContent;
}

// --------------- Generador de PDF con pdf-lib ---------------

/**
 * Divide un texto en líneas que caben dentro de maxWidth usando la fuente y tamaño dados.
 * pdf-lib no hace word-wrap automático, así que lo implementamos manualmente.
 */
function wrapText(
  text: string,
  font: { widthOfTextAtSize: (t: string, s: number) => number },
  fontSize: number,
  maxWidth: number,
): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    const testWidth = font.widthOfTextAtSize(testLine, fontSize);
    if (testWidth > maxWidth && currentLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  }
  if (currentLine) lines.push(currentLine);
  return lines;
}

/**
 * Genera un PDF a partir de un MenuContent con word-wrap y layout limpio.
 */
async function generatePDF(content: MenuContent): Promise<string> {
  const pdfDoc = await LibPDFDocument.create();
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);

  const pageWidth = 595;
  const pageHeight = 842;
  const margin = 50;
  const contentWidth = pageWidth - margin * 2;
  const lineHeightNormal = 15;
  const lineHeightSmall = 13;

  let page = pdfDoc.addPage([pageWidth, pageHeight]);
  let y = pageHeight - margin;

  // Añade una nueva página si no hay espacio suficiente
  const ensureSpace = (needed: number) => {
    if (y - needed < margin) {
      page = pdfDoc.addPage([pageWidth, pageHeight]);
      y = pageHeight - margin;
    }
  };

  // Dibuja texto con word-wrap y devuelve el nuevo y
  const drawWrapped = (
    text: string,
    x: number,
    font: typeof fontBold,
    fontSize: number,
    color: ReturnType<typeof rgb>,
    lineHeight: number,
    maxWidth: number,
  ) => {
    const lines = wrapText(text, font, fontSize, maxWidth);
    for (const line of lines) {
      ensureSpace(lineHeight);
      page.drawText(line, { x, y, size: fontSize, font, color });
      y -= lineHeight;
    }
  };

  // ── Nombre del restaurante ──
  ensureSpace(30);
  page.drawText(content.restaurantName, {
    x: margin,
    y,
    size: 20,
    font: fontBold,
    color: rgb(0, 0, 0),
  });
  y -= 32;

  // ── Secciones ──
  for (const section of content.sections) {
    ensureSpace(lineHeightNormal * 2 + 12);
    y -= 8;

    // Línea separadora
    page.drawLine({
      start: { x: margin, y: y + 4 },
      end: { x: pageWidth - margin, y: y + 4 },
      thickness: 0.5,
      color: rgb(0.7, 0.7, 0.7),
    });
    y -= 4;

    // Título de sección en mayúsculas
    page.drawText(section.title.toUpperCase(), {
      x: margin,
      y,
      size: 11,
      font: fontBold,
      color: rgb(0.15, 0.15, 0.15),
    });
    y -= lineHeightNormal + 6;

    // Platos
    for (const item of section.items) {
      ensureSpace(lineHeightNormal + lineHeightSmall + 4);

      // Nombre del plato a la izquierda, precio a la derecha
      if (item.price) {
        const priceWidth = fontBold.widthOfTextAtSize(item.price, 11);
        const nameMaxWidth = contentWidth - priceWidth - 10;
        const nameLines = wrapText(item.name, fontBold, 11, nameMaxWidth);

        for (let i = 0; i < nameLines.length; i++) {
          ensureSpace(lineHeightNormal);
          page.drawText(nameLines[i], {
            x: margin + 8,
            y,
            size: 11,
            font: fontBold,
            color: rgb(0, 0, 0),
          });
          // Precio solo en la primera línea
          if (i === 0) {
            page.drawText(item.price, {
              x: pageWidth - margin - priceWidth,
              y,
              size: 11,
              font: fontBold,
              color: rgb(0, 0, 0),
            });
          }
          y -= lineHeightNormal;
        }
      } else {
        drawWrapped(item.name, margin + 8, fontBold, 11, rgb(0, 0, 0), lineHeightNormal, contentWidth - 8);
      }

      // Descripción con word-wrap
      if (item.description) {
        drawWrapped(
          item.description,
          margin + 8,
          fontRegular,
          9,
          rgb(0.4, 0.4, 0.4),
          lineHeightSmall,
          contentWidth - 8,
        );
      }
      y -= 4; // espacio entre platos
    }
  }

  // ── Notas al pie ──
  if (content.footerNotes && content.footerNotes.length > 0) {
    y -= 12;
    page.drawLine({
      start: { x: margin, y: y + 4 },
      end: { x: pageWidth - margin, y: y + 4 },
      thickness: 0.5,
      color: rgb(0.7, 0.7, 0.7),
    });
    y -= 8;
    for (const note of content.footerNotes) {
      drawWrapped(`• ${note}`, margin, fontRegular, 9, rgb(0.5, 0.5, 0.5), lineHeightSmall, contentWidth);
    }
  }

  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes).toString('base64');
}

// --------------- Llamada a OpenAI GPT-4o ---------------

/**
 * Llama a OpenAI GPT-4o para aplicar la instrucción al menú y genera el PDF resultante.
 */
async function callOpenAI(
  content: MenuContent,
  instruction: string,
  apiKey: string,
): Promise<CallResult> {
  const systemPrompt =
    'Eres un asistente experto en menús de restaurante. ' +
    'Modifica el menú según la instrucción del usuario y devuelve el resultado en el mismo formato JSON.';

  const userPrompt =
    `Contenido actual del menú:\n${JSON.stringify(content, null, 2)}\n\n` +
    `Instrucción de edición:\n${instruction}\n\n` +
    'Devuelve únicamente el JSON del menú modificado, sin explicaciones adicionales.';

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    console.error('[callOpenAI] HTTP error', response.status, errorBody);
    throw new Error(`OpenAI API error: ${response.status}`);
  }

  const data = (await response.json()) as {
    choices: Array<{ message: { content: string } }>;
  };

  const rawContent = data.choices?.[0]?.message?.content;
  if (!rawContent) {
    throw new Error('OpenAI devolvió una respuesta vacía.');
  }

  let updatedContent: MenuContent;
  try {
    updatedContent = JSON.parse(rawContent) as MenuContent;
  } catch {
    throw new Error('La respuesta de OpenAI no es JSON válido.');
  }

  // Validación mínima de estructura
  if (
    typeof updatedContent.restaurantName !== 'string' ||
    !Array.isArray(updatedContent.sections)
  ) {
    throw new Error('La respuesta de OpenAI no tiene el formato MenuContent esperado.');
  }

  const pdfBase64 = await generatePDF(updatedContent);

  return { pdfBase64, updatedContent };
}

/**
 * Llama a Google Gemini para aplicar la instrucción al menú y genera el PDF resultante.
 */
async function callGemini(
  content: MenuContent,
  instruction: string,
  apiKey: string,
): Promise<CallResult> {
  const prompt =
    `Contenido actual del menú:\n${JSON.stringify(content, null, 2)}\n\n` +
    `Instrucción de edición:\n${instruction}\n\n` +
    'Devuelve únicamente el JSON del menú modificado, sin explicaciones adicionales.';

  const systemInstruction =
    'Eres un asistente experto en menús de restaurante. ' +
    'Modifica el menú según la instrucción del usuario y devuelve el resultado en el mismo formato JSON.';

  const responseSchema = {
    type: 'object',
    properties: {
      restaurantName: { type: 'string' },
      sections: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            title: { type: 'string' },
            items: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  name: { type: 'string' },
                  description: { type: 'string' },
                  price: { type: 'string' },
                },
                required: ['id', 'name'],
              },
            },
          },
          required: ['id', 'title', 'items'],
        },
      },
      footerNotes: {
        type: 'array',
        items: { type: 'string' },
      },
    },
    required: ['restaurantName', 'sections'],
  };

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      system_instruction: {
        parts: [{ text: systemInstruction }],
      },
      contents: [
        {
          parts: [{ text: prompt }],
        },
      ],
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema,
      },
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    console.error('[callGemini] HTTP error', response.status, errorBody);
    throw new Error(`Gemini API error: ${response.status}`);
  }

  const data = (await response.json()) as {
    candidates: Array<{
      content: {
        parts: Array<{ text: string }>;
      };
    }>;
  };

  const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!rawText) {
    throw new Error('Gemini devolvió una respuesta vacía.');
  }

  let updatedContent: MenuContent;
  try {
    updatedContent = JSON.parse(rawText) as MenuContent;
  } catch {
    throw new Error('La respuesta de Gemini no es JSON válido.');
  }

  // Validación mínima de estructura
  if (
    typeof updatedContent.restaurantName !== 'string' ||
    !Array.isArray(updatedContent.sections)
  ) {
    throw new Error('La respuesta de Gemini no tiene el formato MenuContent esperado.');
  }

  const pdfBase64 = await generatePDF(updatedContent);

  return { pdfBase64, updatedContent };
}

// --------------- Handler principal ---------------

export const handler: Handler = async (event) => {
  // 1. Validar método HTTP
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({
        error: 'Método no permitido. Solo se acepta POST.',
        code: 'INVALID_METHOD',
      }),
    };
  }

  // 2. Validar presencia del body
  if (!event.body) {
    return {
      statusCode: 400,
      body: JSON.stringify({
        error: 'El cuerpo de la petición está vacío.',
        code: 'MISSING_BODY',
      }),
    };
  }

  // 3. Parsear y validar campos del body
  let content: MenuContent;
  let instruction: string;
  let model: AIModel;

  try {
    const body = JSON.parse(event.body) as Record<string, unknown>;

    if (!body.content || typeof body.content !== 'object') {
      return {
        statusCode: 400,
        body: JSON.stringify({
          error: 'El campo content es obligatorio y debe ser un objeto.',
          code: 'INVALID_BODY',
        }),
      };
    }

    if (!body.instruction || typeof body.instruction !== 'string') {
      return {
        statusCode: 400,
        body: JSON.stringify({
          error: 'El campo instruction es obligatorio y debe ser un string.',
          code: 'INVALID_BODY',
        }),
      };
    }

    if (body.model !== 'openai' && body.model !== 'gemini') {
      return {
        statusCode: 400,
        body: JSON.stringify({
          error: 'El campo model es obligatorio y debe ser "openai" o "gemini".',
          code: 'INVALID_BODY',
        }),
      };
    }

    content = body.content as MenuContent;
    instruction = body.instruction;
    model = body.model;
  } catch {
    return {
      statusCode: 400,
      body: JSON.stringify({
        error: 'El cuerpo de la petición no es JSON válido.',
        code: 'MISSING_BODY',
      }),
    };
  }

  // 4. Leer API keys desde variables de entorno
  const openaiApiKey = process.env.OPENAI_API_KEY;
  const geminiApiKey = process.env.GEMINI_API_KEY;

  // 5. Verificar que la API key del modelo seleccionado esté disponible
  if (model === 'openai' && !openaiApiKey) {
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'El modelo OpenAI no está configurado. Contacta al administrador.',
        code: 'MISSING_API_KEY',
      }),
    };
  }

  if (model === 'gemini' && !geminiApiKey) {
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'El modelo Gemini no está configurado. Contacta al administrador.',
        code: 'MISSING_API_KEY',
      }),
    };
  }

  // 6. Enrutar al modelo correspondiente
  try {
    let result: CallResult;

    if (model === 'openai') {
      result = await callOpenAI(content, instruction, openaiApiKey!);
    } else {
      result = await callGemini(content, instruction, geminiApiKey!);
    }

    const response: ApplyInstructionResponse = {
      pdfBase64: result.pdfBase64,
      updatedContent: result.updatedContent,
    };

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(response),
    };
  } catch (error) {
    console.error('[apply-instruction]', error);

    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'El modelo de IA no pudo procesar la instrucción. Inténtalo de nuevo.',
        code: 'AI_ERROR',
      }),
    };
  }
};
