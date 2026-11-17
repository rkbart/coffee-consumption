import { useEffect, useState, type FormEvent } from "react";
import Modal from "./Modal";
import {
  api,
  type IngredientInput,
  type PackagingInput,
} from "../api";
import type { Ingredient, PackagingMaterial, Unit } from "../types";
import { fmt, unitLabel, unitMoney, money } from "../lib";

export function IngredientModal({
  editing,
  onClose,
  onSaved,
}: {
  editing: Ingredient | "new" | null;
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const isNew = editing === "new";
  const ingredient = editing && editing !== "new" ? editing : null;

  const [name, setName] = useState("");
  const [unit, setUnit] = useState<Unit>("g");
  const [category, setCategory] = useState("Coffee");
  const [packPrice, setPackPrice] = useState("");
  const [packSize, setPackSize] = useState("");
  const [wastePct, setWastePct] = useState("0");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!editing) return;
    setName(ingredient?.name ?? "");
    setUnit(ingredient?.unit ?? "g");
    setCategory(ingredient?.category ?? "Coffee");
    setPackPrice(ingredient?.pack_price ? String(ingredient.pack_price) : "");
    setPackSize(ingredient?.pack_size ? String(ingredient.pack_size) : "");
    setWastePct(String(ingredient?.waste_pct ?? 0));
    setError("");
  }, [editing, ingredient]);

  const price = Number(packPrice) || 0;
  const size = Number(packSize) || 0;
  const waste = Number(wastePct) || 0;
  const netRecovery = size * (1 - waste / 100);
  const unitCost = price > 0 && netRecovery > 0 ? price / netRecovery : null;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!name.trim()) {
      setError("Give the ingredient a name.");
      return;
    }
    if (packPrice !== "" && !(size > 0)) {
      setError("Enter how many grams, millilitres or pieces are in one pack.");
      return;
    }
    setSaving(true);
    setError("");
    const body: IngredientInput = {
      name: name.trim(),
      unit,
      category: category.trim() || "Other",
      pack_price: price,
      pack_size: size > 0 ? size : 1,
      waste_pct: waste,
    };
    try {
      if (ingredient) await api.updateIngredient(ingredient.id, body);
      else await api.createIngredient(body);
      onSaved(ingredient ? `${body.name} updated` : `${body.name} added`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save ingredient");
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!ingredient) return;
    try {
      await api.deleteIngredient(ingredient.id);
      onSaved(`${ingredient.name} removed`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete ingredient");
    }
  };

  return (
    <Modal
      open={Boolean(editing)}
      title={isNew ? "New ingredient" : "Edit ingredient"}
      subtitle="How you buy it, and the unit you count it in at open and close."
      onClose={onClose}
    >
      <form onSubmit={submit} className="space-y-3">
        <div className="space-y-1.5">
          <label className="block text-xs font-semibold text-ink-soft uppercase tracking-wider">Name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Whole Milk"
            autoFocus
            className="bg-surface border border-line rounded-lg px-3 py-2 text-ink focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-1"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-ink-soft uppercase tracking-wider">Counted in</label>
            <select
              value={unit}
              onChange={(e) => setUnit(e.target.value as Unit)}
              className="bg-surface border border-line rounded-lg px-3 py-2 text-ink focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-1"
            >
              <option value="g">Grams (g)</option>
              <option value="ml">Millilitres (ml)</option>
              <option value="pcs">Pieces (pcs)</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-ink-soft uppercase tracking-wider">Group</label>
            <input
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="Dairy"
              list="ingredient-groups"
              className="bg-surface border border-line rounded-lg px-3 py-2 text-ink focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-1"
            />
            <datalist id="ingredient-groups">
              <option value="Coffee" />
              <option value="Dairy" />
              <option value="Syrup" />
              <option value="Tea" />
              <option value="Base" />
              <option value="Packaging" />
              <option value="Other" />
            </datalist>
          </div>
        </div>

        {category.trim().toLowerCase() === "base" && (
          <p className="text-xs text-muted">
            For a made-in-house base, enter the cost of one batch as the pack price and
            the batch yield as the pack size. Recipes can use it directly.
          </p>
        )}

        <div className="border border-line rounded-lg p-3 space-y-3">
          <div className="flex items-center justify-between mb-1">
            <h3 className="text-xs font-serif font-medium text-ink uppercase tracking-wider">Purchase data</h3>
            <span className="text-xs text-muted">Used to turn a pack price into a cost per {unitLabel(unit)}.</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-ink-soft uppercase tracking-wider">Pack price</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={packPrice}
                onChange={(e) => setPackPrice(e.target.value)}
                placeholder="1100"
                className="bg-surface border border-line rounded-lg px-3 py-2 text-ink focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-1"
              />
            </div>
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-ink-soft uppercase tracking-wider">Pack size</label>
              <input
                type="number"
                min="0"
                step="any"
                value={packSize}
                onChange={(e) => setPackSize(e.target.value)}
                placeholder={unit === "pcs" ? "1" : "1000"}
                className="bg-surface border border-line rounded-lg px-3 py-2 text-ink focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-1"
              />
            </div>
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-ink-soft uppercase tracking-wider">Waste %</label>
              <input
                type="number"
                min="0"
                max="100"
                step="0.1"
                value={wastePct}
                onChange={(e) => setWastePct(e.target.value)}
                className="bg-surface border border-line rounded-lg px-3 py-2 text-ink focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-1"
              />
            </div>
          </div>
        </div>

        <p className="text-sm text-muted">
          {unitCost !== null
            ? `Net recovery ${fmt(netRecovery, 2)} ${unitLabel(unit)} · ${unitMoney(unitCost)} per ${unitLabel(unit)}`
            : "Add a pack price and pack size to cost the recipes that use this."}
        </p>

        {error && <p className="text-sm text-red">{error}</p>}

        <div className="flex flex-col sm:flex-row gap-2 pt-3 border-t border-line sm:justify-end">
          {ingredient ? (
            <button
              type="button"
              className="text-red hover:bg-red-soft px-3 py-1.5 rounded-lg text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-red focus:ring-offset-1"
              onClick={remove}
            >
              Delete
            </button>
          ) : null}
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
            {saving ? "Saving…" : "Save ingredient"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export function PackagingModal({
  editing,
  packagingSets,
  onClose,
  onSaved,
}: {
  editing: PackagingMaterial | "new" | null;
  packagingSets: PackagingMaterial[];
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const isNew = editing === "new";
  const material = editing && editing !== "new" ? editing : null;

  type Row = {
    id: string;
    name: string;
    description: string;
    unit: Unit;
    packPrice: string;
    packSize: string;
    qtyNeeded: string;
  };

  const emptyRow = (): Row => ({
    id: crypto.randomUUID(),
    name: "",
    description: "",
    unit: "pcs",
    packPrice: "",
    packSize: "",
    qtyNeeded: "1",
  });

  const rowFromComponent = (m: PackagingMaterial["components"][number]): Row => ({
    id: crypto.randomUUID(),
    name: m.name,
    description: m.description,
    unit: m.unit,
    packPrice: String(m.pack_price),
    packSize: String(m.pack_size),
    qtyNeeded: String(m.qty_needed),
  });

  const [setName, setSetName] = useState("");
  const [setDescription, setSetDescription] = useState("");
  const [rows, setRows] = useState<Row[]>(() =>
    material ? material.components.map(rowFromComponent) : [emptyRow()],
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [mergeIds, setMergeIds] = useState<number[]>([]);

  useEffect(() => {
    setSetName(material?.name ?? "");
    setSetDescription(material?.description ?? "");
    setRows(material ? material.components.map(rowFromComponent) : [emptyRow()]);
    setMergeIds([]);
    setError("");
  }, [material]);

  const addRow = () => setRows((prev) => [...prev, emptyRow()]);
  const removeRow = (id: string) => setRows((prev) => prev.filter((r) => r.id !== id));

  const updateField = (id: string, field: keyof Row, value: string) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, [field]: value } : r)));
  };

  const rowStats = (r: Row) => {
    const price = Number(r.packPrice) || 0;
    const size = Number(r.packSize) || 0;
    const qty = Number(r.qtyNeeded);
    const pricePerUnit = size > 0 ? price / size : 0;
    const total = pricePerUnit * qty;
    return { price, size, qty, pricePerUnit, total };
  };

  const grandTotal = rows.reduce((sum, r) => sum + rowStats(r).total, 0);
  const totalComplete = rows.length > 0 && rows.every((row) => {
    const { price, size, qty } = rowStats(row);
    return price > 0 && size > 0 && qty > 0;
  });

  const validateRow = (r: Row): string | null => {
    if (!r.name.trim()) return "Give each component a name.";
    const { price, size } = rowStats(r);
    if (price > 0 && !(size > 0)) return "Enter how many pieces are in one pack.";
    const qty = Number(r.qtyNeeded);
    if (!(qty > 0)) return "Quantity needed must be greater than zero.";
    return null;
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");

    if (!setName.trim()) {
      setError("Give this packaging set a name, such as Medium.");
      return;
    }
    if (rows.length === 0) {
      setError("Add at least one component to this packaging set.");
      return;
    }

    const errors = rows.map((r) => validateRow(r));
    const firstError = errors.find((e) => e !== null);
    if (firstError) {
      setError(firstError as string);
      return;
    }

    setSaving(true);
    try {
      const body: PackagingInput = {
        name: setName.trim(),
        description: setDescription.trim(),
        components: rows.map((row) => ({
          name: row.name.trim(),
          description: row.description.trim(),
          unit: row.unit,
          pack_price: Number(row.packPrice) || 0,
          pack_size: Number(row.packSize) || 1,
          qty_needed: Number(row.qtyNeeded),
          waste_pct: 0,
        })),
      };
      if (material) {
        await api.updatePackaging(material.id, body);
        if (mergeIds.length > 0) await api.mergePackaging(material.id, mergeIds);
        onSaved(mergeIds.length > 0
          ? `${mergeIds.length} packaging set${mergeIds.length === 1 ? "" : "s"} merged into ${body.name}`
          : `${body.name} packaging set updated`);
      } else {
        const created = await api.createPackaging(body);
        if (mergeIds.length > 0) await api.mergePackaging(created.id, mergeIds);
        onSaved(mergeIds.length > 0
          ? `${mergeIds.length} packaging set${mergeIds.length === 1 ? "" : "s"} merged into ${body.name}`
          : `${body.name} packaging set added`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save packaging");
    } finally {
      setSaving(false);
    }
  };

  const removeMaterial = async () => {
    if (!material) return;
    try {
      await api.deletePackaging(material.id);
      onSaved(`${material.name} removed`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete packaging");
    }
  };

  return (
    <Modal
      open={Boolean(editing)}
      title={isNew ? "New packaging set" : "Edit packaging set"}
      subtitle="Name a set for a drink size, then add each component and the quantity used per drink. Recipes use the combined set cost."
      onClose={onClose}
      wide
    >
      <form onSubmit={submit} className="space-y-3">
        {error && <p className="text-sm text-red">{error}</p>}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="space-y-1">
            <span className="block text-xs font-semibold uppercase tracking-wider text-ink-soft">Packaging set name</span>
            <input
              value={setName}
              onChange={(event) => setSetName(event.target.value)}
              placeholder="Medium"
              autoFocus={isNew}
              className="w-full min-w-0 rounded-lg border border-line bg-surface px-3 py-2 text-ink focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </label>
          <label className="space-y-1">
            <span className="block text-xs font-semibold uppercase tracking-wider text-ink-soft">Description <span className="font-normal normal-case text-muted">(optional)</span></span>
            <input
              value={setDescription}
              onChange={(event) => setSetDescription(event.target.value)}
              placeholder="For medium size drinks"
              className="w-full min-w-0 rounded-lg border border-line bg-surface px-3 py-2 text-ink focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </label>
        </div>
        {packagingSets.some((set) => set.id !== material?.id) && (
          <section className="space-y-2 rounded-lg border border-line bg-surface-2 p-3">
            <div>
              <h3 className="text-sm font-semibold text-ink">Merge existing packaging entries</h3>
              <p className="text-xs leading-relaxed text-muted">
                Select old one-item entries to move into {setName.trim() || "this set"}. Their recipes will be updated to use this combined set.
              </p>
            </div>
            <div className="grid max-h-36 grid-cols-1 gap-1 overflow-y-auto sm:grid-cols-2">
              {packagingSets.filter((set) => set.id !== material?.id).map((set) => (
                <label key={set.id} className="flex min-w-0 items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-surface">
                  <input
                    type="checkbox"
                    checked={mergeIds.includes(set.id)}
                    onChange={(event) => setMergeIds((current) => event.target.checked
                      ? [...current, set.id]
                      : current.filter((id) => id !== set.id))}
                    className="accent-accent"
                  />
                  <span className="min-w-0 truncate font-medium text-ink">{set.name}</span>
                  <span className="shrink-0 text-xs text-muted">{set.components.length} item{set.components.length === 1 ? "" : "s"}</span>
                </label>
              ))}
            </div>
          </section>
        )}
        <div className="space-y-3">
          <div className="flex flex-wrap items-end justify-between gap-2 border-b border-line pb-2">
            <div>
              <h3 className="text-sm font-semibold text-ink">Components in this set</h3>
              <p className="text-xs text-muted">Each row is included when a recipe selects {setName.trim() || "this set"}.</p>
            </div>
            <span className="text-xs font-medium text-ink-soft">Component cost = pack price ÷ pack size × quantity</span>
          </div>
          {rows.map((r, index) => {
            const { size, price, qty, pricePerUnit, total } = rowStats(r);
            const rowError = validateRow(r);
            return (
              <fieldset key={r.id} className={`min-w-0 rounded-lg border p-3 ${rowError ? "border-red bg-red-soft/30" : "border-line"}`}>
                <legend className="px-1 text-sm font-semibold text-ink">Component {index + 1}</legend>
                <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-[1.1fr_1fr_0.8fr_1fr_0.8fr_0.8fr_auto] xl:items-end">
                  <label className="min-w-0 space-y-1">
                    <span className="block text-xs font-medium text-ink-soft">Component name</span>
                    <input value={r.name} onChange={(e) => updateField(r.id, "name", e.target.value)} placeholder="16 oz cup" className="w-full min-w-0 rounded-lg border border-line bg-surface px-3 py-2 text-ink" />
                  </label>
                  <label className="min-w-0 space-y-1">
                    <span className="block text-xs font-medium text-ink-soft">Description</span>
                    <input value={r.description} onChange={(e) => updateField(r.id, "description", e.target.value)} placeholder="Optional" className="w-full min-w-0 rounded-lg border border-line bg-surface px-3 py-2 text-ink" />
                  </label>
                  <label className="min-w-0 space-y-1">
                    <span className="block text-xs font-medium text-ink-soft">Pack price</span>
                    <input type="number" min="0" step="0.01" value={r.packPrice} onChange={(e) => updateField(r.id, "packPrice", e.target.value)} placeholder="0" className="w-full min-w-0 rounded-lg border border-line bg-surface px-3 py-2 text-ink" />
                  </label>
                  <label className="min-w-0 space-y-1">
                    <span className="block text-xs font-medium text-ink-soft">Pack size / unit</span>
                    <div className="flex min-w-0 gap-2">
                      <input type="number" min="0" step="any" value={r.packSize} onChange={(e) => updateField(r.id, "packSize", e.target.value)} placeholder="1" className="w-full min-w-0 flex-1 rounded-lg border border-line bg-surface px-3 py-2 text-ink" />
                      <select aria-label="Pack unit" value={r.unit} onChange={(e) => updateField(r.id, "unit", e.target.value as Unit)} className="w-20 shrink-0 rounded-lg border border-line bg-surface px-2 py-2 text-ink">
                        <option value="pcs">pcs</option>
                        <option value="g">g</option>
                        <option value="ml">ml</option>
                      </select>
                    </div>
                  </label>
                  <label className="min-w-0 space-y-1">
                    <span className="block text-xs font-medium text-ink-soft">Qty needed / drink</span>
                    <input type="number" min="0.01" step="any" value={r.qtyNeeded} onChange={(e) => updateField(r.id, "qtyNeeded", e.target.value)} className="w-full min-w-0 rounded-lg border border-line bg-surface px-3 py-2 text-ink" />
                  </label>
                  <div className="min-w-0 rounded-lg bg-surface-2 px-3 py-2 xl:min-h-[42px]">
                    <span className="block text-[10px] font-medium uppercase tracking-wide text-ink-soft">Row total</span>
                    <strong className="block truncate text-sm text-accent-dark" title={size > 0 && price > 0 && qty > 0 ? `${unitMoney(pricePerUnit)} per ${unitLabel(r.unit)}` : undefined}>
                      {size > 0 && price > 0 && qty > 0 ? money(total) : "—"}
                    </strong>
                  </div>
                  <button type="button" className="rounded-lg px-3 py-2 text-sm font-medium text-red hover:bg-red-soft" onClick={() => removeRow(r.id)}>Remove</button>
                  <p className="text-xs text-muted sm:col-span-2 xl:col-span-7">
                    {size > 0 ? `${unitMoney(pricePerUnit)} per ${unitLabel(r.unit)} × ${fmt(qty)} needed` : "Enter pack price and pack size to calculate this row."}
                    {rowError && <span className="ml-2 text-red">{rowError}</span>}
                  </p>
                </div>
              </fieldset>
            );
          })}
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line px-2 pt-3">
            <span className="text-sm font-medium text-ink-soft">Total packaging cost for {setName.trim() || "this set"} / drink</span>
            <span className="text-sm font-bold text-accent-dark">{totalComplete ? money(grandTotal) : "Add all component costs"}</span>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-2 pt-3 border-t border-line sm:justify-between sm:items-center">
          <button
            type="button"
            className="bg-surface border border-line rounded-lg px-3 py-1.5 text-sm font-medium text-ink-soft hover:bg-surface-2 hover:text-ink transition-colors focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-1"
            onClick={addRow}
          >
            + Add component row
          </button>
          <div className="flex flex-col sm:flex-row gap-2 sm:justify-end">
            {material && (
              <button
                type="button"
                className="text-red hover:bg-red-soft px-3 py-1.5 rounded-lg text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-red focus:ring-offset-1"
                onClick={removeMaterial}
              >
                Delete
              </button>
            )}
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
              {saving ? "Saving…" : "Save set"}
            </button>
          </div>
        </div>
      </form>
    </Modal>
  );
}
