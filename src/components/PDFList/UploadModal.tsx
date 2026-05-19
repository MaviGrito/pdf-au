import { useState, useRef, useEffect } from 'react';
import { validateUploadForm } from '../../utils/validation';
import { LoadingSpinner } from '../shared/LoadingSpinner';

interface UploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUpload: (name: string, description: string, file: File) => Promise<void>;
}

interface FormErrors {
  name?: string;
  file?: string;
}

export default function UploadModal({ isOpen, onClose, onUpload }: UploadModalProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [errors, setErrors] = useState<FormErrors>({});
  const [isLoading, setIsLoading] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Resetear formulario al cerrar
  useEffect(() => {
    if (!isOpen) {
      setName('');
      setDescription('');
      setFile(null);
      setErrors({});
      setIsLoading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0] ?? null;
    setFile(selected);
    // Limpiar error de archivo al seleccionar uno nuevo
    if (errors.file) {
      setErrors((prev) => ({ ...prev, file: undefined }));
    }
  };

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setName(e.target.value);
    // Limpiar error de nombre al escribir
    if (errors.name) {
      setErrors((prev) => ({ ...prev, name: undefined }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const { valid, errors: validationErrors } = validateUploadForm(name, file);

    if (!valid) {
      setErrors(validationErrors);
      return;
    }

    setIsLoading(true);
    try {
      await onUpload(name.trim(), description.trim(), file!);
      onClose();
    } catch {
      // El error se gestiona en el componente padre; aquí solo detenemos el spinner
    } finally {
      setIsLoading(false);
    }
  };

  const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget && !isLoading) {
      onClose();
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="upload-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={handleOverlayClick}
    >
      <div className="w-full max-w-md rounded-2xl bg-white shadow-xl">
        {/* Cabecera */}
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <h2 id="upload-modal-title" className="text-lg font-semibold text-gray-900">
            Subir nuevo PDF
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            aria-label="Cerrar modal"
            className="rounded-lg p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5"
              viewBox="0 0 20 20"
              fill="currentColor"
              aria-hidden="true"
            >
              <path
                fillRule="evenodd"
                d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        </div>

        {/* Formulario */}
        <form onSubmit={handleSubmit} noValidate>
          <div className="space-y-5 px-6 py-5">
            {/* Campo: Nombre */}
            <div>
              <label
                htmlFor="pdf-name"
                className="mb-1 block text-sm font-medium text-gray-700"
              >
                Nombre <span className="text-red-500" aria-hidden="true">*</span>
              </label>
              <input
                id="pdf-name"
                type="text"
                value={name}
                onChange={handleNameChange}
                disabled={isLoading}
                placeholder="Ej. Carta de verano 2024"
                aria-required="true"
                aria-describedby={errors.name ? 'pdf-name-error' : undefined}
                aria-invalid={!!errors.name}
                className={`w-full rounded-lg border px-3 py-2 text-sm text-gray-900 placeholder-gray-400 transition-colors focus:outline-none focus:ring-2 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:opacity-60 ${
                  errors.name
                    ? 'border-red-400 focus:ring-red-300'
                    : 'border-gray-300 focus:ring-blue-300'
                }`}
              />
              {errors.name && (
                <p id="pdf-name-error" role="alert" className="mt-1 text-xs text-red-600">
                  {errors.name}
                </p>
              )}
            </div>

            {/* Campo: Descripción */}
            <div>
              <label
                htmlFor="pdf-description"
                className="mb-1 block text-sm font-medium text-gray-700"
              >
                Descripción{' '}
                <span className="text-xs font-normal text-gray-400">(opcional)</span>
              </label>
              <textarea
                id="pdf-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={isLoading}
                placeholder="Ej. Menú de temporada con platos de verano"
                rows={3}
                className="w-full resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-300 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:opacity-60"
              />
            </div>

            {/* Campo: Archivo PDF */}
            <div>
              <label
                htmlFor="pdf-file"
                className="mb-1 block text-sm font-medium text-gray-700"
              >
                Archivo PDF <span className="text-red-500" aria-hidden="true">*</span>
              </label>
              <input
                id="pdf-file"
                ref={fileInputRef}
                type="file"
                accept=".pdf"
                onChange={handleFileChange}
                disabled={isLoading}
                aria-required="true"
                aria-describedby={errors.file ? 'pdf-file-error' : undefined}
                aria-invalid={!!errors.file}
                className={`w-full cursor-pointer rounded-lg border px-3 py-2 text-sm text-gray-700 transition-colors file:mr-3 file:cursor-pointer file:rounded-md file:border-0 file:bg-blue-50 file:px-3 file:py-1 file:text-xs file:font-medium file:text-blue-700 hover:file:bg-blue-100 focus:outline-none focus:ring-2 disabled:cursor-not-allowed disabled:opacity-60 ${
                  errors.file
                    ? 'border-red-400 focus:ring-red-300'
                    : 'border-gray-300 focus:ring-blue-300'
                }`}
              />
              {errors.file && (
                <p id="pdf-file-error" role="alert" className="mt-1 text-xs text-red-600">
                  {errors.file}
                </p>
              )}
            </div>
          </div>

          {/* Pie del modal */}
          <div className="flex items-center justify-end gap-3 border-t border-gray-200 px-6 py-4">
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="flex min-w-[110px] items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isLoading ? (
                <>
                  <LoadingSpinner label="Subiendo PDF..." />
                  <span>Subiendo…</span>
                </>
              ) : (
                'Subir PDF'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
