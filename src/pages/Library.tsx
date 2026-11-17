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
            className="bg-ink text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-accent-dark transition-colors focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2"
            onClick={() =>
              tab === "ingredients"
                ? setIngredientModal("new")
                : setPackagingModal("new")
            }
          >
            <IconPlus size={17} className="mr-1.5" /> Add{" "}
            {tab === "ingredients" ? "ingredient" : "packaging"}
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
          placeholder="Search ingredients, groups, packaging…"
          label="Search the costing library"
        />
        <p className="min-w-0 text-sm leading-relaxed text-muted sm:flex-1">
          {query
            ? `${totalMatches} result${totalMatches === 1 ? "" : "s"} for “${debouncedSearch.trim()}”`
            : `${ingredients.length} ingredients · ${packaging.length} packaging`}
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
            : "Cups, lids, straws and bags are costed per piece. Price per piece × quantity needed = packaging cost per drink."}
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
                <p className="text-muted">{query ? "No packaging materials match this search." : "No packaging materials yet."}</p>
                <button
                  className="bg-ink text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-accent-dark transition-colors focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2"
                  onClick={() => (query ? setSearch("") : setPackagingModal("new"))}
                >
                  {query ? "Clear search" : "Add the first material"}
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
                        className={`border border-line rounded-lg bg-surface p-4 cursor-pointer transition-all hover:border-line-strong hover:bg-surface-2 ${isExpanded ? "border-accent bg-accent-soft" : ""}`}
                        onClick={() => {
                          if (isExpanded) setExpandedPackagingId(null);
                          else setExpandedPackagingId(material.id);
                        }}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <button
                            type="button"
                            className="flex items-center gap-2 text-left font-medium text-ink hover:underline hover:text-accent-dark"
                            aria-expanded={isExpanded}
                            onClick={(e) => {
                              e.stopPropagation();
                              if (isExpanded) setExpandedPackagingId(null);
                              else setExpandedPackagingId(material.id);
                            }}
                          >
                            <span className="font-medium">{material.name}</span>
                            <span className="px-1.5 py-0.5 border border-line rounded-full text-xs font-medium text-ink-soft bg-surface-2">
                              {unitLabel(material.unit)}
                            </span>
                          </button>
                          <span className="text-sm font-medium text-accent-dark whitespace-nowrap">
                            {totalCost !== null ? money(totalCost) : "—"}
                          </span>
                        </div>
                        {isExpanded && (
                          <div className="mt-3 pt-3 border-t border-line space-y-2">
                            {material.description && (
                              <p className="text-sm text-muted">{material.description}</p>
                            )}
                            <div className="grid grid-cols-1 gap-3 text-xs sm:grid-cols-3">
                              <div className="flex flex-col gap-0.5">
                                <span className="text-muted uppercase tracking-wider text-[10px]">Pack price</span>
                                <span className="text-ink font-medium">
                                  {material.pack_price > 0 ? money(material.pack_price) : "—"}
                                </span>
                              </div>
                              <div className="flex flex-col gap-0.5">
                                <span className="text-muted uppercase tracking-wider text-[10px]">Qty per drink</span>
                                <span className="text-ink font-medium">{fmt(material.qty_needed)}</span>
                              </div>
                              <div className="flex flex-col gap-0.5">
                                <span className="text-muted uppercase tracking-wider text-[10px]">Cost per drink</span>
                                <span className="text-accent-dark font-medium">
                                  {totalCost !== null ? money(totalCost) : "—"}
                                </span>
                              </div>
                            </div>
                            <div className="flex gap-2 mt-3">
                              <button
                                type="button"
                                className="flex-1 bg-surface border border-line rounded-lg px-3 py-1.5 text-sm font-medium text-ink-soft hover:bg-surface-2 hover:text-ink transition-colors focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-1"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setPackagingModal(material);
                                  setExpandedPackagingId(null);
                                }}
                              >
                                <IconEdit size={14} className="mr-1.5" /> Edit
                              </button>
                              <button
                                type="button"
                                className="text-red hover:bg-red-soft px-3 py-1.5 rounded-lg text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-red focus:ring-offset-1"
                                onClick={(e) => {
                                  e.stopPropagation();
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
                <div className="mt-4 pt-3 border-t border-line flex items-center justify-between">
                  <span className="text-sm font-medium text-ink-soft">Total packaging cost per drink:</span>
                  <span className="text-sm font-bold text-accent-dark">
                    {money(
                      pagedPackaging.reduce(
                        (sum, m) => sum + (packagingTotalCost(m) ?? 0),
                        0,
                      ),
                    )}
                  </span>
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

        {toast && (
          <div className="mt-4 bg-accent-soft text-accent-dark rounded-lg px-3 py-2 text-sm font-medium">
            {toast}
          </div>
        )}

        <Modal
          open={Boolean(pendingDelete)}
          title="Remove packaging?"
          subtitle="Past recipes keep their snapshot, so cost history is not affected."
          onClose={() => setPendingDelete(null)}
        >
          <p className="text-sm leading-relaxed">
            <strong className="text-ink">{pendingDelete?.name}</strong> will be removed from your
            packaging list and from any recipes that use it.
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
              Remove packaging
            </button>
          </div>
        </Modal>
      </section>
    </>
  );
}
