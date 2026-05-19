import type { AIModel } from '../../types';

interface ModelSelectorProps {
  selectedModel: AIModel;
  onModelChange: (model: AIModel) => void;
  disabled?: boolean;
}

const MODEL_OPTIONS: { value: AIModel; label: string }[] = [
  { value: 'openai', label: 'OpenAI GPT-4o' },
  { value: 'gemini', label: 'Google Gemini' },
];

/**
 * Selector del modelo de IA a utilizar para aplicar instrucciones.
 */
export default function ModelSelector({
  selectedModel,
  onModelChange,
  disabled = false,
}: ModelSelectorProps) {
  return (
    <select
      value={selectedModel}
      onChange={(e) => onModelChange(e.target.value as AIModel)}
      disabled={disabled}
      className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:cursor-not-allowed disabled:bg-gray-100"
      aria-label="Seleccionar modelo de IA"
    >
      {MODEL_OPTIONS.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}
