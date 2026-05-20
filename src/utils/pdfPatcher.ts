import { PDFDocument, PDFRawStream, PDFArray, decodePDFRawStream } from 'pdf-lib';
import type { TextChange } from '../types/index.ts';

// --------------- Helpers de encoding ---------------

function toHex(str: string): string {
  let hex = '';
  for (let i = 0; i < str.length; i++) {
    hex += (str.charCodeAt(i) & 0xff).toString(16).padStart(2, '0').toUpperCase();
  }
  return hex;
}

function fromHex(hex: string): string {
  let str = '';
  for (let i = 0; i < hex.length; i += 2) {
    str += String.fromCharCode(parseInt(hex.substring(i, i + 2), 16));
  }
  return str;
}

function unescapePdfLiteral(str: string): string {
  return str
    .replace(/\\n/g, '\n').replace(/\\r/g, '\r').replace(/\\t/g, '\t')
    .replace(/\\\(/g, '(').replace(/\\\)/g, ')').replace(/\\\\/g, '\\');
}

function escapePdfLiteral(str: string): string {
  return str.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

function reconstructTjArrayText(arrayContent: string): string {
  const parts: string[] = [];
  const regex = /\(([^)\\]*(?:\\.[^)\\]*)*)\)|<([0-9A-Fa-f]*)>/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(arrayContent)) !== null) {
    if (match[1] !== undefined) parts.push(unescapePdfLiteral(match[1]));
    else if (match[2] !== undefined) parts.push(fromHex(match[2]));
  }
  return parts.join('');
}

function replaceTextInStream(
  streamContent: string,
  oldText: string,
  newText: string,
): { content: string; replaced: boolean } {
  let content = streamContent;

  // Caso 1: literal Tj
  const escapedOld = escapePdfLiteral(oldText);
  const literalTjRegex = new RegExp(
    `\\(${escapedOld.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\)(\\s*)Tj`, 'g',
  );
  if (literalTjRegex.test(content)) {
    content = content.replace(literalTjRegex, `(${escapePdfLiteral(newText)})$1Tj`);
    return { content, replaced: true };
  }

  // Caso 2: hex Tj
  const oldHex = toHex(oldText);
  const hexTjRegex = new RegExp(`<${oldHex}>(\\s*)Tj`, 'gi');
  if (hexTjRegex.test(content)) {
    content = content.replace(hexTjRegex, `<${toHex(newText)}>$1Tj`);
    return { content, replaced: true };
  }

  // Caso 3: array TJ
  let replaced = false;
  const tjArrayRegex = /\[([^\]]*)\](\s*)TJ/g;
  const newContent = content.replace(tjArrayRegex, (fullMatch, arrayContent, spacing) => {
    const reconstructed = reconstructTjArrayText(arrayContent);
    if (reconstructed.includes(oldText)) {
      const replacedText = reconstructed.replace(oldText, newText);
      replaced = true;
      return `[<${toHex(replacedText)}>]${spacing}TJ`;
    }
    return fullMatch;
  });

  return replaced ? { content: newContent, replaced: true } : { content, replaced: false };
}

function getPageContentStreams(
  page: ReturnType<PDFDocument['getPages']>[number],
  context: PDFDocument['context'],
): Array<{ ref: unknown; stream: PDFRawStream }> {
  const result: Array<{ ref: unknown; stream: PDFRawStream }> = [];
  try {
    const contents = page.node.Contents();
    if (!contents) return result;
    if (contents instanceof PDFArray) {
      for (let i = 0; i < contents.size(); i++) {
        const ref = contents.get(i);
        const resolved = context.lookup(ref as Parameters<typeof context.lookup>[0]);
        if (resolved instanceof PDFRawStream) result.push({ ref, stream: resolved });
      }
    } else if (contents instanceof PDFRawStream) {
      result.push({ ref: contents, stream: contents });
    } else {
      const resolved = context.lookup(contents as Parameters<typeof context.lookup>[0]);
      if (resolved instanceof PDFRawStream) result.push({ ref: contents, stream: resolved });
    }
  } catch { /* skip */ }
  return result;
}

/**
 * Aplica una lista de TextChange al PDF original usando pdf-lib en el browser.
 * Devuelve el PDF modificado como base64.
 */
export async function patchPdf(
  originalPdfBase64: string,
  changes: TextChange[],
): Promise<string> {
  // Decodificar base64 a Uint8Array (compatible con browser y Node)
  const binaryStr = atob(originalPdfBase64);
  const pdfBytes = new Uint8Array(binaryStr.length);
  for (let i = 0; i < binaryStr.length; i++) pdfBytes[i] = binaryStr.charCodeAt(i);

  const pdfDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });

  const applicableChanges = changes.filter(
    (c): c is { oldText: string; newText: string } => c.oldText !== null && c.newText !== null,
  );

  // Truncar newText si es más largo que oldText
  const effectiveChanges = applicableChanges.map(({ oldText, newText }) => ({
    oldText,
    newText: newText.length > oldText.length ? newText.slice(0, oldText.length) : newText,
  }));

  const appliedSet = new Set<number>();
  const pages = pdfDoc.getPages();

  for (const page of pages) {
    const contentStreams = getPageContentStreams(page, pdfDoc.context);
    for (const { ref, stream } of contentStreams) {
      let decoded: Uint8Array;
      try { decoded = decodePDFRawStream(stream).decode(); } catch { continue; }

      // Convertir bytes a string Latin-1
      let streamContent = '';
      for (let i = 0; i < decoded.length; i++) {
        streamContent += String.fromCharCode(decoded[i]);
      }
      let streamModified = false;

      for (let i = 0; i < effectiveChanges.length; i++) {
        const { oldText, newText } = effectiveChanges[i];
        const { content: newStreamContent, replaced } = replaceTextInStream(streamContent, oldText, newText);
        if (replaced) {
          streamContent = newStreamContent;
          streamModified = true;
          appliedSet.add(i);
          console.log(`[pdf-patcher] Applied: "${oldText}" → "${newText}"`);
        }
      }

      if (streamModified) {
        const newStream = pdfDoc.context.stream(streamContent, { Length: streamContent.length });
        pdfDoc.context.assign(ref as Parameters<typeof pdfDoc.context.assign>[0], newStream);
      }
    }
  }

  for (let i = 0; i < effectiveChanges.length; i++) {
    if (!appliedSet.has(i)) {
      console.warn(`[pdf-patcher] Text not found in PDF: "${effectiveChanges[i].oldText}"`);
    }
  }

  const savedBytes = await pdfDoc.save();
  // Convertir Uint8Array a base64 compatible con browser
  let binary = '';
  for (let i = 0; i < savedBytes.length; i++) binary += String.fromCharCode(savedBytes[i]);
  return btoa(binary);
}
