import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import Modal from "./Modal";
import {
  api,
  type IngredientInput,
  type PackagingInput,
} from "../api";
import type { Ingredient, PackagingMaterial, PackagingSet, Unit } from "../types";
import { fmt, unitLabel, unitMoney, money, round2 } from "../lib";
import { IconPlus, IconTrash } from "./Icons";

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

  const [name, setName] = useState("");
  const [unit, setUnit] = useState<Unit>("pcs");
  const [packPrice, setPackPrice] = useState("");
  const [packSize, setPackSize] = useState("");
  const [wastePct, setWastePct] = useState("0");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!editing) return;
    setName(material?.name ?? "");
    setUnit(material?.unit ?? "pcs");
    setPackPrice(material?.pack_price ? String(material.pack_price) : "");
    setPackSize(material?.pack_size ? String(material.pack_size) : "");
    setWastePct(String(material?.waste_pct ?? 0));
    setError("");
  }, [editing, material]);

  const price = Number(packPrice) || 0;
  const size = Number(packSize) || 0;
  const waste = Number(wastePct) || 0;
  const netRecovery = size * (1 - waste / 100);
  const unitCost = price > 0 && netRecovery > 0 ? price / netRecovery : null;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!name.trim()) {
      setError("Give the packaging a name.");
      return;
    }
    if (packPrice !== "" && !(size > 0)) {
      setError("Enter how many pieces are in one pack.");
      return;
    }
    setSaving(true);
    setError("");
    const body: PackagingInput = {
      name: name.trim(),
      unit,
      pack_price: price,
      pack_size: size > 0 ? size : 1,
      waste_pct: waste,
    };
    try {
      if (material) await api.updatePackaging(material.id, body);
      else await api.createPackaging(body);
      onSaved(material ? `${body.name} updated` : `${body.name} added`);
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
      subtitle="A pack of cups, lids, straws or bags, spread across the pieces it contains."
      onClose={onClose}
    >
      <form onSubmit={submit} className="form">
        <label className="field">
          <span>Name</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="16 oz cup"
            autoFocus
          />
        </label>

        <div className="form-grid">
          <label className="field">
            <span>Counted in</span>
            <select value={unit} onChange={(e) => setUnit(e.target.value as Unit)}>
              <option value="pcs">Pieces (pcs)</option>
              <option value="g">Grams (g)</option>
              <option value="ml">Millilitres (ml)</option>
            </select>
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

        <div className="form-section">
          <div className="form-section-head">
            <h3>Purchase data</h3>
            <p>Used to turn a pack price into a cost per {unitLabel(unit)}.</p>
          </div>
          <div className="form-grid">
            <label className="field">
              <span>Pack price</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={packPrice}
                onChange={(e) => setPackPrice(e.target.value)}
                placeholder="250"
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
                placeholder="50"
              />
            </label>
          </div>
        </div>

        <p className="cost-inline-note">
          {unitCost !== null
            ? `Net recovery ${fmt(netRecovery, 2)} ${unitLabel(unit)} · ${unitMoney(unitCost)} per ${unitLabel(unit)}`
            : "Add a pack price and pack size to cost this material."}
        </p>

        {error && <p className="form-error">{error}</p>}

        <div className="form-actions split">
          {material ? (
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
              {saving ? "Saving…" : "Save packaging"}
            </button>
          </div>
        </div>
      </form>
    </Modal>
  );
}

export function PackagingSetModal({
  editing,
  materials,
  onClose,
  onSaved,
}: {
  editing: PackagingSet | "new" | null;
  materials: PackagingMaterial[];
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const isNew = editing === "new";
  const set = editing && editing !== "new" ? editing : null;

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [items, setItems] = useState<{
    id: number | "new";
    packaging_id: number;
    qty_needed: string;
    notes: string;
  }[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!editing) return;
    setName(set?.name ?? "");
    setDescription(set?.description ?? "");
    setItems(
      set?.items.map((item) => ({
        id: item.id,
        packaging_id: item.packaging_id,
        qty_needed: String(item.qty_needed),
        notes: item.notes,
      })) ?? [],
    );
    setError("");
  }, [editing, set]);

  const addItem = () => {
    setItems([
      ...items,
      { id: "new", packaging_id: materials[0]?.id ?? 0, qty_needed: "1", notes: "" },
    ]);
  };

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const updateItem = (index: number, patch: Partial<{ packaging_id: number; qty_needed: string; notes: string }>) => {
    setItems((current) => current.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  };

  const setItemsCost = () => {
    return items.reduce((sum, item) => {
      const material = materials.find((m) => m.id === item.packaging_id);
      const net = (material?.pack_size ?? 0) * (1 - (material?.waste_pct ?? 0) / 100);
      const unitCost = material && material.pack_price > 0 && net > 0 ? material.pack_price / net : 0;
      return sum + unitCost * (Number(item.qty_needed) || 0);
    }, 0);
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!name.trim()) {
      setError("Give the set a name.");
      return;
    }
    if (items.length === 0) {
      setError("Add at least one packaging item to the set.");
      return;
    }
    for (const item of items) {
      if (!(Number(item.qty_needed) > 0)) {
        setError("Each item needs a quantity greater than zero.");
        return;
      }
    }
    setSaving(true);
    setError("");
    try {
      if (set) {
        await api.updatePackagingSet(set.id, { name: name.trim(), description: description.trim() });
        await apiDeleteSetItems(set.id);
        for (const item of items) {
          await api.createPackagingSetItem({
            set_id: set.id,
            packaging_id: item.packaging_id,
            qty_needed: Number(item.qty_needed) || 1,
            notes: item.notes.trim(),
            sort_order: 0,
          });
        }
        onSaved(`${name.trim()} updated`);
      } else {
        const created = await api.createPackagingSet({ name: name.trim(), description: description.trim() });
        for (const item of items) {
          await api.createPackagingSetItem({
            set_id: created.id,
            packaging_id: item.packaging_id,
            qty_needed: Number(item.qty_needed) || 1,
            notes: item.notes.trim(),
            sort_order: 0,
          });
        }
        onSaved(`${name.trim()} added`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save packaging set");
    } finally {
      setSaving(false);
    }
  };

  const apiDeleteSetItems = async (setId: number) => {
    const sets = await api.packagingSets();
    const current = sets.find((s) => s.id === setId);
    if (current) {
      for (const item of current.items) {
        await api.deletePackagingSetItem(item.id);
      }
    }
  };

  const removeSet = async () => {
    if (!set) return;
    try {
      await api.deletePackagingSet(set.id);
      onSaved(`${set.name} removed`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete set");
    }
  };

  const totalCost = setItemsCost();

  return (
    <Modal
      open={Boolean(editing)}
      title={isNew ? "New packaging set" : "Edit packaging set"}
      subtitle="A set of materials used together on one drink. The total is added to each recipe."
      onClose={onClose}
      wide
    >
      <form onSubmit={submit} className="form">
        <label className="field">
          <span>Set name</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="16 oz cold drink packaging"
            autoFocus
          />
        </label>

        <label className="field">
          <span>Description</span>
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Cup, lid, straw, sleeve"
          />
        </label>

        <div className="form-section">
          <div className="form-section-head">
            <h3>Set items</h3>
            <p>Each line is one material inside the set, with how many are needed per drink.</p>
          </div>

          {items.map((item, index) => {
            const material = materials.find((m) => m.id === item.packaging_id);
            const net = (material?.pack_size ?? 0) * (1 - (material?.waste_pct ?? 0) / 100);
      const unitCost = material && material.pack_price > 0 && net > 0 ? material.pack_price / net : 0;
            const itemCost = round2(unitCost * (Number(item.qty_needed) || 0));
            return (
              <div className="set-item-row" key={index}>
                <select
                  value={item.packaging_id}
                  onChange={(e) =>
                    updateItem(index, { packaging_id: Number(e.target.value) })
                  }
                >
                  <option value="">Choose material…</option>
                  {materials.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} ({unitLabel(m.unit)})
                    </option>
                  ))}
                </select>
                <div className="qty-input">
                  <input
                    type="number"
                    min="0.01"
                    step="any"
                    value={item.qty_needed}
                    onChange={(e) => updateItem(index, { qty_needed: e.target.value })}
                    placeholder="1"
                  />
                  <span>{material ? unitLabel(material.unit) : "—"}</span>
                </div>
                <label className="field">
                  <span>Brand / notes</span>
                  <input
                    value={item.notes}
                    onChange={(e) => updateItem(index, { notes: e.target.value })}
                    placeholder="e.g. ABC brand cups"
                  />
                </label>
                <span className="set-item-cost numeric">
                  {unitCost > 0 ? money(itemCost) : "—"}
                </span>
                <button
                  type="button"
                  className="icon-btn danger"
                  aria-label="Remove item"
                  onClick={() => removeItem(index)}
                >
                  <IconTrash size={15} />
                </button>
              </div>
            );
          })}

          {materials.length === 0 ? (
            <p className="editor-hint">
              No packaging materials yet. Add cups, lids or bags in the{" "}
              <Link className="text-link" to="/library">
                packaging tab
              </Link>
              .
            </p>
          ) : (
            <button
              type="button"
              className="btn btn-quiet btn-sm"
              onClick={addItem}
            >
              <IconPlus size={15} /> Add item
            </button>
          )}

          <p className="set-total">
            Set total: <strong>{totalCost > 0 ? money(totalCost) : "—"}</strong>
          </p>
        </div>

        {error && <p className="form-error">{error}</p>}

        <div className="form-actions split">
          {set ? (
            <button type="button" className="btn btn-ghost-danger" onClick={removeSet}>
              Delete set
            </button>
          ) : (
            <span />
          )}
          <div className="form-actions-right">
            <button type="button" className="btn btn-quiet" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? "Saving…" : isNew ? "Save set" : "Save changes"}
            </button>
          </div>
        </div>
      </form>
    </Modal>
  );
}
