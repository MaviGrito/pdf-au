/**
 * Tests unitarios para UploadModal
 *
 * Verifica:
 * - El modal muestra errores de validación cuando se envía sin nombre
 * - El modal muestra errores de validación cuando se envía sin archivo PDF
 * - El modal muestra errores cuando el archivo no es PDF
 *
 * Requisitos: 2.6, 2.7
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import UploadModal from './UploadModal';

// --------------- Helpers ---------------

function renderModal(isOpen = true) {
  const onClose = vi.fn();
  const onUpload = vi.fn().mockResolvedValue(undefined);

  render(
    <UploadModal isOpen={isOpen} onClose={onClose} onUpload={onUpload} />,
  );

  return { onClose, onUpload };
}

function makePDFFile(name = 'menu.pdf'): File {
  return new File(['%PDF-1.4 fake content'], name, { type: 'application/pdf' });
}

function makeNonPDFFile(name = 'menu.txt'): File {
  return new File(['plain text'], name, { type: 'text/plain' });
}

// --------------- Tests ---------------

describe('UploadModal — visibilidad', () => {
  it('no renderiza nada cuando isOpen es false', () => {
    renderModal(false);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('renderiza el modal cuando isOpen es true', () => {
    renderModal(true);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Subir nuevo PDF')).toBeInTheDocument();
  });
});

describe('UploadModal — errores de validación al enviar', () => {
  it('muestra error de nombre cuando se envía el formulario sin nombre', async () => {
    renderModal();

    // Enviar sin rellenar nada
    fireEvent.click(screen.getByRole('button', { name: /subir pdf/i }));

    await waitFor(() => {
      expect(screen.getByText('El nombre es obligatorio')).toBeInTheDocument();
    });
  });

  it('muestra error de archivo cuando se envía el formulario sin archivo', async () => {
    renderModal();

    // Rellenar solo el nombre
    fireEvent.change(screen.getByLabelText(/nombre/i), {
      target: { value: 'Carta de verano' },
    });

    fireEvent.click(screen.getByRole('button', { name: /subir pdf/i }));

    await waitFor(() => {
      expect(screen.getByText('Debes seleccionar un archivo')).toBeInTheDocument();
    });
  });

  it('muestra ambos errores cuando se envía completamente vacío', async () => {
    renderModal();

    fireEvent.click(screen.getByRole('button', { name: /subir pdf/i }));

    await waitFor(() => {
      expect(screen.getByText('El nombre es obligatorio')).toBeInTheDocument();
      expect(screen.getByText('Debes seleccionar un archivo')).toBeInTheDocument();
    });
  });

  it('muestra error de archivo cuando el archivo no tiene extensión .pdf', async () => {
    renderModal();

    fireEvent.change(screen.getByLabelText(/nombre/i), {
      target: { value: 'Carta de verano' },
    });

    const fileInput = screen.getByLabelText(/archivo pdf/i);
    fireEvent.change(fileInput, {
      target: { files: [makeNonPDFFile()] },
    });

    fireEvent.click(screen.getByRole('button', { name: /subir pdf/i }));

    await waitFor(() => {
      expect(screen.getByText('El archivo debe ser un PDF')).toBeInTheDocument();
    });
  });

  it('los errores tienen role="alert" para accesibilidad', async () => {
    renderModal();

    fireEvent.click(screen.getByRole('button', { name: /subir pdf/i }));

    await waitFor(() => {
      const alerts = screen.getAllByRole('alert');
      expect(alerts.length).toBeGreaterThanOrEqual(2);
    });
  });
});

describe('UploadModal — envío exitoso', () => {
  it('llama a onUpload con nombre, descripción y archivo cuando el formulario es válido', async () => {
    const { onUpload } = renderModal();

    fireEvent.change(screen.getByLabelText(/nombre/i), {
      target: { value: 'Carta de verano' },
    });

    const fileInput = screen.getByLabelText(/archivo pdf/i);
    const pdfFile = makePDFFile();
    fireEvent.change(fileInput, {
      target: { files: [pdfFile] },
    });

    fireEvent.click(screen.getByRole('button', { name: /subir pdf/i }));

    await waitFor(() => {
      expect(onUpload).toHaveBeenCalledWith('Carta de verano', '', pdfFile);
    });
  });

  it('llama a onClose después de un upload exitoso', async () => {
    const { onClose } = renderModal();

    fireEvent.change(screen.getByLabelText(/nombre/i), {
      target: { value: 'Carta de verano' },
    });

    const fileInput = screen.getByLabelText(/archivo pdf/i);
    fireEvent.change(fileInput, {
      target: { files: [makePDFFile()] },
    });

    fireEvent.click(screen.getByRole('button', { name: /subir pdf/i }));

    await waitFor(() => {
      expect(onClose).toHaveBeenCalled();
    });
  });

  it('no muestra errores cuando el formulario es válido', async () => {
    renderModal();

    fireEvent.change(screen.getByLabelText(/nombre/i), {
      target: { value: 'Carta de verano' },
    });

    const fileInput = screen.getByLabelText(/archivo pdf/i);
    fireEvent.change(fileInput, {
      target: { files: [makePDFFile()] },
    });

    fireEvent.click(screen.getByRole('button', { name: /subir pdf/i }));

    // No deben aparecer mensajes de error
    expect(screen.queryByText('El nombre es obligatorio')).not.toBeInTheDocument();
    expect(screen.queryByText('Debes seleccionar un archivo')).not.toBeInTheDocument();
  });
});

describe('UploadModal — limpieza de errores al editar', () => {
  it('limpia el error de nombre al escribir en el campo', async () => {
    renderModal();

    // Provocar error
    fireEvent.click(screen.getByRole('button', { name: /subir pdf/i }));

    await waitFor(() => {
      expect(screen.getByText('El nombre es obligatorio')).toBeInTheDocument();
    });

    // Escribir en el campo de nombre
    fireEvent.change(screen.getByLabelText(/nombre/i), {
      target: { value: 'Carta' },
    });

    expect(screen.queryByText('El nombre es obligatorio')).not.toBeInTheDocument();
  });

  it('limpia el error de archivo al seleccionar un nuevo archivo', async () => {
    renderModal();

    // Provocar error
    fireEvent.click(screen.getByRole('button', { name: /subir pdf/i }));

    await waitFor(() => {
      expect(screen.getByText('Debes seleccionar un archivo')).toBeInTheDocument();
    });

    // Seleccionar un archivo
    const fileInput = screen.getByLabelText(/archivo pdf/i);
    fireEvent.change(fileInput, {
      target: { files: [makePDFFile()] },
    });

    expect(screen.queryByText('Debes seleccionar un archivo')).not.toBeInTheDocument();
  });
});
