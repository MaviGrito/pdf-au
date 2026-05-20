import type { Handler } from '@netlify/functions';
import type {
  MenuContent,
  AIModel,
  ApplyInstructionResponse,
} from '../../src/types/index.ts';
import { diffMenuContent } from './lib/diffEngine.ts';
import { patchPdf } from './lib/pdfPatcher.ts';

// --------------- Tipos internos ---------------

interface CallResult {
  updatedContent: MenuContent;
}

// --------------- Llamada a OpenAI GPT-4o ---------------

/**
 * Llama a OpenAI GPT-4o para aplicar la instrucción al menú.
 * Estrategia optimizada: envía solo un resumen compacto del menú (nombres y precios)
 * para reducir el tamaño del prompt y evitar timeouts.
 */
async function callOpenAI(
  content: MenuContent,
  instruction: string,
  apiKey: string,
): Promise<CallResult> {
  // Construir resumen compacto: solo nombres y precios, sin descripciones largas
  const compactMenu = {
    restaurantName: content.restaurantName,
    sections: content.sections.map(s => ({
      id: s.id,
      title: s.title,
      items: s.items.map(i => ({
        id: i.id,
        name: i.name,
        price: i.price,
        // Omitir description para reducir tokens
      })),
    })),
  };

  const systemPrompt =
    'Eres un asistente experto en menús de restaurante. ' +
    'Modifica el menú según la instrucción del usuario. ' +
    'IMPORTANTE: Devuelve el JSON completo del menú modificado, preservando TODOS los ids originales de secciones e items. ' +
    'No cambies los ids, solo modifica los campos de texto que correspondan a la instrucción.';

  const userPrompt =
    `Menú actual (formato compacto):\n${JSON.stringify(compactMenu)}\n\n` +
    `Instrucción: ${instruction}\n\n` +
    'Devuelve el JSON completo del menú con los cambios aplicados. Preserva todos los ids originales.';

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

  return { updatedContent };
}

/**
 * Llama a Google Gemini para aplicar la instrucción al menú.
 * Estrategia optimizada: envía solo un resumen compacto del menú.
 */
