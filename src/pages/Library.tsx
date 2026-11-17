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

const packagingTotalCost = (material: PackagingMaterial) => {
  if (material.components.length === 0) return null;
  let total = 0;
  for (const component of material.components) {
    const net = component.pack_size * (1 - (component.waste_pct || 0) / 100);
    if (component.pack_price <= 0 || net <= 0) return null;
    total += (component.pack_price / net) * component.qty_needed;
  }
  return total;
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
  const [expandedPackagingId, setExpandedPackagingId] = useState<number | null>(null);
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
          ...material.components.flatMap((component) => [component.name, component.description]),
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
        description="Manage ingredient costs and complete packaging sets. Each set groups all items used for a drink size and shows their combined cost per drink."
        actions={
          <button
            className="bg-ink text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-accent-dark transition-colors focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2"
            onClick={() =>
              tab === "ingredients"
                ? setIngredientModal("new")
                : setPackagingModal("new")
            }
          >
            <IconPlus size={17} className="mr-1.5" /> Add{" "}
            {tab === "ingredients" ? "ingredient" : "packaging set"}
          </button>
        }
      />

      {error && (
        <div className="bg-red-soft border border-red rounded-lg p-3 text-red text-sm">
          {error}
        </div>
      )}

      <div className="mb-4 flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <SearchField
          value={search}
          onChange={setSearch}
          placeholder="Search ingredients, sets or components…"
          label="Search the costing library"
        />
        <p className="min-w-0 text-sm leading-relaxed text-muted sm:flex-1">
          {query
            ? `${totalMatches} result${totalMatches === 1 ? "" : "s"} for “${debouncedSearch.trim()}”`
            : `${ingredients.length} ingredients · ${packaging.length} packaging sets`}
        </p>
      </div>

      <section className="rounded-lg border border-line bg-surface p-3 sm:p-5">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-3">
          <div className="flex flex-wrap items-center gap-2" role="tablist" aria-label="Library section">
            <button
              type="button"
              role="tab"
              aria-selected={tab === "ingredients"}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                tab === "ingredients"
                  ? "bg-accent-soft text-accent-dark"
                  : "text-ink-soft hover:bg-surface-2 hover:text-ink"
              }`}
              onClick={() => setTab("ingredients")}
            >
              <IconCoffee size={15} className="shrink-0" /> Ingredients
              <span className="ml-1 px-1.5 py-0.5 bg-surface-2 text-ink-soft rounded text-xs font-medium">
                {filteredIngredients.length}
              </span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === "packaging"}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                tab === "packaging"
                  ? "bg-accent-soft text-accent-dark"
                  : "text-ink-soft hover:bg-surface-2 hover:text-ink"
              }`}
              onClick={() => setTab("packaging")}
            >
              <IconMilk size={15} className="shrink-0" /> Packaging
              <span className="ml-1 px-1.5 py-0.5 bg-surface-2 text-ink-soft rounded text-xs font-medium">
                {filteredPackaging.length}
              </span>
            </button>
          </div>
          <button
            className="bg-surface border border-line rounded-lg px-3 py-1.5 text-sm font-medium text-ink-soft hover:bg-surface-2 hover:text-ink transition-colors focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-1"
            onClick={() =>
              tab === "ingredients"
                ? setIngredientModal("new")
                : setPackagingModal("new")
            }
          >
            <IconPlus size={15} className="mr-1.5" /> Add
          </button>
        </div>

        <p className="text-sm text-muted mb-4">
          {tab === "ingredients"
            ? "Pack price is spread across the pack size, net of waste. For a base you make yourself, use the batch cost and batch yield."
            : "Create a packaging set for a drink size, then add the cup, lid, straw, bag and other components. The set total is added to each recipe that uses it."}
        </p>

        {loading ? (
          <div className="h-32 bg-surface-2 border border-line rounded-lg animate-pulse" />
        ) : tab === "ingredients" ? (
          <>
            {filteredIngredients.length === 0 ? (
              <div className="text-center py-6">
                <p className="text-muted">{query ? "No ingredients match this search." : "No ingredients yet."}</p>
                <button
                  className="bg-ink text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-accent-dark transition-colors focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2"
                  onClick={() => (query ? setSearch("") : setIngredientModal("new"))}
                >
                  {query ? "Clear search" : "Add the first ingredient"}
                </button>
              </div>
            ) : (
              <>
                {Object.entries(ingredientGroups).map(([category, rows]) => (
                  <div key={category} className="mb-4">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted mb-2">{category}</p>
                    {rows.map((ingredient) => {
                      const net =
                        ingredient.pack_size * (1 - (ingredient.waste_pct || 0) / 100);
                      const unitCost =
                        ingredient.pack_price > 0 && net > 0
                          ? ingredient.pack_price / net
                          : null;
                      const dotColor =
                        ingredient.unit === "g"
                          ? "bg-accent"
                          : ingredient.unit === "ml"
                            ? "bg-green"
                            : "bg-muted";
                      return (
                        <button
                          key={ingredient.id}
                          className="flex items-center gap-3 w-full px-3 py-2 rounded-lg text-left hover:bg-surface-2 transition-colors focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-1"
                          onClick={() => setIngredientModal(ingredient)}
                        >
                          <span
                            className={`w-2 h-2 rounded-full shrink-0 ${dotColor}`}
                          />
                          <span className="flex-1 min-w-0">
                            <span className="font-medium text-ink truncate">{ingredient.name}</span>
                            <span className="text-xs text-muted block">
                              {ingredient.pack_price > 0
                                ? `${money(ingredient.pack_price)} / ${fmt(ingredient.pack_size)} ${unitLabel(ingredient.unit)}`
                                : "Add a purchase price"}
                            </span>
                          </span>
                          <span className="text-xs font-medium text-accent-dark shrink-0 whitespace-nowrap">
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
              <div className="text-center py-6">
                <p className="text-muted">{query ? "No packaging sets or components match this search." : "No packaging sets yet."}</p>
                <button
                  className="bg-ink text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-accent-dark transition-colors focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2"
                  onClick={() => (query ? setSearch("") : setPackagingModal("new"))}
                >
                  {query ? "Clear search" : "Add the first packaging set"}
                </button>
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  {pagedPackaging.map((material) => {
                    const totalCost = packagingTotalCost(material);
                    const isExpanded = expandedPackagingId === material.id;
                    return (
                      <article
                        key={material.id}
                        className={`rounded-lg border border-line bg-surface p-4 transition-colors hover:border-line-strong ${isExpanded ? "border-accent bg-accent-soft" : ""}`}
                      >
                        <div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
                          <button
                            type="button"
                            className="flex min-w-0 flex-wrap items-center gap-2 text-left font-medium text-ink hover:underline hover:text-accent-dark"
                            aria-expanded={isExpanded}
                            onClick={() => setExpandedPackagingId(isExpanded ? null : material.id)}
                          >
                            <span className="font-medium">{material.name}</span>
                            <span className="rounded-full border border-line bg-surface-2 px-1.5 py-0.5 text-xs font-medium text-ink-soft">
                              {material.components.length} component{material.components.length === 1 ? "" : "s"}
                            </span>
                          </button>
                          <span className="text-sm font-semibold text-accent-dark">
                            {totalCost !== null ? `${money(totalCost)} / drink` : "Add component costs"}
                          </span>
                        </div>
                        {isExpanded && (
                          <div className="mt-3 pt-3 border-t border-line space-y-2">
                            {material.description && (
                              <p className="text-sm text-muted">{material.description}</p>
                            )}
                            <ul className="divide-y divide-line">
                              {material.components.map((component) => {
                                const net = component.pack_size * (1 - component.waste_pct / 100);
                                const unitCost = component.pack_price > 0 && net > 0
                                  ? component.pack_price / net
                                  : null;
                                const componentTotal = unitCost === null
                                  ? null
                                  : unitCost * component.qty_needed;
                                return (
                                  <li key={component.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                                    <span className="min-w-0">
                                      <strong className="text-ink">{component.name}</strong>
                                      {component.description && <span className="ml-2 text-xs text-muted">{component.description}</span>}
                                      <span className="ml-2 text-xs text-muted">{fmt(component.qty_needed)} {unitLabel(component.unit)} / drink</span>
                                    </span>
                                    <span className="font-medium text-ink-soft">{componentTotal === null ? "Missing cost" : money(componentTotal)}</span>
                                  </li>
                                );
                              })}
                            </ul>
                            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line pt-2">
                              <span className="text-sm font-medium text-ink-soft">Set total per drink</span>
                              <strong className="text-accent-dark">{totalCost === null ? "Incomplete" : money(totalCost)}</strong>
                            </div>
                            <div className="mt-3 flex flex-wrap gap-2">
                              <button
                                type="button"
                                className="flex-1 bg-surface border border-line rounded-lg px-3 py-1.5 text-sm font-medium text-ink-soft hover:bg-surface-2 hover:text-ink transition-colors focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-1"
                                onClick={() => {
                                  setPackagingModal(material);
                                  setExpandedPackagingId(null);
                                }}
                              >
                                <IconEdit size={14} className="mr-1.5" /> Edit
                              </button>
                              <button
                                type="button"
                                className="text-red hover:bg-red-soft px-3 py-1.5 rounded-lg text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-red focus:ring-offset-1"
                                onClick={() => {
                                  setPendingDelete(material);
                                  setExpandedPackagingId(null);
                                }}
                              >
                                <IconTrash size={14} className="mr-1.5" /> Delete
                              </button>
                            </div>
                          </div>
                        )}
                      </article>
                    );
                  })}
                </div>
                <Pagination
                  page={safePage}
                  pageCount={pageCount}
                  total={activeTotal}
                  pageSize={PER_PAGE}
                  onPageChange={setPage}
                  label="sets"
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
          packagingSets={packaging}
          onClose={() => setPackagingModal(null)}
          onSaved={async (message) => {
            setPackagingModal(null);
            setToast(message);
            await load();
          }}
        />

        {toast && (
          <div className="mt-4 bg-accent-soft text-accent-dark rounded-lg px-3 py-2 text-sm font-medium">
            {toast}
          </div>
        )}

        <Modal
          open={Boolean(pendingDelete)}
          title="Remove packaging set?"
          subtitle="Past recipes keep their snapshot, so cost history is not affected."
          onClose={() => setPendingDelete(null)}
        >
          <p className="text-sm leading-relaxed">
            <strong className="text-ink">{pendingDelete?.name}</strong> will be removed from your
            packaging sets and from any recipes that use it.
          </p>
          <div className="mt-4 flex justify-end gap-2">
            <button className="bg-surface border border-line rounded-lg px-4 py-2 text-sm font-medium text-ink-soft hover:bg-surface-2 hover:text-ink transition-colors focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-1" onClick={() => setPendingDelete(null)}>
              Keep it
            </button>
            <button
              className="bg-red text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-red-dark transition-colors focus:outline-none focus:ring-2 focus:ring-red focus:ring-offset-2"
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
              Remove set
            </button>
          </div>
        </Modal>
      </section>
    </>
  );
}
