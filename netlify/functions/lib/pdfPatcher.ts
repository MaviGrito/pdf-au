import { PDFDocument, PDFRawStream, PDFArray, decodePDFRawStream } from 'pdf-lib';
import type { TextChange } from '../../../src/types/index.ts';

// --------------- Helpers de encoding ---------------

/**
 * Decodifica un string base64 a Uint8Array.
 */
function base64ToUint8Array(base64: string): Uint8Array {
  const binary = Buffer.from(base64, 'base64');
  return new Uint8Array(binary.buffer, binary.byteOffset, binary.byteLength);
}

/**
 * Convierte un string Latin-1 a su representación hexadecimal en mayúsculas.
 * Usado para construir strings hex PDF del tipo <HEXHEX>.
 */
function toHex(str: string): string {
  let hex = '';
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i) & 0xff;
    hex += code.toString(16).padStart(2, '0').toUpperCase();
  }
  return hex;
}

/**
 * Decodifica un string hexadecimal PDF a texto Latin-1.
 */
function fromHex(hex: string): string {
  let str = '';
  for (let i = 0; i < hex.length; i += 2) {
    str += String.fromCharCode(parseInt(hex.substring(i, i + 2), 16));
  }
  return str;
}

/**
 * Desescapa un string literal PDF (invierte el escapado de paréntesis y backslash).
 */
function unescapePdfLiteral(str: string): string {
  return str
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '\r')
    .replace(/\\t/g, '\t')
    .replace(/\\\(/g, '(')
    .replace(/\\\)/g, ')')
    .replace(/\\\\/g, '\\');
}

/**
 * Escapa un string para usarlo como literal PDF entre paréntesis.
 */
function escapePdfLiteral(str: string): string {
  return str.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

// --------------- Reconstrucción de texto TJ ---------------

/**
 * Reconstruye el texto completo de un operador TJ concatenando los strings del array
 * e ignorando los ajustes de kerning numéricos.
 *
 * Maneja tanto strings literales (texto) como strings hex <HEXHEX>.
 *
 * Ejemplo: [(Hola) 10 ( mundo)] TJ → "Hola mundo"
 * Ejemplo: [<48656C6C6F> 10 <20576F726C64>] TJ → "Hello World"
 */
function reconstructTjArrayText(arrayContent: string): string {
  const parts: string[] = [];

  // Extraer strings literales (texto) — paréntesis con posible escapado
  // y strings hex <HEXHEX>
  const regex = /\(([^)\\]*(?:\\.[^)\\]*)*)\)|<([0-9A-Fa-f]*)>/g;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(arrayContent)) !== null) {
    if (match[1] !== undefined) {
      // String literal
      parts.push(unescapePdfLiteral(match[1]));
    } else if (match[2] !== undefined) {
      // String hex
      parts.push(fromHex(match[2]));
    }
  }

  return parts.join('');
}

// --------------- Reemplazo de texto en ContentStream ---------------

/**
 * Intenta reemplazar oldText por newText en el contenido de un ContentStream.
 * Maneja:
 *   - Strings literales: (texto) Tj
 *   - Strings hex: <HEXHEX> Tj
 *   - Arrays TJ con strings literales: [(texto) kerning ...] TJ
 *   - Arrays TJ con strings hex: [<HEXHEX> kerning ...] TJ
 *
 * Retorna el contenido modificado y un flag indicando si se realizó algún reemplazo.
 */
