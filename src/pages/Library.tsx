import { useEffect, useMemo, useState } from "react";
import PageHeader from "../components/PageHeader";
import Modal from "../components/Modal";
import Pagination from "../components/Pagination";
import SearchField from "../components/SearchField";
import {
  IngredientModal,
  PackagingModal,
} from "../components/LibraryModals";
import { useDebouncedValue } from "../hooks";
import { api } from "../api";
import type { Ingredient, PackagingMaterial } from "../types";
import { fmt, money, unitLabel, unitMoney } from "../lib";
import { IconCoffee, IconMilk, IconPlus, IconEdit, IconTrash } from "../components/Icons";

const PER_PAGE = 12;

const matchesQuery = (query: string, values: (string | number | null | undefined)[]) =>
  !query || values.some((value) => String(value ?? "").toLowerCase().includes(query));

const packagingUnitCost = (material: PackagingMaterial) => {
  const net = material.pack_size * (1 - (material.waste_pct || 0) / 100);
  return material.pack_price > 0 && net > 0 ? material.pack_price / net : null;
};

const packagingTotalCost = (material: PackagingMaterial) => {
  const unitCost = packagingUnitCost(material);
  return unitCost !== null ? unitCost * material.qty_needed : null;
};

export default function Library() {
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [packaging, setPackaging] = useState<PackagingMaterial[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 250);
  const [tab, setTab] = useState<"ingredients" | "packaging">("ingredients");
  const [page, setPage] = useState(1);

  const [ingredientModal, setIngredientModal] = useState<Ingredient | "new" | null>(null);
  const [packagingModal, setPackagingModal] = useState<PackagingMaterial | "new" | null>(
    null,
  );
  const [pendingDelete, setPendingDelete] = useState<PackagingMaterial | null>(null);
  const [toast, setToast] = useState("");

  const load = async () => {
    try {
      const [nextIngredients, nextPackaging] = await Promise.all([
        api.ingredients(),
        api.packaging(),
      ]);
      setIngredients(nextIngredients);
      setPackaging(nextPackaging);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load the costing library");
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

  const filteredIngredients = useMemo(
    () =>
      ingredients.filter((ingredient) =>
        matchesQuery(query, [ingredient.name, ingredient.category, ingredient.unit]),
      ),
    [ingredients, query],
  );

  const filteredPackaging = useMemo(
    () =>
      packaging.filter((material) =>
        matchesQuery(query, [
          material.name,
          material.description,
          material.unit,
        ]),
      ),
    [packaging, query],
  );

  useEffect(() => {
    setPage(1);
  }, [query, tab]);

  const activeTotal =
    tab === "ingredients" ? filteredIngredients.length : filteredPackaging.length;
  const pageCount = Math.max(1, Math.ceil(activeTotal / PER_PAGE));
  const safePage = Math.min(page, pageCount);
  const start = (safePage - 1) * PER_PAGE;
  const pagedIngredients = filteredIngredients.slice(start, start + PER_PAGE);
  const pagedPackaging = filteredPackaging.slice(start, start + PER_PAGE);

  const ingredientGroups = pagedIngredients.reduce<Record<string, Ingredient[]>>(
    (acc, ingredient) => {
      (acc[ingredient.category] ||= []).push(ingredient);
      return acc;
    },
    {},
  );

  const totalMatches = filteredIngredients.length + filteredPackaging.length;

  return (
    <>
      <PageHeader
        eyebrow="The costing library"
        title="Ingredients & packaging"
        description="Every purchased ingredient and packaging material in one place. Packaging shows cost per piece and the total per drink based on quantity needed."
        actions={
          <button
            className="btn btn-primary"
            onClick={() =>
              tab === "ingredients"
                ? setIngredientModal("new")
                : setPackagingModal("new")
            }
          >
            <IconPlus size={17} /> Add {tab === "ingredients" ? "ingredient" : "packaging"}
          </button>
        }
      />

      {error && <div className="banner banner-error">{error}</div>}

      <div className="list-toolbar">
        <SearchField
          value={search}
          onChange={setSearch}
          placeholder="Search ingredients, groups, packaging…"
          label="Search the costing library"
        />
        <p className="search-summary" aria-live="polite">
          {query
            ? `${totalMatches} result${totalMatches === 1 ? "" : "s"} for “${debouncedSearch.trim()}”`
            : `${ingredients.length} ingredients · ${packaging.length} packaging`}
        </p>
      </div>

      <section className="card library-page">
        <div className="library-page-head">
          <div className="library-tabs" role="tablist" aria-label="Library section">
            <button
              type="button"
              role="tab"
              aria-selected={tab === "ingredients"}
              className={tab === "ingredients" ? "active" : ""}
              onClick={() => setTab("ingredients")}
            >
              <IconCoffee size={15} /> Ingredients
              <span className="tab-count">{filteredIngredients.length}</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === "packaging"}
              className={tab === "packaging" ? "active" : ""}
              onClick={() => setTab("packaging")}
            >
              <IconMilk size={15} /> Packaging
              <span className="tab-count">{filteredPackaging.length}</span>
            </button>
          </div>
          <button
            className="btn btn-quiet btn-sm"
            onClick={() =>
              tab === "ingredients"
                ? setIngredientModal("new")
                : setPackagingModal("new")
            }
          >
            <IconPlus size={15} /> Add
          </button>
        </div>

        <p className="muted panel-note">
          {tab === "ingredients"
            ? "Pack price is spread across the pack size, net of waste. For a base you make yourself, use the batch cost and batch yield."
            : "Cups, lids, straws and bags are costed per piece. Price per piece × quantity needed = packaging cost per drink."}
        </p>

        {loading ? (
          <div className="card skeleton-card" />
        ) : tab === "ingredients" ? (
          <>
            {filteredIngredients.length === 0 ? (
              <div className="library-empty">
                <p>{query ? "No ingredients match this search." : "No ingredients yet."}</p>
                <button
                  className="btn btn-primary btn-sm"
                  onClick={() => (query ? setSearch("") : setIngredientModal("new"))}
                >
                  {query ? "Clear search" : "Add the first ingredient"}
                </button>
              </div>
            ) : (
              <>
                {Object.entries(ingredientGroups).map(([category, rows]) => (
                  <div className="ingredient-group" key={category}>
                    <p className="mini-label">{category}</p>
                    {rows.map((ingredient) => {
                      const net =
                        ingredient.pack_size * (1 - (ingredient.waste_pct || 0) / 100);
                      const unitCost =
                        ingredient.pack_price > 0 && net > 0
                          ? ingredient.pack_price / net
                          : null;
                      return (
                        <button
                          key={ingredient.id}
                          className="ingredient-row library-row"
                          onClick={() => setIngredientModal(ingredient)}
                        >
                          <span
                            className={`ingredient-dot ${
                              ingredient.unit === "g"
                                ? "coffee"
                                : ingredient.unit === "ml"
                                  ? "milk"
                                  : "other"
                            }`}
                          />
                          <span className="ingredient-copy">
                            <span className="ingredient-name">{ingredient.name}</span>
                            <span className="ingredient-price">
                              {ingredient.pack_price > 0
                                ? `${money(ingredient.pack_price)} / ${fmt(ingredient.pack_size)} ${unitLabel(ingredient.unit)}`
                                : "Add a purchase price"}
                            </span>
                          </span>
                          <span className="unit-chip">
                            {unitCost !== null
                              ? `${unitMoney(unitCost)}/${unitLabel(ingredient.unit)}`
                              : unitLabel(ingredient.unit)}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                ))}
              </>
            )}
          </>
        ) : (
          <>
            {filteredPackaging.length === 0 ? (
              <div className="library-empty">
                <p>{query ? "No packaging materials match this search." : "No packaging materials yet."}</p>
                <button
                  className="btn btn-primary btn-sm"
                  onClick={() => (query ? setSearch("") : setPackagingModal("new"))}
                >
                  {query ? "Clear search" : "Add the first material"}
                </button>
              </div>
            ) : (
              <>
                <div className="packaging-table">
                  <table>
                    <thead>
                      <tr>
                        <th scope="col">Material</th>
                        <th scope="col">Brand / notes</th>
                        <th scope="col" className="numeric">Pack price</th>
                        <th scope="col" className="numeric">Pack size</th>
                        <th scope="col" className="numeric">Price / piece</th>
                        <th scope="col" className="numeric">Qty / drink</th>
                        <th scope="col" className="numeric cost-amount">Cost / drink</th>
                        <th scope="col">Unit</th>
                        <th scope="col" className="packaging-actions-col" />
                      </tr>
                    </thead>
                    <tbody>
                      {pagedPackaging.map((material) => {
                        const unitCost = packagingUnitCost(material);
                        const totalCost = packagingTotalCost(material);
                        return (
                          <tr key={material.id} className="packaging-row" data-id={material.id}>
                            <td>
                              <button
                                type="button"
                                className="packaging-name-link"
                                onClick={() => setPackagingModal(material)}
                              >
                                <span className="ingredient-name">{material.name}</span>
                              </button>
                            </td>
                            <td className="muted small">
                              {material.description || "—"}
                            </td>
                            <td className="numeric">
                              {material.pack_price > 0
                                ? money(material.pack_price)
                                : "—"}
                            </td>
                            <td className="numeric">
                              {fmt(material.pack_size)}
                            </td>
                            <td className="numeric">
                              {unitCost !== null ? unitMoney(unitCost) : "—"}
                            </td>
                            <td className="numeric">
                              {fmt(material.qty_needed)}
                            </td>
                            <td className="numeric cost-amount">
                              {totalCost !== null ? money(totalCost) : "—"}
                            </td>
                            <td className="unit-chip">
                              {unitLabel(material.unit)}
                            </td>
                            <td className="packaging-actions-col">
                              <button
                                type="button"
                                className="icon-btn"
                                aria-label={`Edit ${material.name}`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setPackagingModal(material);
                                }}
                              >
                                <IconEdit size={15} />
                              </button>
                              <button
                                type="button"
                                className="icon-btn danger"
                                aria-label={`Delete ${material.name}`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setPendingDelete(material);
                                }}
                              >
                                <IconTrash size={15} />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  <tfoot>
                    <tr className="packaging-totals">
                      <td colSpan={7} className="label">
                        Total packaging cost per drink:
                      </td>
                      <td className="numeric total">
                        {money(
                          pagedPackaging.reduce(
                            (sum, m) => sum + (packagingTotalCost(m) ?? 0),
                            0,
                          ),
                        )}
                      </td>
                      <td />
                      <td />
                    </tr>
                  </tfoot>
                </div>
                <Pagination
                  page={safePage}
                  pageCount={pageCount}
                  total={activeTotal}
                  pageSize={PER_PAGE}
                  onPageChange={setPage}
                  label="materials"
                />
              </>
            )}
          </>
        )}

        <IngredientModal
          editing={ingredientModal}
          onClose={() => setIngredientModal(null)}
          onSaved={async (message) => {
            setIngredientModal(null);
            setToast(message);
            await load();
          }}
        />

        <PackagingModal
          editing={packagingModal}
          onClose={() => setPackagingModal(null)}
          onSaved={async (message) => {
            setPackagingModal(null);
            setToast(message);
            await load();
          }}
        />

        {toast && <div className="toast">{toast}</div>}

        <Modal
          open={Boolean(pendingDelete)}
          title="Remove packaging?"
          subtitle="Past recipes keep their snapshot, so cost history is not affected."
          onClose={() => setPendingDelete(null)}
        >
          <p className="confirm-copy">
            <strong>{pendingDelete?.name}</strong> will be removed from your
            packaging list and from any recipes that use it.
          </p>
          <div className="form-actions">
            <button className="btn btn-quiet" onClick={() => setPendingDelete(null)}>
              Keep it
            </button>
            <button
              className="btn btn-danger"
              onClick={async () => {
                if (!pendingDelete) return;
                try {
                  await api.deletePackaging(pendingDelete.id);
                  setPendingDelete(null);
                  setToast(`${pendingDelete.name} removed`);
                  await load();
                } catch (err) {
                  setPendingDelete(null);
                  setToast(
                    err instanceof Error ? err.message : "Could not delete packaging",
                  );
                }
              }}
            >
              Remove packaging
            </button>
          </div>
        </Modal>
      </section>
    </>
  );
}
