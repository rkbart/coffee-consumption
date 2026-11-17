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
          <button className="btn btn-primary" onClick={() => setEditing("new")}>
            <IconPlus size={17} /> New beverage
          </button>
        }
      />

      {error && <div className="banner banner-error">{error}</div>}

      <div className="list-toolbar menu-toolbar">
        <SearchField
          value={search}
          onChange={setSearch}
          placeholder="Search drinks, menu groups, ingredients…"
          label="Search recipes"
        />
        <label className="menu-filter">
          <span>Menu group</span>
          <select value={menuGroup} onChange={(event) => setMenuGroup(event.target.value)}>
            <option value="all">All menu groups</option>
            {menuGroups.map((group) => (
              <option key={group} value={group}>
                {group}
              </option>
            ))}
          </select>
        </label>
        <p className="search-summary" aria-live="polite">
          {summary}
        </p>
      </div>

      <section className="stack">
        {loading ? (
          <div className="card skeleton-card" />
        ) : filteredProducts.length === 0 ? (
          <div className="empty-state">
            <h2>{query || menuGroup !== "all" ? "No drinks match" : "No beverages yet"}</h2>
            <p>
              {query
                ? `Nothing on the menu matches “${debouncedSearch.trim()}”. Try a different word or clear the search.`
                : menuGroup !== "all"
                  ? `No beverages are in ${menuGroup} yet.`
                  : "Add your first drink with its ingredients and packaging."}
            </p>
            {query || menuGroup !== "all" ? (
              <button
                className="btn btn-quiet"
                onClick={() => {
                  setSearch("");
                  setMenuGroup("all");
                }}
              >
                Clear filters
              </button>
            ) : (
              <button className="btn btn-primary" onClick={() => setEditing("new")}>
                <IconPlus size={17} /> Add a beverage
              </button>
            )}
          </div>
        ) : (
          <>
            {Object.entries(productGroups).map(([category, items]) => (
              <div key={category} className="recipe-group">
                <div className="group-head">
                  <h2>{category}</h2>
                  <span className="count-chip">{items.length}</span>
                </div>
                <div className="recipe-grid">
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
        <p className="confirm-copy">
          <strong>{pendingDelete?.name}</strong>
          {pendingDelete?.size_label ? ` · ${pendingDelete.size_label}` : ""} will be
          removed from the menu and from future counts.
        </p>
        <div className="form-actions">
          <button className="btn btn-quiet" onClick={() => setPendingDelete(null)}>
            Keep it
          </button>
          <button
            className="btn btn-danger"
            onClick={() => pendingDelete && removeProduct(pendingDelete)}
          >
            Remove beverage
          </button>
        </div>
      </Modal>

      {toast && <div className="toast">{toast}</div>}
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
    <article className="card recipe-card">
      <div className="recipe-card-top">
        <div>
          <p className="recipe-kicker">{product.category}</p>
          <h3>{product.name}</h3>
          <span className="size-tag">
            {product.size_label ? `${product.size_label} · ` : ""}
            Yield {fmt(cost.yieldQty, cost.yieldQty % 1 ? 1 : 0)}
          </span>
        </div>
        <div className="card-tools">
          <button
            className="icon-btn"
            aria-label={`Edit ${product.name}`}
            onClick={onEdit}
          >
            <IconEdit size={16} />
          </button>
          <button
            className="icon-btn danger"
            aria-label={`Delete ${product.name}`}
            onClick={onDelete}
          >
            <IconTrash size={16} />
          </button>
        </div>
      </div>

      <table className="cost-table">
        <thead>
          <tr>
            <th>Ingredient</th>
            <th>Qty</th>
            <th>Unit</th>
            <th>Cost</th>
          </tr>
        </thead>
        <tbody>
          {cost.lines.length === 0 && (
            <tr>
              <td colSpan={4} className="muted">
                No ingredients on this recipe yet.
              </td>
            </tr>
          )}
          {cost.lines.map((line) => {
            const ingredient = line.ingredient;
            return (
              <tr key={line.item.id}>
                <td>
                  <span className="cost-ingredient">{line.item.ingredient_name}</span>
                  <span className="cost-pack">
                    {ingredient && ingredient.pack_price > 0
                      ? `${money(ingredient.pack_price)} / ${fmt(ingredient.pack_size)} ${unitLabel(ingredient.unit)}${ingredient.waste_pct ? ` · ${pct(ingredient.waste_pct)}% waste` : ""}`
                      : "No purchase price"}
                  </span>
                </td>
                <td className="numeric">
                  {fmt(line.item.qty, line.item.qty % 1 ? 1 : 0)}{" "}
                  <small>{unitLabel(line.item.unit)}</small>
                </td>
                <td className="numeric">{line.missingCost ? "—" : unitMoney(line.unitCost)}</td>
                <td className="numeric cost-amount">
                  {line.missingCost ? "—" : money(line.lineCost)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <div className="cost-block packaging-block">
        <div className="cost-block-head">
          <span>Packaging</span>
          <span>{money(cost.packaging)}</span>
        </div>
        {cost.packagingLines.length === 0 ? (
          <p className="packaging-empty">
            No packaging selected. Edit this drink to add a cup, lid, straw or bag.
          </p>
        ) : (
          <table className="cost-table">
            <thead>
              <tr>
                <th>Material</th>
                <th>Qty</th>
                <th>Unit</th>
                <th>Cost</th>
              </tr>
            </thead>
            <tbody>
              {cost.packagingLines.map((line) => (
                <tr key={line.line.id}>
                  <td>
                    <span className="cost-ingredient">
                      {line.line.packaging_name}
                    </span>
                    <span className="cost-pack">
                      {line.material
                        ? `${money(line.material.pack_price)} / ${fmt(line.material.pack_size)} ${unitLabel(line.material.unit)}`
                        : "No purchase price"}
                    </span>
                  </td>
                  <td className="numeric">
                    {fmt(line.line.qty, line.line.qty % 1 ? 1 : 0)}{" "}
                    <small>{unitLabel(line.line.unit)}</small>
                  </td>
                  <td className="numeric">
                    {line.missingCost ? "—" : unitMoney(line.unitCost)}
                  </td>
                  <td className="numeric cost-amount">
                    {line.missingCost ? "—" : money(line.lineCost)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {cost.missingCosts.length > 0 && (
        <p className="cost-warning">
          Costing is incomplete for {cost.missingCosts.join(", ")}. Check the purchase
          prices behind {cost.missingCosts.length === 1 ? "it" : "them"}.
        </p>
      )}

      <dl className="cost-summary">
        <div>
          <dt>Food cost</dt>
          <dd>{money(cost.foodCost)}</dd>
        </div>
        <div>
          <dt>Cost / portion</dt>
          <dd>{money(cost.portionCost)}</dd>
        </div>
        <div>
          <dt>Provision {pct(product.provision_pct)}%</dt>
          <dd>{money(cost.provision)}</dd>
        </div>
        <div>
          <dt>Packaging</dt>
          <dd>{money(cost.packaging)}</dd>
        </div>
        <div className="cost-summary-total">
          <dt>Standard cost</dt>
          <dd>{money(cost.standardCost)}</dd>
        </div>
        <div>
          <dt>Suggested price</dt>
          <dd>
            {money(cost.suggestedGross)}
            <small>
              {money(cost.suggestedNet)} before {pct(cost.vatPct)}% VAT
            </small>
          </dd>
        </div>
      </dl>

      <div className="cost-footer">
        <div className="cost-menu-price">
          <span className="mini-label">Menu price</span>
          <strong>
            {product.selling_price !== null ? money(product.selling_price) : "Not set"}
          </strong>
        </div>
        {fc !== null ? (
          <div className="cost-status">
            <span className={`pill ${onTarget ? "pill-on-target" : "pill-over"}`}>
              <span className="pill-dot" />
              {fmt(fc, 1)}% food cost
            </span>
            <span className="cost-margin">
              {onTarget ? "On" : "Above"} {pct(cost.targetPct)}% target ·{" "}
              {money(cost.margin ?? 0)} margin
            </span>
          </div>
        ) : (
          <div className="cost-status">
            <span className="cost-margin">
              Target {pct(cost.targetPct)}% · set a menu price to check it
            </span>
          </div>
        )}
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
      <form onSubmit={submit} className="form">
        <div className="form-grid">
          <label className="field">
            <span>Beverage name</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Classic Milk Tea"
              autoFocus
            />
          </label>
          <label className="field">
            <span>Size label</span>
            <input value={size} onChange={(e) => setSize(e.target.value)} placeholder="16 oz" />
          </label>
        </div>

        <label className="field">
          <span>Menu group</span>
          <input
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder="Espresso"
            list="category-options"
          />
          <datalist id="category-options">
            <option value="Espresso" />
            <option value="Brewed" />
            <option value="Iced" />
            <option value="Milk Tea" />
            <option value="Tea" />
            <option value="Other" />
          </datalist>
        </label>

        <div className="recipe-editor">
          <div className="recipe-editor-head">
            <span>Ingredients &amp; bases · one batch</span>
            <span>Batch quantities</span>
          </div>
          {lines.map((line, index) => {
            const ingredient = ingredients.find((i) => i.id === Number(line.ingredient_id));
            const costed = preview.lines.find(
              (l) => l.item.ingredient_id === Number(line.ingredient_id),
            );
            return (
              <div className="recipe-editor-row" key={index}>
                <select
                  value={line.ingredient_id}
                  onChange={(e) =>
                    updateLine(index, {
                      ingredient_id: e.target.value === "" ? "" : Number(e.target.value),
                    })
                  }
                >
                  <option value="">Choose ingredient…</option>
                  {ingredients.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.name}
                      {i.category.toLowerCase() === "base" ? " · base" : ""}
                    </option>
                  ))}
                </select>
                <div className="qty-input">
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={line.qty}
                    onChange={(e) => updateLine(index, { qty: e.target.value })}
                    placeholder="0"
                  />
                  <span>{ingredient ? unitLabel(ingredient.unit) : "—"}</span>
                </div>
                <span className="line-cost numeric">
                  {costed && !costed.missingCost ? money(costed.lineCost) : "—"}
                </span>
                <button
                  type="button"
                  className="icon-btn danger"
                  aria-label="Remove ingredient"
                  onClick={() => setLines((current) => current.filter((_, i) => i !== index))}
                >
                  <IconTrash size={15} />
                </button>
              </div>
            );
          })}
          <div className="editor-actions">
            <button
              type="button"
              className="btn btn-quiet btn-sm"
              onClick={() =>
                setLines((current) => [
                  ...current,
                  { ingredient_id: ingredients[0]?.id ?? "", qty: "" },
                ])
              }
            >
              <IconPlus size={15} /> Add ingredient
            </button>
            <Link className="text-link" to="/library">
              Add a base or ingredient in the library
            </Link>
          </div>
        </div>

        <div className="recipe-editor">
          <div className="recipe-editor-head">
            <span>Packaging materials</span>
            <span>Costed per piece</span>
          </div>
          {packLines.map((line, index) => {
            const material = packagingMaterials.find(
              (row) => row.id === Number(line.packaging_id),
            );
            const costed = preview.packagingLines.find(
              (row) => row.line.packaging_id === Number(line.packaging_id),
            );
            return (
              <div className="recipe-editor-row" key={index}>
                <select
                  value={line.packaging_id}
                  onChange={(e) =>
                    updatePackLine(index, {
                      packaging_id: e.target.value === "" ? "" : Number(e.target.value),
                    })
                  }
                >
                  <option value="">Choose packaging…</option>
                  {packagingMaterials.map((row) => (
                    <option key={row.id} value={row.id}>
                      {row.name}
                    </option>
                  ))}
                </select>
                <div className="qty-input">
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={line.qty}
                    onChange={(e) => updatePackLine(index, { qty: e.target.value })}
                    placeholder="0"
                  />
                  <span>{material ? unitLabel(material.unit) : "—"}</span>
                </div>
                <span className="line-cost numeric">
                  {costed && !costed.missingCost ? money(costed.lineCost) : "—"}
                </span>
                <button
                  type="button"
                  className="icon-btn danger"
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
            <p className="editor-hint">
              No packaging materials yet. Add cups, lids or bags in the{" "}
              <Link className="text-link" to="/library">
                costing library
              </Link>
              .
            </p>
          ) : (
            <button
              type="button"
              className="btn btn-quiet btn-sm"
              onClick={() =>
                setPackLines((current) => [
                  ...current,
                  { packaging_id: packagingMaterials[0]?.id ?? "", qty: "1" },
                ])
              }
            >
              <IconPlus size={15} /> Add packaging
            </button>
          )}
        </div>

        <div className="form-section">
          <div className="form-section-head">
            <h3>Costing &amp; price</h3>
            <p>Prices are in Philippine pesos, the same as the cost sheet.</p>
          </div>
          <div className="form-grid three">
            <label className="field">
              <span>Yield (servings)</span>
              <input
                type="number"
                min="0.01"
                step="any"
                value={yieldQty}
                onChange={(e) => setYieldQty(e.target.value)}
              />
            </label>
            <label className="field">
              <span>Provision %</span>
              <input
                type="number"
                min="0"
                max="100"
                step="0.1"
                value={provision}
                onChange={(e) => setProvision(e.target.value)}
              />
            </label>
            <label className="field">
              <span>Target food cost %</span>
              <input
                type="number"
                min="0.01"
                max="100"
                step="0.1"
                value={targetFc}
                onChange={(e) => setTargetFc(e.target.value)}
              />
            </label>
            <label className="field">
              <span>VAT %</span>
              <input
                type="number"
                min="0"
                max="100"
                step="0.1"
                value={vat}
                onChange={(e) => setVat(e.target.value)}
              />
            </label>
            <label className="field">
              <span>Menu price (incl. VAT)</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={sellingPrice}
                onChange={(e) => setSellingPrice(e.target.value)}
                placeholder="Optional"
              />
            </label>
          </div>
        </div>

        <CostPreview preview={preview} menuPrice={sellingPrice} />

        {error && <p className="form-error">{error}</p>}

        <div className="form-actions">
          <button type="button" className="btn btn-quiet" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={saving}>
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
    <div className="cost-preview">
      <div className="cost-preview-head">
        <span className="mini-label">Live cost sheet</span>
        {menuPrice !== "" && fc !== null ? (
          <span className={`pill ${onTarget ? "pill-on-target" : "pill-over"}`}>
            <span className="pill-dot" />
            {fmt(fc, 1)}% food cost
          </span>
        ) : (
          <span className="cost-margin">Suggested selling price shown</span>
        )}
      </div>
      <div className="cost-preview-grid four">
        <div>
          <span>Food cost</span>
          <strong>{money(preview.foodCost)}</strong>
        </div>
        <div>
          <span>Packaging</span>
          <strong>{money(preview.packaging)}</strong>
        </div>
        <div>
          <span>Per portion</span>
          <strong>{money(preview.portionCost)}</strong>
        </div>
        <div>
          <span>Provision</span>
          <strong>{money(preview.provision)}</strong>
        </div>
        <div>
          <span>Standard cost</span>
          <strong>{money(preview.standardCost)}</strong>
        </div>
        <div>
          <span>Ex VAT</span>
          <strong>{money(preview.suggestedNet)}</strong>
        </div>
        <div>
          <span>Suggested inc. VAT</span>
          <strong>{money(preview.suggestedGross)}</strong>
        </div>
      </div>
      {preview.missingCosts.length > 0 && (
        <p className="cost-warning">
          Costing is incomplete for {preview.missingCosts.join(", ")}.
        </p>
      )}
    </div>
  );
}
