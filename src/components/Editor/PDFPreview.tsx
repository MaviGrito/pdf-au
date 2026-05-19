import { useState } from 'react';
import { Document, Page } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import VersionSelector from './VersionSelector';
import { buildDownloadFilename } from '../../utils/pdfUtils';
import type { Version } from '../../types';

interface PDFPreviewProps {
  pdfBase64: string;
  pdfName: string;
  versions: Version[];
  selectedVersionId: string;
  onVersionChange: (versionId: string) => void;
  versionNumber: number;
}

/**
 * Panel izquierdo del Editor: muestra el PDF activo con react-pdf,
 * el selector de versiones y el botón de descarga.
 */
export default function PDFPreview({
  pdfBase64,
  pdfName,
  versions,
  selectedVersionId,
  onVersionChange,
  versionNumber,
}: PDFPreviewProps) {
  const [numPages, setNumPages] = useState<number>(0);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Convertir base64 a Uint8Array para react-pdf
  const pdfFile = { data: pdfBase64 };

  const handleLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
    setLoadError(null);
    setIsLoading(false);
  };

  const handleLoadError = (error: Error) => {
    console.error('[PDFPreview] Error al cargar el PDF:', error);
    setLoadError('No se pudo cargar el PDF. Verifica que el archivo sea válido.');
    setIsLoading(false);
  };

  const handleDownload = () => {
    const filename = buildDownloadFilename(pdfName, versionNumber);
    const link = document.createElement('a');
    link.href = `data:application/pdf;base64,${pdfBase64}`;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="flex flex-col h-full gap-3">
      {/* Controles superiores: selector de versión y botón de descarga */}
      <div className="flex items-center gap-2">
        <div className="flex-1">
          <VersionSelector
            versions={versions}
            selectedVersionId={selectedVersionId}
            onVersionChange={onVersionChange}
          />
        </div>
        <button
          onClick={handleDownload}
          disabled={!pdfBase64}
          className="flex items-center gap-1.5 rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 whitespace-nowrap"
          aria-label={`Descargar versión ${versionNumber} del PDF`}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
            />
          </svg>
          Descargar versión actual
        </button>
      </div>

      {/* Área de visualización del PDF */}
      <div className="flex-1 overflow-auto rounded-lg border border-gray-200 bg-gray-50">
        {loadError ? (
          <div
            role="alert"
            className="flex h-full items-center justify-center p-6 text-center"
          >
            <div className="rounded-md bg-red-50 p-4 text-sm text-red-700">
              <p className="font-medium">Error al cargar el PDF</p>
              <p className="mt-1">{loadError}</p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center py-4 px-2 gap-4">
            {isLoading && (
              <div
                role="status"
                aria-label="Cargando PDF"
                className="flex items-center gap-2 py-8 text-sm text-gray-500"
              >
                <svg
                  className="h-5 w-5 animate-spin text-indigo-600"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                  />
                </svg>
                Cargando PDF…
              </div>
            )}

            <Document
              file={pdfFile}
              onLoadSuccess={handleLoadSuccess}
              onLoadError={handleLoadError}
              loading={null}
              error={null}
            >
              {Array.from({ length: numPages }, (_, index) => (
                <div key={`page_${index + 1}`} className="mb-4 shadow-md">
                  <Page
                    pageNumber={index + 1}
                    renderTextLayer={true}
                    renderAnnotationLayer={true}
                    className="max-w-full"
                  />
                </div>
              ))}
            </Document>
          </div>
        )}
      </div>
    </div>
  );
}
