import { useEffect, useState } from 'react';
import { useAppContext } from '../context/AppContext';
import type { ExtractPDFResponse, ErrorResponse } from '../types';

/**
 * Hook que llama a POST /api/extract-pdf al montar el componente.
 * Despacha SET_EXTRACTED_CONTENT en éxito y expone el error en caso de fallo.
 *
 * @param pdfId    - ID del PDFDocument en el estado global
 * @param pdfBase64 - Contenido del PDF codificado en base64
 * @returns `{ isLoading, error }`
 */
function useExtractPDF(
  pdfId: string,
  pdfBase64: string
): { isLoading: boolean; error: string | null } {
  const { dispatch } = useAppContext();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // No hacer nada si no hay PDF
    if (!pdfBase64) return;

    const controller = new AbortController();

    const fetchExtract = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch('/api/extract-pdf', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pdfBase64 }),
          signal: controller.signal,
        });

        const data: ExtractPDFResponse | ErrorResponse = await response.json();

        if (!response.ok) {
          // La API devolvió un error con { error, code }
          const errData = data as ErrorResponse;
          setError(errData.error ?? 'Error desconocido al extraer el PDF.');
          return;
        }

        const successData = data as ExtractPDFResponse;
        dispatch({
          type: 'SET_EXTRACTED_CONTENT',
          payload: { pdfId, content: successData.content },
        });
      } catch (err) {
        // Ignorar errores de cancelación por desmontaje
        if (err instanceof DOMException && err.name === 'AbortError') return;

        // Error de red u otro error inesperado
        const message =
          err instanceof Error ? err.message : 'Error de red al extraer el PDF.';
        setError(message);
      } finally {
        setIsLoading(false);
      }
    };

    fetchExtract();

    // Cancelar la petición si el componente se desmonta
    return () => {
      controller.abort();
    };
  }, [pdfId, pdfBase64, dispatch]);

  return { isLoading, error };
}

export default useExtractPDF;
