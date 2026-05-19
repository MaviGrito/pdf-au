import type { HistoryEntry } from '../../types';

interface ChangeHistoryProps {
  history: HistoryEntry[];
}

/** Formatea un timestamp ISO 8601 a una cadena legible en español */
function formatTimestamp(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleString('es-ES', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Devuelve el nombre legible del modelo */
function formatModel(model: HistoryEntry['model']): string {
  return model === 'openai' ? 'GPT-4o' : 'Gemini';
}

/** Trunca la instrucción si supera el límite de caracteres */
function truncateInstruction(instruction: string, maxLength = 80): string {
  if (instruction.length <= maxLength) return instruction;
  return `${instruction.slice(0, maxLength)}…`;
}

export default function ChangeHistory({ history }: ChangeHistoryProps) {
  if (history.length === 0) {
    return (
      <div className="text-sm text-gray-500 italic py-4 text-center">
        Sin cambios registrados
      </div>
    );
  }

  // Mostrar el más reciente primero
  const sorted = [...history].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  return (
    <ol className="space-y-2">
      {sorted.map((entry) => (
        <li
          key={`${entry.versionNumber}-${entry.timestamp}`}
          className="flex flex-col gap-1 rounded-lg border border-gray-200 bg-white p-3 shadow-sm"
        >
          {/* Cabecera: versión + modelo + timestamp */}
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-indigo-600 bg-indigo-50 rounded px-2 py-0.5">
              v{entry.versionNumber}
            </span>
            <span className="text-xs text-gray-500 font-medium">
              {formatModel(entry.model)}
            </span>
            <span className="ml-auto text-xs text-gray-400">
              {formatTimestamp(entry.timestamp)}
            </span>
          </div>

          {/* Instrucción aplicada */}
          <p
            className="text-sm text-gray-700 leading-snug"
            title={entry.instruction}
          >
            {truncateInstruction(entry.instruction)}
          </p>
        </li>
      ))}
    </ol>
  );
}
