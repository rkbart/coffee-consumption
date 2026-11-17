import { sqlocalClient } from '../client';

/**
 * Every business table, in dependency order (children before parents).
 * Shop settings (e.g. currency) are intentionally left untouched.
 */
export const businessTables = [
  'closing_sales',
  'closing_lines',
  'closings',
  'product_packaging',
  'recipe_items',
  'products',
  'packaging_components',
  'packaging',
  'ingredients',
];

/** Delete every business record, keeping shop settings such as the currency. */
export async function resetBusinessData(): Promise<void> {
  for (const table of businessTables) {
    // Table names are identifiers, so concatenate rather than bind them.
    await sqlocalClient.sql('DELETE FROM ' + table);
  }
}