function replaceTextInStream(
  streamContent: string,
  oldText: string,
  newText: string,
): { content: string; replaced: boolean } {
  let content = streamContent;
  let replaced = false;

  // ── Caso 1: String literal Tj — (texto) Tj ──
  // Escapar oldText para buscarlo como literal PDF
  const escapedOld = escapePdfLiteral(oldText);
  // Construir regex que busque (oldText) Tj con posible whitespace entre ) y Tj
  const literalTjRegex = new RegExp(
    `\\(${escapedOld.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\)(\\s*)Tj`,
    'g',
  );

  if (literalTjRegex.test(content)) {
    const escapedNew = escapePdfLiteral(newText);
    content = content.replace(literalTjRegex, `(${escapedNew})$1Tj`);
    replaced = true;
    return { content, replaced };
  }

  // ── Caso 2: String hex Tj — <HEXHEX> Tj ──
  const oldHex = toHex(oldText);
  const hexTjRegex = new RegExp(`<${oldHex}>(\\s*)Tj`, 'gi');

  if (hexTjRegex.test(content)) {
    const newHex = toHex(newText);
    content = content.replace(hexTjRegex, `<${newHex}>$1Tj`);
    replaced = true;
    return { content, replaced };
  }

  // ── Caso 3: Array TJ — [...] TJ ──
  // Buscar arrays TJ que contengan el oldText (posiblemente fragmentado)
  const tjArrayRegex = /\[([^\]]*)\](\s*)TJ/g;

  const newContent = content.replace(tjArrayRegex, (fullMatch, arrayContent, spacing) => {
    const reconstructed = reconstructTjArrayText(arrayContent);

    if (reconstructed.includes(oldText)) {
      // Reemplazar oldText por newText en el texto reconstruido
      const replacedText = reconstructed.replace(oldText, newText);
      // Representar el texto reemplazado como un único string hex en el array
      const newHex = toHex(replacedText);
      replaced = true;
      return `[<${newHex}>]${spacing}TJ`;
    }

    return fullMatch;
  });

  if (replaced) {
    return { content: newContent, replaced: true };
  }

  return { content, replaced: false };
}

// --------------- Acceso a ContentStreams ---------------

/**
 * Obtiene todos los PDFRawStream de contenido de una página junto con sus refs.
 */
function getPageContentStreams(
  page: ReturnType<PDFDocument['getPages']>[number],
  context: PDFDocument['context'],
): Array<{ ref: unknown; stream: PDFRawStream }> {
  const result: Array<{ ref: unknown; stream: PDFRawStream }> = [];

  try {
    const contents = page.node.Contents();
    if (!contents) return result;

    if (contents instanceof PDFArray) {
      // Array de referencias a streams
      for (let i = 0; i < contents.size(); i++) {
        const ref = contents.get(i);
        const resolved = context.lookup(ref as Parameters<typeof context.lookup>[0]);
        if (resolved instanceof PDFRawStream) {
          result.push({ ref, stream: resolved });
        }
      }
    } else if (contents instanceof PDFRawStream) {
      // Stream único directo
      result.push({ ref: contents, stream: contents });
    } else {
      // Puede ser una referencia directa
      const resolved = context.lookup(contents as Parameters<typeof context.lookup>[0]);
      if (resolved instanceof PDFRawStream) {
        result.push({ ref: contents, stream: resolved });
      }
    }
  } catch {
    // No se pudo acceder al ContentStream de esta página
  }

  return result;
}

// --------------- Función principal ---------------

/**
 * Aplica una lista de TextChange al PDF original usando pdf-lib.
 * Devuelve el PDF modificado como base64.
 *
 * Algoritmo:
 * 1. Decodificar base64 a Uint8Array y cargar con PDFDocument.load({ ignoreEncryption: true }).
 * 2. Filtrar TextChange con oldText !== null && newText !== null.
 * 3. Iterar páginas, obtener ContentStreams, localizar operadores Tj/TJ con oldText.
 * 4. Reconstruir texto fragmentado en arrays TJ (concatenar strings, ignorar kerning numérico).
 * 5. Reemplazar oldText por newText en los bytes del stream.
 * 6. Truncar newText si es más largo que oldText y registrar advertencia.
 * 7. Registrar adiciones (oldText: null) y eliminaciones (newText: null) como no aplicadas.
 * 8. Registrar advertencia cuando oldText no se encuentra en ninguna página.
 * 9. Serializar con pdfDoc.save() y devolver como base64.
 *
 * @param originalPdfBase64 - PDF original codificado en base64
 * @param changes - Lista de cambios a aplicar
 * @returns PatchedPDF codificado en base64
 */
