import { useState, useCallback } from 'react';
import { useAppContext } from '../context/AppContext';
import type {
  AIModel,
  ApplyInstructionRequest,
  ApplyInstructionResponse,
  ErrorResponse,
  HistoryEntry,
  Version,
} from '../types';

/**
 * Hook que llama a POST /api/apply-instruction con la instrucción del usuario.
 * En éxito despacha ADD_VERSION con la nueva versión y entrada de historial.
 * En error expone el mensaje sin modificar el estado de versiones.
 *
 * @param pdfId - ID del PDFDocument en el estado global
 * @returns `{ isProcessing, error, apply }`
 */
function useApplyInstruction(
  pdfId: string
): {
  isProcessing: boolean;
  error: string | null;
  apply: (instruction: string, model: AIModel) => Promise<void>;
} {
  const { state, dispatch } = useAppContext();
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const apply = useCallback(
    async (instruction: string, model: AIModel): Promise<void> => {
      // Obtener el PDF del estado global
      const pdf = state.pdfs.find((p) => p.id === pdfId);

      if (!pdf) {
        setError('No se encontró el PDF en el estado global.');
        return;
      }

      if (!pdf.extractedContent) {
        setError('El contenido del PDF aún no ha sido extraído.');
        return;
      }

      setIsProcessing(true);
      setError(null);

      try {
        const requestBody: ApplyInstructionRequest = {
          content: pdf.extractedContent,
          instruction,
          model,
          originalPdfBase64: pdf.originalPdfBase64,
        };

        const response = await fetch('/api/apply-instruction', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody),
        });

        const data: ApplyInstructionResponse | ErrorResponse = await response.json();

        if (!response.ok) {
          const errData = data as ErrorResponse;
          const message = errData.code === 'MISSING_API_KEY'
            ? `API key no configurada en el servidor. Verifica las variables de entorno en Netlify.`
            : errData.error ?? 'Error desconocido al aplicar la instrucción.';
          setError(message);
          return;
        }

        const successData = data as ApplyInstructionResponse;

        // Construir la nueva versión
        const newVersion: Version = {
          id: crypto.randomUUID(),
          versionNumber: pdf.versions.length + 1,
          pdfBase64: successData.pdfBase64,
          content: successData.updatedContent,
          createdAt: new Date().toISOString(),
        };

        // Construir la entrada de historial
        const historyEntry: HistoryEntry = {
          versionNumber: newVersion.versionNumber,
          instruction,
          model,
          timestamp: new Date().toISOString(),
        };

        dispatch({
          type: 'ADD_VERSION',
          payload: {
            pdfId,
            version: newVersion,
            historyEntry,
          },
        });
      } catch (err) {
        // Error de red u otro error inesperado
        const message =
          err instanceof Error
            ? err.message
            : 'Error de red al aplicar la instrucción.';
        setError(message);
      } finally {
        setIsProcessing(false);
      }
    },
    [pdfId, state.pdfs, dispatch]
  );

  return { isProcessing, error, apply };
}

export default useApplyInstruction;
