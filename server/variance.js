/**
 * Pure variance math shared by the API and the seed script.
 *
 * theoretical usage = sum((batch recipe quantity / yield) x units sold)
 * actual usage      = opening + deliveries - waste - closing
 * variance          = actual - theoretical
 *
 * A positive variance means more stock left the shelf than the recipes and
 * recorded sales can explain (over-pouring, unrecorded sales, spillage).
 * A negative variance means less was used than expected (over-counted pour,
 * mis-keyed sales, or a miscount at opening/closing).
 */

export const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

export function computeUsage({ ingredients, products, sales, counts }) {
  const soldByProduct = new Map(
    sales.map((s) => [Number(s.product_id), Number(s.quantity) || 0]),
  );

  const theoretical = new Map(ingredients.map((i) => [i.id, 0]));
  for (const product of products) {
    const qty = soldByProduct.get(product.id) || 0;
    if (!qty) continue;
    const portions = product.yield_qty > 0 ? product.yield_qty : 1;
    for (const line of product.recipe) {
      theoretical.set(
        line.ingredient_id,
        (theoretical.get(line.ingredient_id) || 0) + (line.qty / portions) * qty,
      );
    }
  }

  const countByIngredient = new Map(
    counts.map((c) => [Number(c.ingredient_id), c]),
  );

  return ingredients.map((ingredient) => {
    const count = countByIngredient.get(ingredient.id) || {};
    const opening = Number(count.opening) || 0;
    const deliveries = Number(count.deliveries) || 0;
    const waste = Number(count.waste) || 0;
    const closing = Number(count.closing) || 0;

    const theoreticalUsage = round2(theoretical.get(ingredient.id) || 0);
    const actualUsage = round2(opening + deliveries - waste - closing);

    return {
      ingredient_id: ingredient.id,
      name: ingredient.name,
      unit: ingredient.unit,
      opening: round2(opening),
      deliveries: round2(deliveries),
      waste: round2(waste),
      closing: round2(closing),
      actual_usage: actualUsage,
      theoretical_usage: theoreticalUsage,
      variance: round2(actualUsage - theoreticalUsage),
    };
  });
}

export function variancePercent(line) {
  if (!line.theoretical_usage) return null;
  return round2((line.variance / line.theoretical_usage) * 100);
}
