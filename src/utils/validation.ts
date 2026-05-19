/**
 * Valida el formulario de carga de un PDF.
 *
 * Reglas:
 * - `name` no puede estar vacío ni contener solo espacios en blanco.
 * - `file` debe existir y tener extensión `.pdf` (insensible a mayúsculas).
 *
 * @returns `{ valid: true, errors: {} }` si todo es correcto,
 *          o `{ valid: false, errors: { ... } }` con los mensajes de error.
 */
export function validateUploadForm(
  name: string,
  file: File | null
): { valid: boolean; errors: Record<string, string> } {
  const errors: Record<string, string> = {};

  if (!name || name.trim() === '') {
    errors['name'] = 'El nombre es obligatorio';
  }

  if (!file) {
    errors['file'] = 'Debes seleccionar un archivo';
  } else if (!file.name.toLowerCase().endsWith('.pdf')) {
    errors['file'] = 'El archivo debe ser un PDF';
  }

  const valid = Object.keys(errors).length === 0;
  return { valid, errors };
}
