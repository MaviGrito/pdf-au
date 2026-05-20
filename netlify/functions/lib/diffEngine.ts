import type { MenuContent, MenuSection, MenuItem, TextChange } from '../../../src/types/index.ts';

/**
 * Compara dos MenuContent y devuelve la lista de cambios de texto necesarios
 * para transformar `previous` en `updated`.
 *
 * Es una función pura: sin efectos secundarios, sin I/O.
 *
 * Algoritmo:
 * 1. Compara restaurantName.
 * 2. Para cada sección en `updated`, busca la sección correspondiente en `previous` por id.
 *    - Si el título cambió → emite TextChange.
 *    - Para cada item en la sección:
 *      - Busca el item en `previous` por id.
 *      - Si name/price/description cambió → emite TextChange.
 *      - Si el item no existe en `previous` (nuevo) → emite { oldText: null, newText: item.name }.
 * 3. Para cada item en `previous` que no existe en `updated` (eliminado) → emite { oldText: item.name, newText: null }.
 * 4. Si no hay cambios → devuelve [].
 */
export function diffMenuContent(
  previous: MenuContent,
  updated: MenuContent,
): TextChange[] {
  const changes: TextChange[] = [];

  // 1. Comparar restaurantName
  if (previous.restaurantName !== updated.restaurantName) {
    changes.push({
      oldText: previous.restaurantName,
      newText: updated.restaurantName,
    });
  }

  // Construir mapa de secciones anteriores por id para búsqueda O(1)
  const previousSectionsById = new Map<string, MenuSection>(
    previous.sections.map((s) => [s.id, s]),
  );

  // Construir mapa de todos los items anteriores por id (a través de todas las secciones)
  const previousItemsById = new Map<string, MenuItem>();
  for (const section of previous.sections) {
    for (const item of section.items) {
      previousItemsById.set(item.id, item);
    }
  }

  // Conjunto de ids de items presentes en `updated` (para detectar eliminaciones)
  const updatedItemIds = new Set<string>();

  // 2. Iterar secciones en `updated`
  for (const updatedSection of updated.sections) {
    const previousSection = previousSectionsById.get(updatedSection.id);

    // Comparar título de sección
    if (previousSection && previousSection.title !== updatedSection.title) {
      changes.push({
        oldText: previousSection.title,
        newText: updatedSection.title,
      });
    }

    // Iterar items en la sección actualizada
    for (const updatedItem of updatedSection.items) {
      updatedItemIds.add(updatedItem.id);

      const previousItem = previousItemsById.get(updatedItem.id);

      if (!previousItem) {
        // Item nuevo (adición)
        changes.push({
          oldText: null,
          newText: updatedItem.name,
        });
      } else {
        // Comparar name
        if (previousItem.name !== updatedItem.name) {
          changes.push({
            oldText: previousItem.name,
            newText: updatedItem.name,
          });
        }

        // Comparar price (solo si al menos uno de los dos tiene precio)
        const prevPrice = previousItem.price ?? null;
        const updPrice = updatedItem.price ?? null;
        if (prevPrice !== updPrice && (prevPrice !== null || updPrice !== null)) {
          // Solo emitir si ambos son strings (cambio de valor)
          // Si uno es null y el otro no, es un cambio de precio que sí se emite
          if (prevPrice !== null && updPrice !== null) {
            changes.push({
              oldText: prevPrice,
              newText: updPrice,
            });
          } else if (prevPrice !== null && updPrice === null) {
            // Precio eliminado
            changes.push({
              oldText: prevPrice,
              newText: null,
            });
          } else if (prevPrice === null && updPrice !== null) {
            // Precio añadido
            changes.push({
              oldText: null,
              newText: updPrice,
            });
          }
        }

        // Comparar description (solo si al menos uno de los dos tiene descripción)
        const prevDesc = previousItem.description ?? null;
        const updDesc = updatedItem.description ?? null;
        if (prevDesc !== updDesc && (prevDesc !== null || updDesc !== null)) {
          if (prevDesc !== null && updDesc !== null) {
            changes.push({
              oldText: prevDesc,
              newText: updDesc,
            });
          } else if (prevDesc !== null && updDesc === null) {
            // Descripción eliminada
            changes.push({
              oldText: prevDesc,
              newText: null,
            });
          } else if (prevDesc === null && updDesc !== null) {
            // Descripción añadida
            changes.push({
              oldText: null,
              newText: updDesc,
            });
          }
        }
      }
    }
  }

  // 3. Detectar items eliminados (presentes en `previous` pero no en `updated`)
  for (const [itemId, previousItem] of previousItemsById) {
    if (!updatedItemIds.has(itemId)) {
      changes.push({
        oldText: previousItem.name,
        newText: null,
      });
    }
  }

  return changes;
}
