import type { Version } from '../../types';

interface VersionSelectorProps {
  versions: Version[];
  selectedVersionId: string;
  onVersionChange: (versionId: string) => void;
}

/**
 * Selector de versiones del PDF actual.
 * Muestra cada versión con su número y fecha de creación en español.
 */
export default function VersionSelector({
  versions,
  selectedVersionId,
  onVersionChange,
}: VersionSelectorProps) {
  const formatDate = (isoDate: string): string => {
    return new Date(isoDate).toLocaleDateString('es-ES', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <select
      value={selectedVersionId}
      onChange={(e) => onVersionChange(e.target.value)}
      className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:cursor-not-allowed disabled:bg-gray-100"
      aria-label="Seleccionar versión"
      disabled={versions.length === 0}
    >
      {versions.length === 0 ? (
        <option value="">Sin versiones disponibles</option>
      ) : (
        versions.map((version) => (
          <option key={version.id} value={version.id}>
            Versión {version.versionNumber} — {formatDate(version.createdAt)}
          </option>
        ))
      )}
    </select>
  );
}
