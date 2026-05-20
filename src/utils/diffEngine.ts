import type { MenuContent, MenuSection, MenuItem, TextChange } from '../types/index.ts';

/**
 * Compara dos MenuContent y devuelve la lista de cambios de texto necesarios
 * para transformar `previous` en `updated`.
 * Función pura: sin efectos secundarios, sin I/O.
 */
export function diffMenuContent(
  previous: MenuContent,
  updated: MenuContent,
): TextChange[] {
  const changes: TextChange[] = [];

  if (previous.restaurantName !== updated.restaurantName) {
    changes.push({ oldText: previous.restaurantName, newText: updated.restaurantName });
  }

  const previousSectionsById = new Map<string, MenuSection>(
    previous.sections.map((s) => [s.id, s]),
  );
  const previousItemsById = new Map<string, MenuItem>();
  for (const section of previous.sections) {
    for (const item of section.items) {
      previousItemsById.set(item.id, item);
    }
  }

  const updatedItemIds = new Set<string>();

  for (const updatedSection of updated.sections) {
    let previousSection = previousSectionsById.get(updatedSection.id);
    if (!previousSection) {
      previousSection = previous.sections.find(s => s.title === updatedSection.title);
    }

    if (previousSection && previousSection.title !== updatedSection.title) {
      changes.push({ oldText: previousSection.title, newText: updatedSection.title });
    }

    for (const updatedItem of updatedSection.items) {
      updatedItemIds.add(updatedItem.id);

      let previousItem = previousItemsById.get(updatedItem.id);
      if (!previousItem) {
        const prevSection = previousSectionsById.get(updatedSection.id)
          ?? previous.sections.find(s => s.title === updatedSection.title);
        if (prevSection) {
          previousItem = prevSection.items.find(i => i.name === updatedItem.name);
          if (previousItem) updatedItemIds.add(previousItem.id);
        }
      }

      if (!previousItem) {
        changes.push({ oldText: null, newText: updatedItem.name });
      } else {
        if (previousItem.name !== updatedItem.name) {
          changes.push({ oldText: previousItem.name, newText: updatedItem.name });
        }
        const prevPrice = previousItem.price ?? null;
        const updPrice = updatedItem.price ?? null;
        if (prevPrice !== updPrice) {
          if (prevPrice !== null && updPrice !== null) {
            changes.push({ oldText: prevPrice, newText: updPrice });
          } else if (prevPrice !== null) {
            changes.push({ oldText: prevPrice, newText: null });
          } else if (updPrice !== null) {
            changes.push({ oldText: null, newText: updPrice });
          }
        }
        const prevDesc = previousItem.description ?? null;
        const updDesc = updatedItem.description ?? null;
        if (prevDesc !== updDesc) {
          if (prevDesc !== null && updDesc !== null) {
            changes.push({ oldText: prevDesc, newText: updDesc });
          } else if (prevDesc !== null) {
            changes.push({ oldText: prevDesc, newText: null });
          } else if (updDesc !== null) {
            changes.push({ oldText: null, newText: updDesc });
          }
        }
      }
    }
  }

  for (const [itemId, previousItem] of previousItemsById) {
    if (!updatedItemIds.has(itemId)) {
      changes.push({ oldText: previousItem.name, newText: null });
    }
  }

  return changes;
}
