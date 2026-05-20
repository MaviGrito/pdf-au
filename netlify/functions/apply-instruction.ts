import type { Handler } from '@netlify/functions';
import type { MenuContent, AIModel } from '../../src/types/index.ts';

/**
 * POST /api/apply-instruction
 *
 * Recibe el contenido del menú y una instrucción, llama a la IA y devuelve
 * el MenuContent modificado. El patch al PDF se hace en el cliente (browser)
 * para evitar timeouts en Netlify Functions.
 *
 * Request body: { content: MenuContent, instruction: string, model: AIModel }
 * Response body: { updatedContent: MenuContent }
 */

interface AIOnlyResponse {
  updatedContent: MenuContent;
}

// --------------- Helpers de prompt ---------------

function buildCompactMenu(content: MenuContent) {
  return {
    restaurantName: content.restaurantName,
    sections: content.sections.map(s => ({
      id: s.id,
      title: s.title,
      items: s.items.map(i => ({ id: i.id, name: i.name, price: i.price })),
    })),
  };
}

// --------------- OpenAI ---------------

async function callOpenAI(content: MenuContent, instruction: string, apiKey: string): Promise<MenuContent> {
  const compactMenu = buildCompactMenu(content);

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content:
            'Eres un asistente experto en menús de restaurante. ' +
            'Modifica el menú según la instrucción. ' +
            'IMPORTANTE: Preserva TODOS los ids originales de secciones e items sin cambiarlos. ' +
            'Devuelve el JSON completo del menú con los cambios aplicados.',
        },
        {
          role: 'user',
          content:
            `Menú actual:\n${JSON.stringify(compactMenu)}\n\n` +
            `Instrucción: ${instruction}\n\n` +
            'Devuelve el JSON del menú modificado preservando todos los ids.',
        },
      ],
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    console.error('[callOpenAI] error', response.status, err);
    throw new Error(`OpenAI API error: ${response.status}`);
  }

  const data = (await response.json()) as { choices: Array<{ message: { content: string } }> };
  const raw = data.choices?.[0]?.message?.content;
  if (!raw) throw new Error('OpenAI devolvió respuesta vacía.');

  const updated = JSON.parse(raw) as MenuContent;
  if (typeof updated.restaurantName !== 'string' || !Array.isArray(updated.sections)) {
    throw new Error('Respuesta de OpenAI con formato inesperado.');
  }
  return updated;
}

// --------------- Gemini ---------------

async function callGemini(content: MenuContent, instruction: string, apiKey: string): Promise<MenuContent> {
  const compactMenu = buildCompactMenu(content);

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      system_instruction: {
        parts: [{
          text:
            'Eres un asistente experto en menús de restaurante. ' +
            'Modifica el menú según la instrucción. ' +
            'IMPORTANTE: Preserva TODOS los ids originales de secciones e items sin cambiarlos.',
        }],
      },
      contents: [{
        parts: [{
          text:
            `Menú actual:\n${JSON.stringify(compactMenu)}\n\n` +
            `Instrucción: ${instruction}\n\n` +
            'Devuelve el JSON del menú modificado preservando todos los ids.',
        }],
      }],
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: {
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
                        price: { type: 'string' },
                      },
                      required: ['id', 'name'],
                    },
                  },
                },
                required: ['id', 'title', 'items'],
              },
            },
          },
          required: ['restaurantName', 'sections'],
        },
      },
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    console.error('[callGemini] error', response.status, err);
    throw new Error(`Gemini API error: ${response.status}`);
  }

  const data = (await response.json()) as { candidates: Array<{ content: { parts: Array<{ text: string }> } }> };
  const raw = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!raw) throw new Error('Gemini devolvió respuesta vacía.');

  const updated = JSON.parse(raw) as MenuContent;
  if (typeof updated.restaurantName !== 'string' || !Array.isArray(updated.sections)) {
    throw new Error('Respuesta de Gemini con formato inesperado.');
  }
  return updated;
}

// --------------- Handler ---------------

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Solo se acepta POST.', code: 'INVALID_METHOD' }) };
  }

  if (!event.body) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Body vacío.', code: 'MISSING_BODY' }) };
  }

  let content: MenuContent;
  let instruction: string;
  let model: AIModel;

  try {
    const body = JSON.parse(event.body) as Record<string, unknown>;

    if (!body.content || typeof body.content !== 'object') {
      return { statusCode: 400, body: JSON.stringify({ error: 'Campo content inválido.', code: 'INVALID_BODY' }) };
    }
    if (!body.instruction || typeof body.instruction !== 'string') {
      return { statusCode: 400, body: JSON.stringify({ error: 'Campo instruction inválido.', code: 'INVALID_BODY' }) };
    }
    if (body.model !== 'openai' && body.model !== 'gemini') {
      return { statusCode: 400, body: JSON.stringify({ error: 'Campo model inválido.', code: 'INVALID_BODY' }) };
    }

    content = body.content as MenuContent;
    instruction = body.instruction;
    model = body.model;
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: 'JSON inválido.', code: 'MISSING_BODY' }) };
  }

  const openaiApiKey = process.env.OPENAI_API_KEY;
  const geminiApiKey = process.env.GEMINI_API_KEY;

  if (model === 'openai' && !openaiApiKey) {
    return { statusCode: 500, body: JSON.stringify({ error: 'OPENAI_API_KEY no configurada.', code: 'MISSING_API_KEY' }) };
  }
  if (model === 'gemini' && !geminiApiKey) {
    return { statusCode: 500, body: JSON.stringify({ error: 'GEMINI_API_KEY no configurada.', code: 'MISSING_API_KEY' }) };
  }

  try {
    console.log(`[apply-instruction] modelo=${model} instrucción="${instruction}" secciones=${content.sections.length} items=${content.sections.reduce((a, s) => a + s.items.length, 0)}`);

    const updatedContent = model === 'openai'
      ? await callOpenAI(content, instruction, openaiApiKey!)
      : await callGemini(content, instruction, geminiApiKey!);

    const originalIds = new Set(content.sections.flatMap(s => s.items.map(i => i.id)));
    const updatedIds = new Set(updatedContent.sections.flatMap(s => s.items.map(i => i.id)));
    const preserved = [...originalIds].filter(id => updatedIds.has(id)).length;
    console.log(`[apply-instruction] ✅ IDs preservados: ${preserved}/${originalIds.size}`);

    const response: AIOnlyResponse = { updatedContent };
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(response),
    };
  } catch (error) {
    console.error('[apply-instruction]', error);
    return { statusCode: 500, body: JSON.stringify({ error: 'Error al procesar la instrucción.', code: 'AI_ERROR' }) };
  }
};
