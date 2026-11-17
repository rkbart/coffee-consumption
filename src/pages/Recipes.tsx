import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import PageHeader from "../components/PageHeader";
import Modal from "../components/Modal";
import Pagination from "../components/Pagination";
import SearchField from "../components/SearchField";
import { useDebouncedValue } from "../hooks";
import { api, type ProductInput } from "../api";
import type { Ingredient, PackagingMaterial, Product, Unit } from "../types";
import {
  fmt,
  money,
  recipeCost,
  unitLabel,
  unitMoney,
  type RecipeCost,
} from "../lib";
import { IconEdit, IconPlus, IconTrash } from "../components/Icons";

interface IngredientDraftLine {
  ingredient_id: number | "";
  qty: string;
}

interface PackagingDraftLine {
  packaging_id: number | "";
  qty: string;
}

const pct = (value: number) => fmt(value, value % 1 ? 1 : 0);

const PRODUCTS_PER_PAGE = 6;

const matchesQuery = (query: string, values: (string | number | null | undefined)[]) =>
  !query || values.some((value) => String(value ?? "").toLowerCase().includes(query));

export default function Recipes() {
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [packaging, setPackaging] = useState<PackagingMaterial[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 250);
  const [menuGroup, setMenuGroup] = useState("all");
  const [page, setPage] = useState(1);

  const [editing, setEditing] = useState<Product | "new" | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Product | null>(null);
  const [toast, setToast] = useState("");

  const load = async () => {
    try {
      const [nextIngredients, nextPackaging, nextProducts] = await Promise.all([
        api.ingredients(),
        api.packaging(),
        api.products(),
      ]);
      setIngredients(nextIngredients);
      setPackaging(nextPackaging);
      setProducts(nextProducts);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load recipes");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 2600);
    return () => clearTimeout(timer);
  }, [toast]);

  const query = debouncedSearch.trim().toLowerCase();
  const menuGroups = useMemo(
    () => [...new Set(products.map((product) => product.category))].sort(),
    [products],
  );

  const filteredProducts = useMemo(
    () =>
      products.filter(
        (product) =>
          (menuGroup === "all" || product.category === menuGroup) &&
          matchesQuery(query, [
            product.name,
            product.category,
            product.size_label,
            ...product.recipe.map((line) => line.ingredient_name),
            ...product.packaging.map((line) => line.packaging_name),
          ]),
      ),
    [products, query, menuGroup],
  );

  useEffect(() => {
    setPage(1);
  }, [query, menuGroup]);

  const pageCount = Math.max(1, Math.ceil(filteredProducts.length / PRODUCTS_PER_PAGE));
  const safePage = Math.min(page, pageCount);
  const pagedProducts = filteredProducts.slice(
    (safePage - 1) * PRODUCTS_PER_PAGE,
    safePage * PRODUCTS_PER_PAGE,
  );
  const productGroups = pagedProducts.reduce<Record<string, Product[]>>((acc, product) => {
    (acc[product.category] ||= []).push(product);
    return acc;
  }, {});

  const removeProduct = async (product: Product) => {
    try {
      await api.deleteProduct(product.id);
      setPendingDelete(null);
      setToast(`${product.name} removed from the menu`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete beverage");
    }
  };

  const summary = query
    ? `${filteredProducts.length} result${filteredProducts.length === 1 ? "" : "s"} for “${debouncedSearch.trim()}”`
    : menuGroup === "all"
      ? `${products.length} beverages · ${menuGroups.length} menu groups`
      : `${filteredProducts.length} in ${menuGroup}`;

  return (
    <>
      <PageHeader
        eyebrow="The menu"
        title="Recipes"
        description="Cost each drink from the ingredients and bases in the costing library plus its packaging. Change a purchase price once and every card updates."
        actions={
          <button
            className="bg-ink text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-accent-dark transition-colors focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2"
            onClick={() => setEditing("new")}
          >
            <IconPlus size={17} className="mr-1.5" /> New beverage
          </button>
        }
      />

      {error && (
        <div className="bg-red-soft border border-red rounded-lg p-3 text-red text-sm">
          {error}
        </div>
      )}

      <div className="mb-4 flex min-w-0 flex-col gap-3 sm:grid sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center lg:flex lg:flex-row lg:items-start lg:justify-between lg:gap-4">
        <div className="flex-1 min-w-0">
          <SearchField
            value={search}
            onChange={setSearch}
            placeholder="Search drinks, menu groups, ingredients…"
            label="Search recipes"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2 text-sm font-medium text-ink-soft">
            <span>Menu group</span>
            <select
              value={menuGroup}
              onChange={(event) => setMenuGroup(event.target.value)}
              className="bg-surface border border-line rounded-lg px-2 py-1.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-1"
            >
              <option value="all">All menu groups</option>
              {menuGroups.map((group) => (
                <option key={group} value={group}>
                  {group}
                </option>
              ))}
            </select>
          </label>
        </div>
        <p className="min-w-0 text-sm leading-relaxed text-muted sm:col-span-2 lg:flex-1">
          {summary}
        </p>
      </div>

      <section className="space-y-4">
        {loading ? (
          <div className="h-48 bg-surface-2 border border-line rounded-lg animate-pulse" />
        ) : filteredProducts.length === 0 ? (
          <div className="text-center py-8">
            <h2 className="text-xl font-serif font-medium text-ink mb-2">
              {query || menuGroup !== "all" ? "No drinks match" : "No beverages yet"}
            </h2>
            <p className="text-sm text-muted mb-4">
              {query
                ? `Nothing on the menu matches “${debouncedSearch.trim()}”. Try a different word or clear the search.`
                : menuGroup !== "all"
                  ? `No beverages are in ${menuGroup} yet.`
                  : "Add your first drink with its ingredients and packaging."}
            </p>
            {query || menuGroup !== "all" ? (
              <button
                className="bg-surface border border-line rounded-lg px-4 py-2 text-sm font-medium text-ink-soft hover:bg-surface-2 hover:text-ink transition-colors focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-1"
                onClick={() => {
                  setSearch("");
                  setMenuGroup("all");
                }}
              >
                Clear filters
              </button>
            ) : (
              <button
                className="bg-ink text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-accent-dark transition-colors focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2"
                onClick={() => setEditing("new")}
              >
                <IconPlus size={17} className="mr-1.5" /> Add a beverage
              </button>
            )}
          </div>
        ) : (
          <>
            {Object.entries(productGroups).map(([category, items]) => (
              <div key={category} className="mb-6">
                <div className="flex items-center justify-between gap-2 mb-3">
                  <h2 className="text-lg font-serif font-medium text-ink">{category}</h2>
                  <span className="px-2 py-0.5 bg-surface-2 text-ink-soft rounded text-xs font-medium">
                    {items.length}
                  </span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {items.map((product) => (
                    <RecipeCard
                      key={product.id}
                      product={product}
                      ingredients={ingredients}
                      packagingMaterials={packaging}
                      onEdit={() => setEditing(product)}
                      onDelete={() => setPendingDelete(product)}
                    />
                  ))}
                </div>
              </div>
            ))}
            <Pagination
              page={safePage}
              pageCount={pageCount}
              total={filteredProducts.length}
              pageSize={PRODUCTS_PER_PAGE}
              onPageChange={setPage}
              label="beverages"
            />
          </>
        )}
      </section>

      <BeverageModal
        editing={editing}
        ingredients={ingredients}
        packagingMaterials={packaging}
        onClose={() => setEditing(null)}
        onSaved={async (message) => {
          setEditing(null);
          setToast(message);
          await load();
        }}
      />

      <Modal
        open={Boolean(pendingDelete)}
        title="Remove beverage?"
        subtitle="Past closings keep their snapshot, so history is not affected."
        onClose={() => setPendingDelete(null)}
      >
        <p className="text-sm leading-relaxed">
          <strong className="text-ink">{pendingDelete?.name}</strong>{" "}
          {pendingDelete?.size_label ? `· ${pendingDelete.size_label}` : ""} will be
          removed from the menu and from future counts.
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <button
            className="bg-surface border border-line rounded-lg px-4 py-2 text-sm font-medium text-ink-soft hover:bg-surface-2 hover:text-ink transition-colors focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-1"
            onClick={() => setPendingDelete(null)}
          >
            Keep it
          </button>
          <button
            className="bg-red text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-red-dark transition-colors focus:outline-none focus:ring-2 focus:ring-red focus:ring-offset-2"
            onClick={() => pendingDelete && removeProduct(pendingDelete)}
          >
            Remove beverage
          </button>
        </div>
      </Modal>

      {toast && (
        <div className="mt-4 bg-accent-soft text-accent-dark rounded-lg px-3 py-2 text-sm font-medium">
          {toast}
        </div>
      )}
    </>
  );
}

/* ---------------------------------------------------------------- recipe card */

function RecipeCard({
  product,
  ingredients,
  packagingMaterials,
  onEdit,
  onDelete,
}: {
  product: Product;
  ingredients: Ingredient[];
  packagingMaterials: PackagingMaterial[];
  onEdit: () => void;
  onDelete: () => void;
}) {
  const cost = recipeCost(product, ingredients, packagingMaterials);
  const fc = cost.actualFoodCostPct;
  const onTarget = fc !== null && fc <= cost.targetPct;

  return (
    <article className="bg-surface border border-line rounded-lg p-4 hover:border-line-strong transition-colors">
      <div className="mb-3 flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-serif font-medium text-ink-soft uppercase tracking-wider">{product.category}</p>
          <h3 className="text-lg font-serif font-medium text-ink">{product.name}</h3>
          <span className="text-xs text-muted">
            {product.size_label ? `${product.size_label} · ` : ""}
            Yield {fmt(cost.yieldQty, cost.yieldQty % 1 ? 1 : 0)}
          </span>
        </div>
        <div className="flex gap-1">
          <button
            type="button"
            className="p-1.5 hover:bg-surface-2 rounded-sm text-muted hover:text-accent focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-1"
            aria-label={`Edit ${product.name}`}
            onClick={onEdit}
          >
            <IconEdit size={16} />
          </button>
          <button
            type="button"
            className="p-1.5 hover:bg-red-soft rounded-sm text-muted hover:text-red focus:outline-none focus:ring-2 focus:ring-red focus:ring-offset-1"
            aria-label={`Delete ${product.name}`}
            onClick={onDelete}
          >
            <IconTrash size={16} />
          </button>
        </div>
      </div>

      <div className="mb-3 overflow-x-auto">
        <table className="w-full min-w-[430px] border-collapse text-sm">
          <thead>
            <tr className="text-left">
              <th className="pb-1 font-medium text-ink-soft text-[10px] uppercase tracking-wider">Ingredient</th>
              <th className="pb-1 font-medium text-ink-soft text-[10px] uppercase tracking-wider text-right">Qty</th>
              <th className="pb-1 font-medium text-ink-soft text-[10px] uppercase tracking-wider text-right">Unit</th>
              <th className="pb-1 font-medium text-ink-soft text-[10px] uppercase tracking-wider text-right">Cost</th>
            </tr>
          </thead>
          <tbody>
            {cost.lines.length === 0 && (
              <tr>
                <td colSpan={4} className="pt-2 pb-2 text-muted text-sm">
                  No ingredients on this recipe yet.
                </td>
              </tr>
            )}
            {cost.lines.map((line) => {
              const ingredient = line.ingredient;
              return (
                <tr key={line.item.id} className="border-b border-line/50">
                  <td className="pb-1">
                    <span className="font-medium text-ink block">{line.item.ingredient_name}</span>
                    <span className="text-xs text-muted block">
                      {ingredient && ingredient.pack_price > 0
                        ? `${money(ingredient.pack_price)} / ${fmt(ingredient.pack_size)} ${unitLabel(ingredient.unit)}${ingredient.waste_pct ? ` · ${pct(ingredient.waste_pct)}% waste` : ""}`
                        : "No purchase price"}
                    </span>
                  </td>
                  <td className="pb-1 text-right">
                    {fmt(line.item.qty, line.item.qty % 1 ? 1 : 0)} <span className="text-xs text-muted"> {unitLabel(line.item.unit)}</span>
                  </td>
                  <td className="pb-1 text-right">
                    {line.missingCost ? "—" : unitMoney(line.unitCost)}
                  </td>
                  <td className="pb-1 text-right font-medium text-accent-dark">
                    {line.missingCost ? "—" : money(line.lineCost)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="bg-surface-2 border border-line rounded-lg p-3 mb-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-ink-soft uppercase tracking-wider">Packaging</span>
          <span className="text-xs font-medium text-accent-dark">{money(cost.packaging)}</span>
        </div>
        {cost.packagingLines.length === 0 ? (
          <p className="text-xs text-muted">
            No packaging selected. Edit this drink to add a cup, lid, straw or bag.
          </p>
        ) : (
          <div className="overflow-x-auto">
          <table className="w-full min-w-[380px] border-collapse text-sm">
            <thead>
              <tr className="text-left">
                <th className="pb-1 font-medium text-ink-soft text-[10px] uppercase tracking-wider">Material</th>
                <th className="pb-1 font-medium text-ink-soft text-[10px] uppercase tracking-wider text-right">Qty</th>
                <th className="pb-1 font-medium text-ink-soft text-[10px] uppercase tracking-wider text-right">Unit</th>
                <th className="pb-1 font-medium text-ink-soft text-[10px] uppercase tracking-wider text-right">Cost</th>
              </tr>
            </thead>
            <tbody>
              {cost.packagingLines.map((line) => (
                <tr key={line.line.id} className="border-b border-line/50">
                  <td className="pb-1">
                    <span className="font-medium text-ink block">{line.line.packaging_name}</span>
                    <span className="text-xs text-muted block">
                      {line.material
                        ? `${money(line.material.pack_price)} / ${fmt(line.material.pack_size)} ${unitLabel(line.material.unit)}${
                            line.material.description ? ` · ${line.material.description}` : ""
                          }${line.material.waste_pct ? ` · ${pct(line.material.waste_pct)}% waste` : ""}`
                        : "No purchase price"}
                    </span>
                  </td>
                  <td className="pb-1 text-right">
                    {fmt(line.line.qty, line.line.qty % 1 ? 1 : 0)} <span className="text-xs text-muted"> {unitLabel(line.line.unit)}</span>
                  </td>
                  <td className="pb-1 text-right">
                    {line.missingCost ? "—" : unitMoney(line.unitCost)}
                  </td>
                  <td className="pb-1 text-right font-medium text-accent-dark">
                    {line.missingCost ? "—" : money(line.lineCost)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}
      </div>

      {cost.missingCosts.length > 0 && (
        <p className="text-sm text-red mb-3">
          Costing is incomplete for {cost.missingCosts.join(", ")}. Check the purchase
          prices behind {cost.missingCosts.length === 1 ? "it" : "them"}.
        </p>
      )}

      <div className="grid grid-cols-2 gap-2 mb-3">
        <div className="flex items-center justify-between px-2 py-1.5 bg-accent-soft rounded-lg">
          <span className="text-xs text-muted">Food cost</span>
          <span className="text-xs font-medium text-accent-dark">{money(cost.foodCost)}</span>
        </div>
        <div className="flex items-center justify-between px-2 py-1.5 bg-accent-soft rounded-lg">
          <span className="text-xs text-muted">Cost / portion</span>
          <span className="text-xs font-medium text-accent-dark">{money(cost.portionCost)}</span>
        </div>
        <div className="flex items-center justify-between px-2 py-1.5 bg-accent-soft rounded-lg">
          <span className="text-xs text-muted">Provision {pct(product.provision_pct)}%</span>
          <span className="text-xs font-medium text-accent-dark">{money(cost.provision)}</span>
        </div>
        <div className="flex items-center justify-between px-2 py-1.5 bg-accent-soft rounded-lg">
          <span className="text-xs text-muted">Packaging</span>
          <span className="text-xs font-medium text-accent-dark">{money(cost.packaging)}</span>
        </div>
        <div className="flex items-center justify-between px-2 py-1.5 bg-surface border border-line rounded-lg">
          <span className="text-xs text-muted">Standard cost</span>
          <span className="text-xs font-bold text-ink">{money(cost.standardCost)}</span>
        </div>
        <div className="flex items-center justify-between px-2 py-1.5 bg-surface border border-line rounded-lg">
          <span className="text-xs text-muted">Suggested price</span>
          <span className="text-xs font-medium text-accent-dark block">
            {money(cost.suggestedGross)}
            <span className="text-[10px] text-muted">
              {money(cost.suggestedNet)} before {pct(cost.vatPct)}% VAT
            </span>
          </span>
        </div>
      </div>

      <div className="pt-3 border-t border-line flex items-center justify-between">
        <div className="flex flex-col gap-0.5">
          <span className="text-xs text-muted uppercase tracking-wider text-[10px]">Menu price</span>
          <span className="text-sm font-bold text-ink">
            {product.selling_price !== null ? money(product.selling_price) : "Not set"}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {fc !== null ? (
            <>
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${
                onTarget
                  ? "bg-green-soft text-green"
                  : "bg-red-soft text-red"
              }`}>
                <span className="w-1.5 h-1.5 rounded-full bg-current opacity-80" />
                {fmt(fc, 1)}% food cost
              </span>
              <span className="text-xs text-muted">
                {onTarget ? "On" : "Above"} {pct(cost.targetPct)}% target ·{" "}
                {money(cost.margin ?? 0)} margin
              </span>
            </>
          ) : (
            <span className="text-xs text-muted">
              Target {pct(cost.targetPct)}% · set a menu price to check it
            </span>
          )}
        </div>
      </div>
    </article>
  );
}

/* ------------------------------------------------------------- beverage form */

function BeverageModal({
  editing,
  ingredients,
  packagingMaterials,
  onClose,
  onSaved,
}: {
  editing: Product | "new" | null;
  ingredients: Ingredient[];
  packagingMaterials: PackagingMaterial[];
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const isNew = editing === "new";
  const product = editing && editing !== "new" ? editing : null;

  const [name, setName] = useState("");
  const [category, setCategory] = useState("Espresso");
  const [size, setSize] = useState("");
  const [lines, setLines] = useState<IngredientDraftLine[]>([]);
  const [packLines, setPackLines] = useState<PackagingDraftLine[]>([]);
  const [yieldQty, setYieldQty] = useState("1");
  const [provision, setProvision] = useState("20");
  const [targetFc, setTargetFc] = useState("33");
  const [vat, setVat] = useState("12");
  const [sellingPrice, setSellingPrice] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!editing) return;
    setName(product?.name ?? "");
    setCategory(product?.category ?? "Espresso");
    setSize(product?.size_label ?? "");
    setLines(
      product
        ? product.recipe.map((line) => ({
            ingredient_id: line.ingredient_id,
            qty: String(line.qty),
          }))
        : [{ ingredient_id: ingredients[0]?.id ?? "", qty: "" }],
    );
    setPackLines(
      product
        ? product.packaging.map((line) => ({
            packaging_id: line.packaging_id,
            qty: String(line.qty),
          }))
        : [],
    );
    setYieldQty(String(product?.yield_qty ?? 1));
    setProvision(String(product?.provision_pct ?? 20));
    setTargetFc(String(product?.target_food_cost_pct ?? 33));
    setVat(String(product?.vat_pct ?? 12));
    setSellingPrice(
      product?.selling_price !== null && product?.selling_price !== undefined
        ? String(product.selling_price)
        : "",
    );
    setError("");
  }, [editing, ingredients, packagingMaterials, product]);

  const updateLine = (index: number, patch: Partial<IngredientDraftLine>) => {
    setLines((current) =>
      current.map((line, i) => (i === index ? { ...line, ...patch } : line)),
    );
  };

  const updatePackLine = (index: number, patch: Partial<PackagingDraftLine>) => {
    setPackLines((current) =>
      current.map((line, i) => (i === index ? { ...line, ...patch } : line)),
    );
  };

  const draftRecipe = lines
    .filter((line) => line.ingredient_id !== "")
    .map((line, index) => {
      const ingredient = ingredients.find((i) => i.id === Number(line.ingredient_id));
      return {
        id: index,
        product_id: product?.id ?? 0,
        ingredient_id: Number(line.ingredient_id),
        qty: Number(line.qty) || 0,
        ingredient_name: ingredient?.name ?? "Ingredient",
        unit: (ingredient?.unit ?? "g") as Unit,
      };
    });

  const draftPackaging = packLines
    .filter((line) => line.packaging_id !== "")
    .map((line, index) => {
      const material = packagingMaterials.find(
        (row) => row.id === Number(line.packaging_id),
      );
      return {
        id: index,
        product_id: product?.id ?? 0,
        packaging_id: Number(line.packaging_id),
        packaging_name: material?.name ?? "Packaging",
        unit: (material?.unit ?? "pcs") as Unit,
        qty: Number(line.qty) || 0,
      };
    });

  const draftProduct: Product = {
    id: product?.id ?? 0,
    name: name || "New beverage",
    category,
    size_label: size,
    yield_qty: Number(yieldQty) || 1,
    provision_pct: Number(provision) || 0,
    target_food_cost_pct: Number(targetFc) || 33,
    vat_pct: Number(vat) || 0,
    selling_price:
      sellingPrice === "" || !(Number(sellingPrice) > 0) ? null : Number(sellingPrice),
    recipe: draftRecipe,
    packaging: draftPackaging,
  };
  const preview = recipeCost(draftProduct, ingredients, packagingMaterials);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!name.trim()) {
      setError("Give the beverage a name.");
      return;
    }
    const recipe = draftRecipe
      .filter((line) => line.qty > 0)
      .map((line) => ({ ingredient_id: line.ingredient_id, qty: line.qty }));
    const packagingLines = draftPackaging
      .filter((line) => line.qty > 0)
      .map((line) => ({ packaging_id: line.packaging_id, qty: line.qty }));

    if (recipe.length === 0) {
      setError("Add at least one ingredient with a quantity.");
      return;
    }
    if (new Set(recipe.map((l) => l.ingredient_id)).size !== recipe.length) {
      setError("Each ingredient can only appear once.");
      return;
    }
    if (new Set(packagingLines.map((l) => l.packaging_id)).size !== packagingLines.length) {
      setError("Each packaging material can only appear once.");
      return;
    }
    if (!(Number(yieldQty) > 0)) {
      setError("Yield must be greater than zero.");
      return;
    }

    const body: ProductInput = {
      name: name.trim(),
      category,
      size_label: size.trim(),
      recipe,
      packaging: packagingLines,
      yield_qty: Number(yieldQty) || 1,
      provision_pct: Number(provision) || 0,
      target_food_cost_pct: Number(targetFc) || 33,
      vat_pct: Number(vat) || 0,
      selling_price:
        sellingPrice === "" || !(Number(sellingPrice) > 0) ? null : Number(sellingPrice),
    };

    setSaving(true);
    setError("");
    try {
      if (product) await api.updateProduct(product.id, body);
      else await api.createProduct(body);
      onSaved(product ? `${body.name} updated` : `${body.name} added to the menu`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save beverage");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={Boolean(editing)}
      title={isNew ? "New beverage" : "Edit beverage"}
      subtitle="Recipe quantities make one batch; yield splits its cost across servings."
      onClose={onClose}
      wide
    >
      <form onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-ink-soft uppercase tracking-wider">Beverage name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Classic Milk Tea"
              autoFocus
              className="bg-surface border border-line rounded-lg px-3 py-2 text-ink focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-1"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-ink-soft uppercase tracking-wider">Size label</label>
            <input
              value={size}
              onChange={(e) => setSize(e.target.value)}
              placeholder="16 oz"
              className="bg-surface border border-line rounded-lg px-3 py-2 text-ink focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-1"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-ink-soft uppercase tracking-wider">Menu group</label>
          <input
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder="Espresso"
            list="category-options"
            className="bg-surface border border-line rounded-lg px-3 py-2 text-ink focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-1"
          />
          <datalist id="category-options">
            <option value="Espresso" />
            <option value="Brewed" />
            <option value="Iced" />
            <option value="Milk Tea" />
            <option value="Tea" />
            <option value="Other" />
          </datalist>
        </div>

        <div className="border border-line rounded-lg p-3 space-y-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-semibold text-ink-soft uppercase tracking-wider">Ingredients & bases · one batch</span>
            <span className="text-xs text-muted">Batch quantities</span>
          </div>
          {lines.map((line, index) => {
            const ingredient = ingredients.find((i) => i.id === Number(line.ingredient_id));
            const costed = preview.lines.find(
              (l) => l.item.ingredient_id === Number(line.ingredient_id),
            );
            return (
              <div key={index} className="flex min-w-0 flex-wrap items-center gap-2">
                <select
                  value={line.ingredient_id}
                  onChange={(e) =>
                    updateLine(index, {
                      ingredient_id: e.target.value === "" ? "" : Number(e.target.value),
                    })
                  }
                  className="min-w-[9rem] flex-1 bg-surface border border-line rounded-lg px-3 py-2 text-ink text-sm focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-1"
                >
                  <option value="">Choose ingredient…</option>
                  {ingredients.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.name}
                      {i.category.toLowerCase() === "base" ? " · base" : ""}
                    </option>
                  ))}
                </select>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={line.qty}
                    onChange={(e) => updateLine(index, { qty: e.target.value })}
                    placeholder="0"
                    className="w-16 bg-surface border border-line rounded-lg px-2 py-2 text-ink text-right focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-1"
                  />
                  <span className="text-xs text-muted">
                    {ingredient ? unitLabel(ingredient.unit) : "—"}
                  </span>
                </div>
                <span className="text-xs font-medium text-accent-dark whitespace-nowrap">
                  {costed && !costed.missingCost ? money(costed.lineCost) : "—"}
                </span>
                <button
                  type="button"
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-muted hover:bg-red-soft hover:text-red focus:outline-none focus:ring-2 focus:ring-red focus:ring-offset-1"
                  aria-label="Remove ingredient"
                  onClick={() => setLines((current) => current.filter((_, i) => i !== index))}
                >
                  <IconTrash size={15} />
                </button>
              </div>
            );
          })}
          <div className="flex flex-wrap items-center gap-2 border-t border-line pt-2">
            <button
              type="button"
              className="flex-1 bg-surface border border-line rounded-lg px-3 py-1.5 text-sm font-medium text-ink-soft hover:bg-surface-2 hover:text-ink transition-colors focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-1"
              onClick={() =>
                setLines((current) => [
                  ...current,
                  { ingredient_id: ingredients[0]?.id ?? "", qty: "" },
                ])
              }
            >
              <IconPlus size={14} className="mr-1.5" /> Add ingredient
            </button>
            <Link
              className="text-sm text-accent hover:text-accent-dark underline decoration-accent/30"
              to="/library"
            >
              Add a base or ingredient in the library
            </Link>
          </div>
        </div>

        <div className="border border-line rounded-lg p-3 space-y-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-semibold text-ink-soft uppercase tracking-wider">Packaging materials</span>
            <span className="text-xs text-muted">Costed per piece</span>
          </div>
          {packLines.map((line, index) => {
            const material = packagingMaterials.find(
              (row) => row.id === Number(line.packaging_id),
            );
            const costed = preview.packagingLines.find(
              (row) => row.line.packaging_id === Number(line.packaging_id),
            );
            return (
              <div key={index} className="flex min-w-0 flex-wrap items-center gap-2">
                <select
                  value={line.packaging_id}
                  onChange={(e) =>
                    updatePackLine(index, {
                      packaging_id: e.target.value === "" ? "" : Number(e.target.value),
                    })
                  }
                  className="min-w-[9rem] flex-1 bg-surface border border-line rounded-lg px-3 py-2 text-ink text-sm focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-1"
                >
                  <option value="">Choose packaging…</option>
                  {packagingMaterials.map((row) => (
                    <option key={row.id} value={row.id}>
                      {row.name}
                    </option>
                  ))}
                </select>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={line.qty}
                    onChange={(e) => updatePackLine(index, { qty: e.target.value })}
                    placeholder="0"
                    className="w-16 bg-surface border border-line rounded-lg px-2 py-2 text-ink text-right focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-1"
                  />
                  <span className="text-xs text-muted">
                    {material ? unitLabel(material.unit) : "—"}
                  </span>
                </div>
                <span className="text-xs font-medium text-accent-dark whitespace-nowrap">
                  {costed && !costed.missingCost ? money(costed.lineCost) : "—"}
                </span>
                <button
                  type="button"
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-muted hover:bg-red-soft hover:text-red focus:outline-none focus:ring-2 focus:ring-red focus:ring-offset-1"
                  aria-label="Remove packaging"
                  onClick={() =>
                    setPackLines((current) => current.filter((_, i) => i !== index))
                  }
                >
                  <IconTrash size={15} />
                </button>
              </div>
            );
          })}
          {packagingMaterials.length === 0 ? (
            <p className="text-xs text-muted">
              No packaging materials yet. Add cups, lids or bags in the{" "}
              <Link className="text-accent hover:text-accent-dark underline decoration-accent/30" to="/library">
                costing library
              </Link>
              .
            </p>
          ) : (
            <button
              type="button"
              className="w-full bg-surface border border-line rounded-lg px-3 py-1.5 text-sm font-medium text-ink-soft hover:bg-surface-2 hover:text-ink transition-colors focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-1"
              onClick={() =>
                setPackLines((current) => [
                  ...current,
                  { packaging_id: packagingMaterials[0]?.id ?? "", qty: "1" },
                ])
              }
            >
              <IconPlus size={14} className="mr-1.5" /> Add packaging
            </button>
          )}
        </div>

        <div className="border border-line rounded-lg p-3 space-y-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-semibold text-ink-soft uppercase tracking-wider">Costing & price</span>
            <span className="text-xs text-muted">Prices are in Philippine pesos</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-ink-soft uppercase tracking-wider">Yield (servings)</label>
              <input
                type="number"
                min="0.01"
                step="any"
                value={yieldQty}
                onChange={(e) => setYieldQty(e.target.value)}
                className="bg-surface border border-line rounded-lg px-3 py-2 text-ink focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-1"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-ink-soft uppercase tracking-wider">Provision %</label>
              <input
                type="number"
                min="0"
                max="100"
                step="0.1"
                value={provision}
                onChange={(e) => setProvision(e.target.value)}
                className="bg-surface border border-line rounded-lg px-3 py-2 text-ink focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-1"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-ink-soft uppercase tracking-wider">Target food cost %</label>
              <input
                type="number"
                min="0.01"
                max="100"
                step="0.1"
                value={targetFc}
                onChange={(e) => setTargetFc(e.target.value)}
                className="bg-surface border border-line rounded-lg px-3 py-2 text-ink focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-1"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-ink-soft uppercase tracking-wider">VAT %</label>
              <input
                type="number"
                min="0"
                max="100"
                step="0.1"
                value={vat}
                onChange={(e) => setVat(e.target.value)}
                className="bg-surface border border-line rounded-lg px-3 py-2 text-ink focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-1"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-ink-soft uppercase tracking-wider">Menu price (incl. VAT)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={sellingPrice}
                onChange={(e) => setSellingPrice(e.target.value)}
                placeholder="Optional"
                className="bg-surface border border-line rounded-lg px-3 py-2 text-ink focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-1"
              />
            </div>
          </div>
        </div>

        <CostPreview preview={preview} menuPrice={sellingPrice} />

        {error && <p className="text-sm text-red">{error}</p>}

        <div className="flex justify-end gap-2 pt-3 border-t border-line">
          <button
            type="button"
            className="bg-surface border border-line rounded-lg px-4 py-2 text-sm font-medium text-ink-soft hover:bg-surface-2 hover:text-ink transition-colors focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-1"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="bg-ink text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-accent-dark transition-colors focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2"
            disabled={saving}
          >
            {saving ? "Saving…" : isNew ? "Add beverage" : "Save changes"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function CostPreview({ preview, menuPrice }: { preview: RecipeCost; menuPrice: string }) {
  const fc = preview.actualFoodCostPct;
  const onTarget = fc !== null && fc <= preview.targetPct;

  return (
    <div className="border border-line rounded-lg p-3 space-y-3">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-semibold text-ink-soft uppercase tracking-wider">Live cost sheet</span>
        {menuPrice !== "" && fc !== null ? (
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${
            onTarget ? "bg-green-soft text-green" : "bg-red-soft text-red"
          }`}>
            <span className="w-1.5 h-1.5 rounded-full bg-current opacity-80" />
            {fmt(fc, 1)}% food cost
          </span>
        ) : (
          <span className="text-xs text-muted">Suggested selling price shown</span>
        )}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
        <div className="flex items-center justify-between px-2 py-1.5 bg-surface-2 rounded">
          <span className="text-xs text-muted">Food cost</span>
          <strong className="text-xs text-ink">{money(preview.foodCost)}</strong>
        </div>
        <div className="flex items-center justify-between px-2 py-1.5 bg-surface-2 rounded">
          <span className="text-xs text-muted">Packaging</span>
          <strong className="text-xs text-ink">{money(preview.packaging)}</strong>
        </div>
        <div className="flex items-center justify-between px-2 py-1.5 bg-surface-2 rounded">
          <span className="text-xs text-muted">Per portion</span>
          <strong className="text-xs text-ink">{money(preview.portionCost)}</strong>
        </div>
        <div className="flex items-center justify-between px-2 py-1.5 bg-surface-2 rounded">
          <span className="text-xs text-muted">Provision</span>
          <strong className="text-xs text-ink">{money(preview.provision)}</strong>
        </div>
        <div className="flex items-center justify-between px-2 py-1.5 bg-surface-2 rounded">
          <span className="text-xs text-muted">Standard cost</span>
          <strong className="text-xs text-ink">{money(preview.standardCost)}</strong>
        </div>
        <div className="flex items-center justify-between px-2 py-1.5 bg-surface-2 rounded">
          <span className="text-xs text-muted">Ex VAT</span>
          <strong className="text-xs text-ink">{money(preview.suggestedNet)}</strong>
        </div>
        <div className="flex items-center justify-between px-2 py-1.5 bg-surface-2 rounded">
          <span className="text-xs text-muted">Suggested inc. VAT</span>
          <strong className="text-xs text-ink">{money(preview.suggestedGross)}</strong>
        </div>
      </div>
      {preview.missingCosts.length > 0 && (
        <p className="text-xs text-red">
          Costing is incomplete for {preview.missingCosts.join(", ")}.
        </p>
      )}
    </div>
  );
}
