import { useState, useCallback } from 'react';
import { useAppContext } from '../context/AppContext';
import { diffMenuContent } from '../utils/diffEngine';
import { patchPdf } from '../utils/pdfPatcher';
import type {
  AIModel,
  ErrorResponse,
  HistoryEntry,
  Version,
  MenuContent,
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
        // 1. Llamar a la IA (solo devuelve updatedContent, sin PDF)
        const requestBody = {
          content: pdf.extractedContent,
          instruction,
          model,
        };

        console.log('[useApplyInstruction] ▶ Enviando petición:', {
          model,
          instruction,
          contentRestaurantName: pdf.extractedContent.restaurantName,
          contentSections: pdf.extractedContent.sections.length,
          contentItems: pdf.extractedContent.sections.reduce((acc, s) => acc + s.items.length, 0),
          hasOriginalPdf: !!pdf.originalPdfBase64,
        });

        const response = await fetch('/api/apply-instruction', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody),
        });

        // Manejar 504 y otros errores que devuelven HTML en lugar de JSON
        if (response.status === 504) {
          setError('La petición tardó demasiado. Intenta con una instrucción más simple o usa Gemini.');
          return;
        }

        let data: { updatedContent: MenuContent } | ErrorResponse;
        try {
          data = await response.json();
        } catch {
          setError(`Error del servidor (${response.status}). Intenta de nuevo.`);
          return;
        }

        console.log('[useApplyInstruction] ◀ Respuesta recibida:', {
          status: response.status,
          ok: response.ok,
        });

        if (!response.ok) {
          const errData = data as ErrorResponse;
          const message = errData.code === 'MISSING_API_KEY'
            ? 'API key no configurada en el servidor. Verifica las variables de entorno en Netlify.'
            : errData.error ?? 'Error desconocido al aplicar la instrucción.';
          setError(message);
          return;
        }

        const { updatedContent } = data as { updatedContent: MenuContent };

        // 2. Calcular diff en el cliente
        const changes = diffMenuContent(pdf.extractedContent, updatedContent);
        console.log(`[useApplyInstruction] 🔄 Cambios detectados: ${changes.length}`);
        changes.forEach((c, i) => {
          if (c.oldText === null) console.log(`  [${i}] ADICIÓN: "${c.newText}"`);
          else if (c.newText === null) console.log(`  [${i}] ELIMINACIÓN: "${c.oldText}"`);
          else console.log(`  [${i}] CAMBIO: "${c.oldText}" → "${c.newText}"`);
        });

        // 3. Aplicar patch al PDF en el cliente (browser)
        console.log('[useApplyInstruction] 🔧 Aplicando patch al PDF en el cliente...');
        const patchedPdfBase64 = await patchPdf(pdf.originalPdfBase64, changes);
        console.log('[useApplyInstruction] ✅ PDF patcheado correctamente');

        // Construir la nueva versión
        const newVersion: Version = {
          id: crypto.randomUUID(),
          versionNumber: pdf.versions.length + 1,
          pdfBase64: patchedPdfBase64,
          content: updatedContent,
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
