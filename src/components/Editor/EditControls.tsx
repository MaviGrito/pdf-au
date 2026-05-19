import { useState } from 'react';
import type { AIModel, HistoryEntry } from '../../types';
import ModelSelector from './ModelSelector';
import InstructionInput from './InstructionInput';
import ChangeHistory from './ChangeHistory';

interface EditControlsProps {
  pdfName: string;
  pdfDescription?: string;
  history: HistoryEntry[];
  isProcessing: boolean;
  onApply: (instruction: string, model: AIModel) => void;
}

/**
 * Panel de controles de edición: muestra el nombre/descripción del PDF,
 * permite seleccionar el modelo de IA, escribir una instrucción y ver el historial.
 */
export default function EditControls({
  pdfName,
  pdfDescription,
  history,
  isProcessing,
  onApply,
}: EditControlsProps) {
  const [selectedModel, setSelectedModel] = useState<AIModel>('openai');
  const [instruction, setInstruction] = useState('');

  function handleApply() {
    onApply(instruction, selectedModel);
    setInstruction('');
  }

  return (
    <div className="flex flex-col gap-6 h-full">
      {/* Información del PDF */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 leading-tight">{pdfName}</h2>
        {pdfDescription && (
          <p className="mt-1 text-sm text-gray-500">{pdfDescription}</p>
        )}
      </div>

      {/* Selector de modelo */}
      <div className="flex flex-col gap-1">
        <label htmlFor="model-selector" className="text-sm font-medium text-gray-700">Modelo de IA</label>
        <ModelSelector
          id="model-selector"
          selectedModel={selectedModel}
          onModelChange={setSelectedModel}
          disabled={isProcessing}
        />
      </div>

      {/* Instrucción y botón de aplicar */}
      <div className="flex flex-col gap-1">
        <label htmlFor="instruction-input" className="text-sm font-medium text-gray-700">Instrucción</label>
        <InstructionInput
          id="instruction-input"
          instruction={instruction}
          onInstructionChange={setInstruction}
          onApply={handleApply}
          isProcessing={isProcessing}
        />
      </div>

      {/* Historial de cambios */}
      <div className="flex flex-col gap-2 flex-1 min-h-0">
        <h3 className="text-sm font-medium text-gray-700">Historial de cambios</h3>
        <div className="overflow-y-auto flex-1">
          <ChangeHistory history={history} />
        </div>
      </div>
    </div>
  );
}
