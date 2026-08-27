import { useEffect, useState } from "react";
import { api, apiErrorMessage } from "../api/client";
import { Vehicle } from "../types";
import Modal from "../components/Modal";
import StatusBadge from "../components/StatusBadge";
import { formatCurrency } from "../utils/format";
import { useAuth } from "../context/AuthContext";

const emptyForm = {
  make: "",
  model: "",
  year: new Date().getFullYear(),
  vin: "",
  color: "",
  mileage: 0,
  bodyType: "",
  transmission: "",
  fuelType: "",
  costPrice: 0,
  sellingPrice: 0,
  status: "IN_STOCK" as Vehicle["status"],
  description: "",
};

export default function Vehicles() {
  const { user } = useAuth();
  const canManage = user?.role === "ADMIN" || user?.role === "MANAGER";

  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Vehicle | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (search) params.search = search;
      if (status) params.status = status;
      const res = await api.get("/vehicles", { params });
      setVehicles(res.data.items);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, status]);

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setError("");
    setModalOpen(true);
  }

  function openEdit(v: Vehicle) {
    setEditing(v);
    setForm({
      make: v.make,
      model: v.model,
      year: v.year,
      vin: v.vin,
      color: v.color || "",
      mileage: v.mileage,
      bodyType: v.bodyType || "",
      transmission: v.transmission || "",
      fuelType: v.fuelType || "",
      costPrice: v.costPrice,
      sellingPrice: v.sellingPrice,
      status: v.status,
      description: v.description || "",
    });
    setError("");
    setModalOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      if (editing) {
        await api.put(`/vehicles/${editing.id}`, form);
      } else {
        await api.post("/vehicles", form);
      }
      setModalOpen(false);
      await load();
    } catch (err) {
      setError(apiErrorMessage(err, "Failed to save vehicle"));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(v: Vehicle) {
    if (!confirm(`Delete ${v.year} ${v.make} ${v.model}? This cannot be undone.`)) return;
    try {
      await api.delete(`/vehicles/${v.id}`);
      await load();
    } catch (err) {
      alert(apiErrorMessage(err, "Failed to delete vehicle"));
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Inventory</h2>
          <p className="text-slate-500 text-sm">Manage your vehicle stock</p>
        </div>
        {canManage && (
          <button className="btn-primary" onClick={openCreate}>
            + Add Vehicle
          </button>
        )}
      </div>

      <div className="flex gap-3 flex-wrap">
        <input
          className="input max-w-xs"
          placeholder="Search make, model, VIN, color…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select className="input max-w-[180px]" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All statuses</option>
          <option value="IN_STOCK">In stock</option>
          <option value="RESERVED">Reserved</option>
          <option value="SOLD">Sold</option>
        </select>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500 text-left">
            <tr>
              <th className="px-5 py-2.5 font-medium">Vehicle</th>
              <th className="px-5 py-2.5 font-medium">VIN</th>
              <th className="px-5 py-2.5 font-medium">Mileage</th>
              <th className="px-5 py-2.5 font-medium">Cost</th>
              <th className="px-5 py-2.5 font-medium">Price</th>
              <th className="px-5 py-2.5 font-medium">Status</th>
              {canManage && <th className="px-5 py-2.5 font-medium text-right">Actions</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading && (
              <tr>
                <td colSpan={7} className="px-5 py-6 text-center text-slate-400">
                  Loading…
                </td>
              </tr>
            )}
            {!loading && vehicles.length === 0 && (
              <tr>
                <td colSpan={7} className="px-5 py-6 text-center text-slate-400">
                  No vehicles found
                </td>
              </tr>
            )}
            {vehicles.map((v) => (
              <tr key={v.id}>
                <td className="px-5 py-3">
                  <p className="font-medium text-slate-900">
                    {v.year} {v.make} {v.model}
                  </p>
                  <p className="text-slate-400 text-xs">{v.color} · {v.bodyType || "—"}</p>
                </td>
                <td className="px-5 py-3 text-slate-500 font-mono text-xs">{v.vin}</td>
                <td className="px-5 py-3">{v.mileage.toLocaleString()} mi</td>
                <td className="px-5 py-3">{formatCurrency(v.costPrice)}</td>
                <td className="px-5 py-3 font-medium">{formatCurrency(v.sellingPrice)}</td>
                <td className="px-5 py-3">
                  <StatusBadge status={v.status} />
                </td>
                {canManage && (
                  <td className="px-5 py-3 text-right space-x-2">
                    <button className="text-brand-600 hover:underline text-sm" onClick={() => openEdit(v)}>
                      Edit
                    </button>
                    <button className="text-red-600 hover:underline text-sm" onClick={() => handleDelete(v)}>
                      Delete
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? "Edit Vehicle" : "Add Vehicle"} wide>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Make</label>
              <input className="input" required value={form.make} onChange={(e) => setForm({ ...form, make: e.target.value })} />
            </div>
            <div>
              <label className="label">Model</label>
              <input className="input" required value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} />
            </div>
            <div>
              <label className="label">Year</label>
              <input
                type="number"
                className="input"
                required
                value={form.year}
                onChange={(e) => setForm({ ...form, year: Number(e.target.value) })}
              />
            </div>
            <div>
              <label className="label">VIN</label>
              <input className="input" required value={form.vin} onChange={(e) => setForm({ ...form, vin: e.target.value })} />
            </div>
            <div>
              <label className="label">Color</label>
              <input className="input" value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} />
            </div>
            <div>
              <label className="label">Mileage</label>
              <input
                type="number"
                className="input"
                value={form.mileage}
                onChange={(e) => setForm({ ...form, mileage: Number(e.target.value) })}
              />
            </div>
            <div>
              <label className="label">Body type</label>
              <input className="input" value={form.bodyType} onChange={(e) => setForm({ ...form, bodyType: e.target.value })} />
            </div>
            <div>
              <label className="label">Transmission</label>
              <input className="input" value={form.transmission} onChange={(e) => setForm({ ...form, transmission: e.target.value })} />
            </div>
            <div>
              <label className="label">Fuel type</label>
              <input className="input" value={form.fuelType} onChange={(e) => setForm({ ...form, fuelType: e.target.value })} />
            </div>
            <div>
              <label className="label">Status</label>
              <select className="input" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as Vehicle["status"] })}>
                <option value="IN_STOCK">In stock</option>
                <option value="RESERVED">Reserved</option>
                <option value="SOLD">Sold</option>
              </select>
            </div>
            <div>
              <label className="label">Cost price</label>
              <input
                type="number"
                className="input"
                required
                value={form.costPrice}
                onChange={(e) => setForm({ ...form, costPrice: Number(e.target.value) })}
              />
            </div>
            <div>
              <label className="label">Selling price</label>
              <input
                type="number"
                className="input"
                required
                value={form.sellingPrice}
                onChange={(e) => setForm({ ...form, sellingPrice: Number(e.target.value) })}
              />
            </div>
          </div>
          <div>
            <label className="label">Description</label>
            <textarea
              className="input"
              rows={3}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" className="btn-secondary" onClick={() => setModalOpen(false)}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? "Saving…" : editing ? "Save changes" : "Add vehicle"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
