import { LoadingSpinner } from '../shared/LoadingSpinner';

interface InstructionInputProps {
  id?: string;
  instruction: string;
  onInstructionChange: (value: string) => void;
  onApply: () => void;
  isProcessing: boolean;
}

/**
 * Área de texto para ingresar una instrucción de edición y botón para aplicarla.
 * El botón queda deshabilitado mientras se procesa o si la instrucción está vacía.
 */
export default function InstructionInput({
  id,
  instruction,
  onInstructionChange,
  onApply,
  isProcessing,
}: InstructionInputProps) {
  const isDisabled = isProcessing || instruction.trim() === '';

  return (
    <div className="flex flex-col gap-3">
      <textarea
        id={id}
        value={instruction}
        onChange={(e) => onInstructionChange(e.target.value)}
        disabled={isProcessing}
        placeholder="Escribe una instrucción para modificar el menú…"
        rows={4}
        className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 shadow-sm placeholder:text-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:cursor-not-allowed disabled:bg-gray-100 resize-none"
        aria-label="Instrucción de edición"
      />
      <button
        type="button"
        onClick={onApply}
        disabled={isDisabled}
        className="inline-flex items-center justify-center gap-2 rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 transition-colors"
        aria-busy={isProcessing}
      >
        {isProcessing && <LoadingSpinner label="Procesando…" />}
        Aplicar cambio
      </button>
    </div>
  );
}