export async function patchPdf(
  originalPdfBase64: string,
  changes: TextChange[],
): Promise<string> {
  // 1. Decodificar base64 a Uint8Array y cargar el PDF
  const pdfBytes = base64ToUint8Array(originalPdfBase64);
  const pdfDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });

  // 2. Separar los cambios según su tipo
  const applicableChanges = changes.filter(
    (c): c is { oldText: string; newText: string } =>
      c.oldText !== null && c.newText !== null,
  );

  const additions = changes.filter((c) => c.oldText === null && c.newText !== null);
  const removals = changes.filter((c) => c.oldText !== null && c.newText === null);

  // 3. Registrar adiciones y eliminaciones como no aplicadas
  for (const addition of additions) {
    console.info(
      `[pdf-patcher] INFO: Addition not applied (in-place not supported): "${addition.newText}"`,
    );
  }

  for (const removal of removals) {
    console.info(
      `[pdf-patcher] INFO: Removal not applied (in-place not supported): "${removal.oldText}"`,
    );
  }

  // 4. Preparar el estado de seguimiento de cambios aplicados
  const appliedSet = new Set<number>();

  // Preparar los textos efectivos (con truncado si aplica)
  const effectiveChanges = applicableChanges.map((change) => {
    let { oldText, newText } = change;

    if (newText.length > oldText.length) {
      const truncated = newText.slice(0, oldText.length);
      console.warn(`[pdf-patcher] WARN: Truncated "${newText}" → "${truncated}"`);
      newText = truncated;
    }

    return { oldText, newText };
  });

  // 5. Iterar páginas del PDF
  const pages = pdfDoc.getPages();

  for (const page of pages) {
    const contentStreams = getPageContentStreams(page, pdfDoc.context);

    for (const { ref, stream } of contentStreams) {
      // Decodificar el stream (maneja FlateDecode y otros filtros)
      let decoded: Uint8Array;
      try {
        decoded = decodePDFRawStream(stream).decode();
      } catch {
        // Si no se puede decodificar, saltar este stream
        continue;
      }

      // Convertir a string Latin-1
      let streamContent = Buffer.from(decoded).toString('latin1');
      let streamModified = false;

      // Aplicar cada cambio pendiente
      for (let i = 0; i < effectiveChanges.length; i++) {
        const { oldText, newText } = effectiveChanges[i];

        const { content: newStreamContent, replaced } = replaceTextInStream(
          streamContent,
          oldText,
          newText,
        );

        if (replaced) {
          streamContent = newStreamContent;
          streamModified = true;
          appliedSet.add(i);
          console.info(`[pdf-patcher] Applied: "${oldText}" → "${newText}"`);
        }
      }

      // Si el stream fue modificado, escribir los bytes de vuelta
      if (streamModified) {
        // Crear un nuevo stream sin compresión (sin FlateDecode) con el contenido modificado
        // Esto preserva el contenido pero elimina la compresión del stream modificado
        const newStream = pdfDoc.context.stream(streamContent, {
          Length: streamContent.length,
        });

        // Reemplazar el stream en el contexto del documento
        pdfDoc.context.assign(
          ref as Parameters<typeof pdfDoc.context.assign>[0],
          newStream,
        );
      }
    }
  }

  // 6. Registrar advertencias para cambios no aplicados
  for (let i = 0; i < effectiveChanges.length; i++) {
    if (!appliedSet.has(i)) {
      console.warn(
        `[pdf-patcher] WARN: Text not found in PDF: "${effectiveChanges[i].oldText}"`,
      );
    }
  }

  // 7. Serializar el PDF y devolver como base64
  const savedBytes = await pdfDoc.save();
  return Buffer.from(savedBytes).toString('base64');
}
