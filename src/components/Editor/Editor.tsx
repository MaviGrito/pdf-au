import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAppContext } from '../../context/AppContext';
import PDFPreview from './PDFPreview';
import EditControls from './EditControls';
import { ErrorMessage } from '../shared/ErrorMessage';
import type { AIModel } from '../../types';

// --------------- Stubs temporales de hooks (Tarea 7) ---------------

/**
 * TODO: Implementar en Tarea 7.1
 * Enviará POST /api/extract-pdf y despachará SET_EXTRACTED_CONTENT.
 */
function useExtractPDF(_pdfId: string, _pdfBase64: string): { isLoading: boolean; error: string | null } {
  return { isLoading: false, error: null };
}

/**
 * TODO: Implementar en Tarea 7.2
 * Enviará POST /api/apply-instruction y despachará ADD_VERSION.
 */
function useApplyInstruction(_pdfId: string): {
  isProcessing: boolean;
  error: string | null;
  apply: (instruction: string, model: AIModel) => Promise<void>;
} {
  return {
    isProcessing: false,
    error: null,
    apply: async () => {},
  };
}

// --------------- Componente Editor ---------------

/**
 * Vista principal del editor de PDF.
 * Layout de dos paneles: PDFPreview (60%) a la izquierda y EditControls (40%) a la derecha.
 */
export default function Editor() {
  const { pdfId } = useParams<{ pdfId: string }>();
  const navigate = useNavigate();
  const { state } = useAppContext();

  // Buscar el documento en el estado global
  const pdf = state.pdfs.find((p) => p.id === pdfId);

  // Versión activa: última versión disponible o 'original'
  const [selectedVersionId, setSelectedVersionId] = useState<string>(() => {
    if (!pdf) return 'original';
    if (pdf.versions.length > 0) {
      return pdf.versions[pdf.versions.length - 1].id;
    }
    return 'original';
  });

  // Sincronizar selectedVersionId si el PDF cambia (p.ej. se añade una versión nueva)
  useEffect(() => {
    if (!pdf) return;
    if (pdf.versions.length > 0) {
      const lastVersion = pdf.versions[pdf.versions.length - 1];
      setSelectedVersionId(lastVersion.id);
    } else {
      setSelectedVersionId('original');
    }
  }, [pdf?.versions.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // Hooks de comunicación con las Netlify Functions (stubs por ahora)
  const { isLoading: isExtracting, error: extractError } = useExtractPDF(
    pdfId ?? '',
    pdf?.originalPdfBase64 ?? ''
  );
  const { isProcessing, error: applyError, apply } = useApplyInstruction(pdfId ?? '');

  // --------------- Caso: PDF no encontrado ---------------

  if (!pdf) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4 p-8 text-center">
        <p className="text-lg font-medium text-gray-700">PDF no encontrado</p>
        <p className="text-sm text-gray-500">
          El documento que buscas no existe o fue eliminado.
        </p>
        <button
          onClick={() => navigate('/')}
          className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
        >
          Volver a la lista
        </button>
      </div>
    );
  }

  // --------------- Determinar qué PDF mostrar ---------------

  const activeVersion = pdf.versions.find((v) => v.id === selectedVersionId);
  const activePdfBase64 = activeVersion ? activeVersion.pdfBase64 : pdf.originalPdfBase64;
  const activeVersionNumber = activeVersion ? activeVersion.versionNumber : 0;

  // --------------- Render principal ---------------

  return (
    <div className="flex flex-col h-screen bg-gray-100">
      {/* Cabecera */}
      <header className="flex items-center gap-3 bg-white border-b border-gray-200 px-6 py-3 shadow-sm">
        <button
          onClick={() => navigate('/')}
          aria-label="Volver a la lista de PDFs"
          className="rounded p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-5 w-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
            aria-hidden="true"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="text-base font-semibold text-gray-900 truncate">{pdf.name}</h1>
        {isExtracting && (
          <span className="ml-auto text-xs text-indigo-600 animate-pulse">
            Extrayendo contenido…
          </span>
        )}
      </header>

      {/* Mensajes de error */}
      {(extractError || applyError) && (
        <div className="px-6 pt-4 space-y-2">
          {extractError && (
            <ErrorMessage message={`Error al extraer el PDF: ${extractError}`} />
          )}
          {applyError && (
            <ErrorMessage message={`Error al aplicar la instrucción: ${applyError}`} />
          )}
        </div>
      )}

      {/* Layout de dos paneles */}
      <main className="flex flex-1 overflow-hidden gap-0">
        {/* Panel izquierdo — PDFPreview (60%) */}
        <section
          className="w-3/5 flex flex-col p-4 overflow-hidden border-r border-gray-200 bg-white"
          aria-label="Vista previa del PDF"
        >
          <PDFPreview
            pdfBase64={activePdfBase64}
            pdfName={pdf.name}
            versions={pdf.versions}
            selectedVersionId={selectedVersionId}
            onVersionChange={setSelectedVersionId}
            versionNumber={activeVersionNumber}
          />
        </section>

        {/* Panel derecho — EditControls (40%) */}
        <section
          className="w-2/5 flex flex-col p-4 overflow-y-auto bg-white"
          aria-label="Controles de edición"
        >
          <EditControls
            pdfName={pdf.name}
            pdfDescription={pdf.description}
            history={pdf.history}
            isProcessing={isProcessing}
            onApply={apply}
          />
        </section>
      </main>
    </div>
  );
}
