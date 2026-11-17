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
      <form onSubmit={submit} className="form">
        <label className="field">
          <span>Name</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Whole Milk"
            autoFocus
          />
        </label>

        <div className="form-grid">
          <label className="field">
            <span>Counted in</span>
            <select value={unit} onChange={(e) => setUnit(e.target.value as Unit)}>
              <option value="g">Grams (g)</option>
              <option value="ml">Millilitres (ml)</option>
              <option value="pcs">Pieces (pcs)</option>
            </select>
          </label>
          <label className="field">
            <span>Group</span>
            <input
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="Dairy"
              list="ingredient-groups"
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
          </label>
        </div>

        {category.trim().toLowerCase() === "base" && (
          <p className="field-hint">
            For a made-in-house base, enter the cost of one batch as the pack price and
            the batch yield as the pack size. Recipes can use it directly.
          </p>
        )}

        <div className="form-section">
          <div className="form-section-head">
            <h3>Purchase data</h3>
            <p>Used to turn a pack price into a cost per {unitLabel(unit)}.</p>
          </div>
          <div className="form-grid three">
            <label className="field">
              <span>Pack price</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={packPrice}
                onChange={(e) => setPackPrice(e.target.value)}
                placeholder="1100"
              />
            </label>
            <label className="field">
              <span>Pack size ({unitLabel(unit)})</span>
              <input
                type="number"
                min="0"
                step="any"
                value={packSize}
                onChange={(e) => setPackSize(e.target.value)}
                placeholder={unit === "pcs" ? "1" : "1000"}
              />
            </label>
            <label className="field">
              <span>Waste %</span>
              <input
                type="number"
                min="0"
                max="100"
                step="0.1"
                value={wastePct}
                onChange={(e) => setWastePct(e.target.value)}
              />
            </label>
          </div>
        </div>

        <p className="cost-inline-note">
          {unitCost !== null
            ? `Net recovery ${fmt(netRecovery, 2)} ${unitLabel(unit)} · ${unitMoney(unitCost)} per ${unitLabel(unit)}`
            : "Add a pack price and pack size to cost the recipes that use this."}
        </p>

        {error && <p className="form-error">{error}</p>}

        <div className="form-actions split">
          {ingredient ? (
            <button type="button" className="btn btn-ghost-danger" onClick={remove}>
              Delete
            </button>
          ) : (
            <span />
          )}
          <div className="form-actions-right">
            <button type="button" className="btn btn-quiet" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? "Saving…" : "Save ingredient"}
            </button>
          </div>
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

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");

    for (const r of rows) {
      if (!r.name.trim()) {
        setError("Give every packaging row a name.");
        return;
      }
      const { price, size } = rowStats(r);
      if (price > 0 && !(size > 0)) {
        setError("Enter how many pieces are in one pack.");
        return;
      }
      const qty = Number(r.qtyNeeded) || 1;
      if (!(qty > 0)) {
        setError("Quantity needed must be greater than zero.");
        return;
      }
    }

    setSaving(true);
    try {
      if (material) {
        const r = rows[0];
        const body: PackagingInput = {
          name: r.name.trim(),
          description: r.description.trim(),
          unit: r.unit,
          pack_price: Number(r.packPrice) || 0,
          pack_size: Number(r.packSize) || 1,
          qty_needed: Number(r.qtyNeeded) || 1,
          waste_pct: 0,
        };
        await api.updatePackaging(material.id, body);
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

  const remove = async () => {
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
        : "Edit a pack of cups, lids, straws or bags."}
      onClose={onClose}
      wide
    >
      <form onSubmit={submit} className="form">
        {material ? (
          <>
            <label className="field">
              <span>Name</span>
              <input
                value={rows[0].name}
                onChange={(e) => updateField(rows[0].id, "name", e.target.value)}
                autoFocus
              />
            </label>
            <label className="field">
              <span>Brand / description</span>
              <input
                value={rows[0].description}
                onChange={(e) => updateField(rows[0].id, "description", e.target.value)}
              />
            </label>
            <div className="form-grid">
              <label className="field">
                <span>Unit</span>
                <select
                  value={rows[0].unit}
                  onChange={(e) => updateField(rows[0].id, "unit", e.target.value as Unit)}
                >
                  <option value="pcs">Pieces (pcs)</option>
                  <option value="g">Grams (g)</option>
                  <option value="ml">Millilitres (ml)</option>
                </select>
              </label>
            </div>
            <div className="form-section">
              <div className="form-section-head">
                <h3>Purchase data</h3>
                <p>Used to turn a pack price into a cost per piece.</p>
              </div>
              <div className="form-grid three">
                <label className="field">
                  <span>Pack price</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={rows[0].packPrice}
                    onChange={(e) => updateField(rows[0].id, "packPrice", e.target.value)}
                  />
                </label>
                <label className="field">
                  <span>Pack size</span>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={rows[0].packSize}
                    onChange={(e) => updateField(rows[0].id, "packSize", e.target.value)}
                  />
                </label>
                <label className="field">
                  <span>Qty needed per drink</span>
                  <input
                    type="number"
                    min="0.01"
                    step="any"
                    value={rows[0].qtyNeeded}
                    onChange={(e) => updateField(rows[0].id, "qtyNeeded", e.target.value)}
                  />
                </label>
              </div>
            </div>
            <div className="form-actions split">
              <button type="button" className="btn btn-ghost-danger" onClick={remove}>
                Delete
              </button>
              <div className="form-actions-right">
                <button type="button" className="btn btn-quiet" onClick={onClose}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? "Saving…" : "Save packaging"}
                </button>
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="packaging-rows-table">
              <table>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Brand / description</th>
                    <th>Pack price</th>
                    <th>Pack size</th>
                    <th>Unit</th>
                    <th>Price / unit</th>
                    <th>Qty / drink</th>
                    <th>Total</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => {
                    const { size, pricePerUnit, total } = rowStats(r);
                    return (
                      <tr key={r.id} className="packaging-row">
                        <td>
                          <input
                            value={r.name}
                            onChange={(e) => updateField(r.id, "name", e.target.value)}
                            placeholder="16 oz cup"
                          />
                        </td>
                        <td>
                          <input
                            value={r.description}
                            onChange={(e) => updateField(r.id, "description", e.target.value)}
                            placeholder="U-cup"
                          />
                        </td>
                        <td className="numeric">
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={r.packPrice}
                            onChange={(e) => updateField(r.id, "packPrice", e.target.value)}
                          />
                        </td>
                        <td className="numeric">
                          <input
                            type="number"
                            min="0"
                            step="any"
                            value={r.packSize}
                            onChange={(e) => updateField(r.id, "packSize", e.target.value)}
                          />
                        </td>
                        <td>
                          <select
                            value={r.unit}
                            onChange={(e) => updateField(r.id, "unit", e.target.value as Unit)}
                          >
                            <option value="pcs">pcs</option>
                            <option value="g">g</option>
                            <option value="ml">ml</option>
                          </select>
                        </td>
                        <td className="numeric">{size > 0 ? money(pricePerUnit) : "—"}</td>
                        <td className="numeric">
                          <input
                            type="number"
                            min="0.01"
                            step="any"
                            value={r.qtyNeeded}
                            onChange={(e) => updateField(r.id, "qtyNeeded", e.target.value)}
                          />
                        </td>
                        <td className="numeric">{money(total)}</td>
                        <td>
                          <button
                            type="button"
                            className="btn btn-ghost-danger btn-sm"
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
              <div className="packaging-grand-total">
                <span>Grand total</span>
                <span>{money(grandTotal)}</span>
              </div>
            </div>
            <div className="form-actions split">
              <button type="button" className="btn btn-quiet" onClick={addRow}>
                + Add another entry
              </button>
              <div className="form-actions-right">
                <button type="button" className="btn btn-quiet" onClick={onClose}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? "Saving…" : "Save all"}
                </button>
              </div>
            </div>
          </>
        )}
        {error && <p className="form-error">{error}</p>}
      </form>
    </Modal>
  );
}
