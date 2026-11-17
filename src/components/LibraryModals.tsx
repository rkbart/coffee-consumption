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
  onClose,
  onSaved,
}: {
  editing: PackagingMaterial | "new" | null;
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

  const rowFromMaterial = (m: PackagingMaterial): Row => ({
    id: crypto.randomUUID(),
    name: m.name,
    description: m.description,
    unit: m.unit,
    packPrice: String(m.pack_price),
    packSize: String(m.pack_size),
    qtyNeeded: String(m.qty_needed),
  });

  const [rows, setRows] = useState<Row[]>(() =>
    material ? [rowFromMaterial(material)] : [emptyRow()],
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setRows(material ? [rowFromMaterial(material)] : [emptyRow()]);
  }, [material]);

  const addRow = () => setRows((prev) => [...prev, emptyRow()]);
  const removeRow = (id: string) => setRows((prev) => prev.filter((r) => r.id !== id));

  const updateField = (id: string, field: keyof Row, value: string) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, [field]: value } : r)));
  };

  const rowStats = (r: Row) => {
    const price = Number(r.packPrice) || 0;
    const size = Number(r.packSize) || 0;
    const qty = Number(r.qtyNeeded) || 1;
    const pricePerUnit = size > 0 ? price / size : 0;
    const total = pricePerUnit * qty;
    return { price, size, qty, pricePerUnit, total };
  };

  const grandTotal = rows.reduce((sum, r) => sum + rowStats(r).total, 0);

  const validateRow = (r: Row): string | null => {
    if (!r.name.trim()) return "Give this row a name.";
    const { price, size } = rowStats(r);
    if (price > 0 && !(size > 0)) return "Enter how many pieces are in one pack.";
    const qty = Number(r.qtyNeeded) || 1;
    if (!(qty > 0)) return "Quantity needed must be greater than zero.";
    return null;
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");

    const errors = rows.map((r) => validateRow(r));
    const firstError = errors.find((e) => e !== null);
    if (firstError) {
      setError(firstError as string);
      return;
    }

    setSaving(true);
    try {
      if (material) {
        const first = rows[0];
        const body: PackagingInput = {
          name: first.name.trim(),
          description: first.description.trim(),
          unit: first.unit,
          pack_price: Number(first.packPrice) || 0,
          pack_size: Number(first.packSize) || 1,
          qty_needed: Number(first.qtyNeeded) || 1,
          waste_pct: 0,
        };
        await api.updatePackaging(material.id, body);
        for (const r of rows.slice(1)) {
          const extra: PackagingInput = {
            name: r.name.trim(),
            description: r.description.trim(),
            unit: r.unit,
            pack_price: Number(r.packPrice) || 0,
            pack_size: Number(r.packSize) || 1,
            qty_needed: Number(r.qtyNeeded) || 1,
            waste_pct: 0,
          };
          await api.createPackaging(extra);
        }
        onSaved(`${body.name} updated`);
      } else {
        for (const r of rows) {
          const body: PackagingInput = {
            name: r.name.trim(),
            description: r.description.trim(),
            unit: r.unit,
            pack_price: Number(r.packPrice) || 0,
            pack_size: Number(r.packSize) || 1,
            qty_needed: Number(r.qtyNeeded) || 1,
            waste_pct: 0,
          };
          await api.createPackaging(body);
        }
        onSaved(`${rows.length} packaging${rows.length === 1 ? "" : "s"} added`);
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
      title={isNew ? "New packaging" : "Edit packaging"}
      subtitle={isNew
        ? "Add one or more packaging materials at once. Total = (pack price ÷ pack size) × qty needed per drink."
        : `Editing ${material?.name}. Changes save to this material and every recipe that uses it.`}
      onClose={onClose}
      wide
    >
      <form onSubmit={submit} className="space-y-3">
        {error && <p className="text-sm text-red">{error}</p>}
        <div className="border border-line rounded-lg overflow-x-auto overflow-y-hidden">
          <div className="min-w-[640px] border-b border-line/50">
            <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="text-left">
                <th className="pb-2 font-medium text-ink-soft text-[10px] uppercase tracking-wider">Name</th>
                <th className="pb-2 font-medium text-ink-soft text-[10px] uppercase tracking-wider">Brand / description</th>
                <th className="pb-2 font-medium text-ink-soft text-[10px] uppercase tracking-wider text-right">Pack price</th>
                <th className="pb-2 font-medium text-ink-soft text-[10px] uppercase tracking-wider text-right">Pack size</th>
                <th className="pb-2 font-medium text-ink-soft text-[10px] uppercase tracking-wider">Unit</th>
                <th className="pb-2 font-medium text-ink-soft text-[10px] uppercase tracking-wider text-right">Price / unit</th>
                <th className="pb-2 font-medium text-ink-soft text-[10px] uppercase tracking-wider text-right">Qty / drink</th>
                <th className="pb-2 font-medium text-ink-soft text-[10px] uppercase tracking-wider text-right">Total</th>
                <th className="pb-2 text-right w-12" />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const { size: rowSize, pricePerUnit: rowPricePerUnit, total: rowTotal } = rowStats(r);
                const rowError = validateRow(r);
                return (
                  <tr key={r.id} className={`border-b border-line/50 ${rowError ? "bg-red-soft/50" : ""}`}>
                    <td className="pb-2">
                      <input
                        value={r.name}
                        onChange={(e) => updateField(r.id, "name", e.target.value)}
                        placeholder="16 oz cup"
                        autoFocus={rows.length === 1 && r.name === "" && isNew}
                        className="w-full bg-transparent border-none outline-none text-ink focus:ring-0"
                      />
                    </td>
                    <td className="pb-2">
                      <input
                        value={r.description}
                        onChange={(e) => updateField(r.id, "description", e.target.value)}
                        placeholder="U-cup"
                        className="w-full bg-transparent border-none outline-none text-ink focus:ring-0"
                      />
                    </td>
                    <td className="pb-2 text-right">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={r.packPrice}
                        onChange={(e) => updateField(r.id, "packPrice", e.target.value)}
                        className="w-full bg-transparent border-none outline-none text-ink text-right focus:ring-0"
                      />
                    </td>
                    <td className="pb-2 text-right">
                      <input
                        type="number"
                        min="0"
                        step="any"
                        value={r.packSize}
                        onChange={(e) => updateField(r.id, "packSize", e.target.value)}
                        className="w-full bg-transparent border-none outline-none text-ink text-right focus:ring-0"
                      />
                    </td>
                    <td className="pb-2">
                      <select
                        value={r.unit}
                        onChange={(e) => updateField(r.id, "unit", e.target.value as Unit)}
                        className="w-full bg-transparent border-none outline-none text-ink focus:ring-0"
                      >
                        <option value="pcs">pcs</option>
                        <option value="g">g</option>
                        <option value="ml">ml</option>
                      </select>
                    </td>
                    <td className="pb-2 text-right">
                      {rowSize > 0 ? money(rowPricePerUnit) : "—"}
                    </td>
                    <td className="pb-2 text-right">
                      <input
                        type="number"
                        min="0.01"
                        step="any"
                        value={r.qtyNeeded}
                        onChange={(e) => updateField(r.id, "qtyNeeded", e.target.value)}
                        className="w-full bg-transparent border-none outline-none text-ink text-right focus:ring-0"
                      />
                    </td>
                    <td className="pb-2 text-right font-medium text-accent-dark">
                      {money(rowTotal)}
                    </td>
                    <td className="pb-2 text-right">
                      <button
                        type="button"
                        className="p-1 hover:bg-red-soft rounded-sm text-muted hover:text-red focus:outline-none focus:ring-2 focus:ring-red focus:ring-offset-1"
                        onClick={() => removeRow(r.id)}
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>
          <div className="px-4 py-2 border-t border-line flex items-center justify-between">
            <span className="text-sm font-medium text-ink-soft">Grand total</span>
            <span className="text-sm font-bold text-accent-dark">{money(grandTotal)}</span>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-2 pt-3 border-t border-line sm:justify-between sm:items-center">
          <button
            type="button"
            className="bg-surface border border-line rounded-lg px-3 py-1.5 text-sm font-medium text-ink-soft hover:bg-surface-2 hover:text-ink transition-colors focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-1"
            onClick={addRow}
          >
            + Add another entry
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
              {saving ? "Saving…" : material ? "Save changes" : "Save all"}
            </button>
          </div>
        </div>
      </form>
    </Modal>
  );
}
