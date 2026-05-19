import { useState } from 'react';
import { useAppContext } from '../../context/AppContext';
import { filterPDFs } from '../../utils/pdfUtils';
import type { PDFDocument } from '../../types';
import PDFCard from './PDFCard';
import UploadModal from './UploadModal';

export default function PDFList() {
  const { state, dispatch } = useAppContext();
  const [isModalOpen, setIsModalOpen] = useState(false);

  const filteredPDFs = filterPDFs(state.pdfs, state.searchQuery);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    dispatch({ type: 'SET_SEARCH_QUERY', payload: e.target.value });
  };

  const handleUpload = async (name: string, description: string, file: File): Promise<void> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = () => {
        try {
          const result = reader.result as string;
          // El resultado de readAsDataURL tiene el formato "data:application/pdf;base64,<base64>"
          const base64 = result.split(',')[1];

          const newPDF: PDFDocument = {
            id: crypto.randomUUID(),
            name,
            description: description || undefined,
            originalPdfBase64: base64,
            extractedContent: null,
            versions: [],
            history: [],
            lastModified: new Date().toISOString(),
          };

          dispatch({ type: 'ADD_PDF', payload: newPDF });
          resolve();
        } catch (err) {
          reject(err);
        }
      };

      reader.onerror = () => {
        reject(new Error('Error al leer el archivo PDF.'));
      };

      reader.readAsDataURL(file);
    });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Encabezado */}
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-2xl font-bold text-gray-900">Mis menús</h1>
          <button
            type="button"
            onClick={() => setIsModalOpen(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-4 w-4"
              viewBox="0 0 20 20"
              fill="currentColor"
              aria-hidden="true"
            >
              <path
                fillRule="evenodd"
                d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z"
                clipRule="evenodd"
              />
            </svg>
            Subir nuevo PDF
          </button>
        </div>

        {/* Campo de búsqueda */}
        <div className="mb-6">
          <label htmlFor="search-pdfs" className="sr-only">
            Buscar menús
          </label>
          <div className="relative">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-4 w-4 text-gray-400"
                viewBox="0 0 20 20"
                fill="currentColor"
                aria-hidden="true"
              >
                <path
                  fillRule="evenodd"
                  d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <input
              id="search-pdfs"
              type="search"
              value={state.searchQuery}
              onChange={handleSearchChange}
              placeholder="Buscar por nombre…"
              className="w-full rounded-lg border border-gray-300 bg-white py-2 pl-10 pr-4 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-300 sm:max-w-xs"
            />
          </div>
        </div>

        {/* Grilla de PDFs o estado vacío */}
        {filteredPDFs.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-300 bg-white py-16 text-center">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="mb-4 h-12 w-12 text-gray-300"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            <p className="text-sm text-gray-500">
              {state.searchQuery
                ? 'No se encontraron menús con ese nombre.'
                : 'No hay menús todavía. Sube tu primer PDF.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredPDFs.map((pdf) => (
              <PDFCard key={pdf.id} pdf={pdf} />
            ))}
          </div>
        )}
      </div>

      {/* Modal de carga */}
      <UploadModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onUpload={handleUpload}
      />
    </div>
  );
}
