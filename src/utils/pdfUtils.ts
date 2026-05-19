import type { PDFDocument } from '../types';

/**
 * Decodifica una cadena base64 a Uint8Array.
 */
export function base64ToUint8Array(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

/**
 * Codifica un Uint8Array a cadena base64.
 */
export function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Construye el nombre de archivo de descarga con el formato `{slug}-v{N}.pdf`.
 * El slug convierte el nombre a minúsculas, reemplaza espacios y caracteres
 * especiales por guiones, y elimina guiones duplicados o extremos.
 */
export function buildDownloadFilename(pdfName: string, versionNumber: number): string {
  const slug = pdfName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-') // reemplaza todo lo que no sea alfanumérico por guión
    .replace(/^-+|-+$/g, '');    // elimina guiones al inicio y al final

  return `${slug}-v${versionNumber}.pdf`;
}

/**
 * Filtra una lista de PDFs por nombre, con comparación insensible a mayúsculas.
 * Si la query está vacía devuelve todos los PDFs.
 */
export function filterPDFs(pdfs: PDFDocument[], query: string): PDFDocument[] {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return pdfs;
  return pdfs.filter((pdf) =>
    pdf.name.toLowerCase().includes(normalizedQuery)
  );
}