async function callGemini(
  content: MenuContent,
  instruction: string,
  apiKey: string,
): Promise<CallResult> {
  // Construir resumen compacto: solo nombres y precios, sin descripciones largas
  const compactMenu = {
    restaurantName: content.restaurantName,
    sections: content.sections.map(s => ({
      id: s.id,
      title: s.title,
      items: s.items.map(i => ({
        id: i.id,
        name: i.name,
        price: i.price,
      })),
    })),
  };

  const prompt =
    `Menú actual (formato compacto):\n${JSON.stringify(compactMenu)}\n\n` +
    `Instrucción: ${instruction}\n\n` +
    'Devuelve el JSON completo del menú con los cambios aplicados. Preserva todos los ids originales.';

  const systemInstruction =
    'Eres un asistente experto en menús de restaurante. ' +
    'Modifica el menú según la instrucción del usuario. ' +
    'IMPORTANTE: Preserva TODOS los ids originales de secciones e items. No cambies los ids.';

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

  return { updatedContent };
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
  let originalPdfBase64: string;

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

    // Task 6.1 — Validar originalPdfBase64: ausente o vacío → 400 MISSING_ORIGINAL_PDF
    if (
      !body.originalPdfBase64 ||
      typeof body.originalPdfBase64 !== 'string' ||
      body.originalPdfBase64.trim() === ''
    ) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          error: 'El campo originalPdfBase64 es obligatorio y no puede estar vacío.',
          code: 'MISSING_ORIGINAL_PDF',
        }),
      };
    }

    content = body.content as MenuContent;
    instruction = body.instruction;
    model = body.model;
    originalPdfBase64 = body.originalPdfBase64;
  } catch {
    return {
      statusCode: 400,
      body: JSON.stringify({
        error: 'El cuerpo de la petición no es JSON válido.',
        code: 'MISSING_BODY',
      }),
    };
  }

  // Task 6.1 — Validar que originalPdfBase64 comienza con header PDF válido (rápido, sin cargar todo el PDF)
  try {
    const headerBytes = Buffer.from(originalPdfBase64.substring(0, 20), 'base64');
    const header = headerBytes.toString('latin1', 0, 5);
    if (!header.startsWith('%PDF')) {
      return {
        statusCode: 422,
        body: JSON.stringify({
          error: 'El campo originalPdfBase64 no contiene un PDF válido.',
          code: 'INVALID_PDF',
        }),
      };
    }
  } catch {
    return {
      statusCode: 422,
      body: JSON.stringify({
        error: 'El campo originalPdfBase64 no contiene un PDF válido.',
        code: 'INVALID_PDF',
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

  // 6. Enrutar al modelo correspondiente y aplicar patch in-place
  try {
    // Task 6.2 — Obtener updatedContent de la IA
    let aiResult: CallResult;

    console.log(`[apply-instruction] ▶ Instrucción recibida: "${instruction}" | Modelo: ${model}`);
    console.log(`[apply-instruction] ▶ Content enviado a la IA (restaurantName: "${content.restaurantName}", secciones: ${content.sections.length}, items: ${content.sections.reduce((acc, s) => acc + s.items.length, 0)})`);

    if (model === 'openai') {
      aiResult = await callOpenAI(content, instruction, openaiApiKey!);
    } else {
      aiResult = await callGemini(content, instruction, geminiApiKey!);
    }

    const { updatedContent } = aiResult;

    console.log(`[apply-instruction] ✅ IA respondió (restaurantName: "${updatedContent.restaurantName}", secciones: ${updatedContent.sections.length}, items: ${updatedContent.sections.reduce((acc, s) => acc + s.items.length, 0)})`);

    // Verificar si la IA preservó los IDs originales
    const originalIds = new Set(content.sections.flatMap(s => s.items.map(i => i.id)));
    const updatedIds = new Set(updatedContent.sections.flatMap(s => s.items.map(i => i.id)));
    const preservedIds = [...originalIds].filter(id => updatedIds.has(id));
    console.log(`[apply-instruction] 🔍 IDs preservados por la IA: ${preservedIds.length}/${originalIds.size} (si es 0, la IA generó IDs nuevos y el diff no funcionará)`);

    // Task 6.2 — Calcular diferencias entre el contenido anterior y el nuevo
    const changes = diffMenuContent(content, updatedContent);

    console.log(`[apply-instruction] 🔄 Cambios detectados por DiffEngine: ${changes.length}`);
    changes.forEach((c, i) => {
      if (c.oldText === null) console.log(`  [${i}] ADICIÓN: "${c.newText}"`);
      else if (c.newText === null) console.log(`  [${i}] ELIMINACIÓN: "${c.oldText}"`);
      else console.log(`  [${i}] CAMBIO: "${c.oldText}" → "${c.newText}"`);
    });

    if (changes.length === 0) {
      console.warn('[apply-instruction] ⚠️ DiffEngine no detectó cambios. El PDF no será modificado. Posible causa: la IA cambió los IDs de los items.');
    }

    // Task 6.2 — Aplicar los cambios al PDF original in-place
    let patchedPdfBase64: string;
    try {
      patchedPdfBase64 = await patchPdf(originalPdfBase64, changes);
      console.log(`[apply-instruction] ✅ PDF patcheado correctamente`);
    } catch (patchError) {
      console.error('[apply-instruction] Patch error:', patchError);
      return {
        statusCode: 500,
        body: JSON.stringify({
          error: 'Error al aplicar los cambios al PDF original.',
          code: 'PATCH_ERROR',
        }),
      };
    }

    const response: ApplyInstructionResponse = {
      pdfBase64: patchedPdfBase64,
      updatedContent,
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
