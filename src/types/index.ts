// ============================================================
// Tipos compartidos — PDF Menu Editor
// ============================================================

// --------------- Modelos de IA ---------------

/** Modelo de IA disponible para procesar instrucciones */
export type AIModel = 'openai' | 'gemini';

// --------------- Estructura del menú ---------------

/** Plato individual del menú */
export interface MenuItem {
  id: string;           // UUID generado en extracción
  name: string;         // Nombre del plato
  description?: string; // Descripción opcional
  price?: string;       // Precio como string (ej. "12.50€")
}

/** Sección del menú (ej. "Entrantes", "Postres") */
export interface MenuSection {
  id: string;
  title: string;
  items: MenuItem[];
}

/** Contenido completo del menú extraído o modificado */
export interface MenuContent {
  restaurantName: string;
  sections: MenuSection[];
  footerNotes?: string[]; // Notas al pie opcionales
}

// --------------- Versiones e historial ---------------

/** Versión de un PDF (resultado de una edición exitosa) */
export interface Version {
  id: string;           // UUID
  versionNumber: number; // Número secuencial (1, 2, 3…)
  pdfBase64: string;    // PDF codificado en base64
  content: MenuContent; // Contenido del menú en esta versión
  createdAt: string;    // ISO 8601
}

/** Entrada en el historial de cambios */
export interface HistoryEntry {
  versionNumber: number;
  instruction: string;  // Instrucción aplicada
  model: AIModel;       // Modelo usado
  timestamp: string;    // ISO 8601
}

// --------------- Documento PDF ---------------

/** PDF con todas sus versiones e historial */
export interface PDFDocument {
  id: string;                          // UUID
  name: string;
  description?: string;
  originalPdfBase64: string;           // PDF original subido por el usuario
  extractedContent: MenuContent | null; // null hasta que se extrae
  versions: Version[];                 // v1, v2, v3…
  history: HistoryEntry[];
  lastModified: string;                // ISO 8601
}

// --------------- Estado global ---------------

/** Estado global de la aplicación */
export interface AppState {
  pdfs: PDFDocument[];
  searchQuery: string;
}

/** Acciones del reducer */
export type AppAction =
  | { type: 'ADD_PDF'; payload: PDFDocument }
  | { type: 'SET_EXTRACTED_CONTENT'; payload: { pdfId: string; content: MenuContent } }
  | { type: 'ADD_VERSION'; payload: { pdfId: string; version: Version; historyEntry: HistoryEntry } }
  | { type: 'SET_SEARCH_QUERY'; payload: string };

// --------------- Edición in-place ---------------

/** Par de textos a reemplazar en el PDF */
export interface TextChange {
  oldText: string | null; // null = plato nuevo (adición)
  newText: string | null; // null = plato eliminado
}

// --------------- Interfaces de Netlify Functions ---------------

/** Request para POST /api/extract-pdf */
export interface ExtractPDFRequest {
  pdfBase64: string; // PDF codificado en base64
}

/** Response de POST /api/extract-pdf (éxito) */
export interface ExtractPDFResponse {
  content: MenuContent;
}

/** Request para POST /api/apply-instruction */
export interface ApplyInstructionRequest {
  content: MenuContent;        // Contenido actual del menú
  instruction: string;         // Instrucción del usuario
  model: AIModel;
  originalPdfBase64: string;   // PDF original del usuario (para edición in-place)
}

/** Response de POST /api/apply-instruction (éxito) */
export interface ApplyInstructionResponse {
  pdfBase64: string;           // Nuevo PDF generado
  updatedContent: MenuContent; // Contenido modificado por la IA
}

/** Response de error genérico para todas las Netlify Functions */
export interface ErrorResponse {
  error: string;
  code: string;
}
