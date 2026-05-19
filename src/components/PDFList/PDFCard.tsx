import { useNavigate } from 'react-router-dom';
import type { PDFDocument } from '../../types';

interface PDFCardProps {
  pdf: PDFDocument;
}

export default function PDFCard({ pdf }: PDFCardProps) {
  const navigate = useNavigate();

  const formattedDate = new Date(pdf.lastModified).toLocaleDateString('es-ES', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => navigate(`/editor/${pdf.id}`)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          navigate(`/editor/${pdf.id}`);
        }
      }}
      className="cursor-pointer rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md focus:outline-none focus:ring-2 focus:ring-blue-500"
    >
      <h3 className="text-lg font-semibold text-gray-900 truncate">{pdf.name}</h3>

      {pdf.description && (
        <p className="mt-1 text-sm text-gray-500 line-clamp-2">{pdf.description}</p>
      )}

      <p className="mt-3 text-xs text-gray-400">
        Última modificación: <span className="font-medium text-gray-500">{formattedDate}</span>
      </p>
    </div>
  );
}
