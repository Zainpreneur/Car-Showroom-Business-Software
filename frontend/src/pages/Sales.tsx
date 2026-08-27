import { useEffect, useState } from "react";
import { api, apiErrorMessage } from "../api/client";
import { Sale, Vehicle, Customer } from "../types";
import Modal from "../components/Modal";
import StatusBadge from "../components/StatusBadge";
import { formatCurrency, formatDate } from "../utils/format";

const emptyForm = {
  vehicleId: "",
  customerId: "",
  salePrice: 0,
  paymentMethod: "CASH" as Sale["paymentMethod"],
  status: "COMPLETED" as Sale["status"],
  notes: "",
};

export default function Sales() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (statusFilter) params.status = statusFilter;
      const res = await api.get("/sales", { params });
      setSales(res.data.items);
    } finally {
      setLoading(false);
    }
  }

  async function loadFormData() {
    const [vRes, cRes] = await Promise.all([
      api.get("/vehicles", { params: { status: "IN_STOCK", pageSize: 100 } }),
      api.get("/customers", { params: { pageSize: 100 } }),
    ]);
    setVehicles(vRes.data.items);
    setCustomers(cRes.data.items);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  async function openCreate() {
    setForm(emptyForm);
    setError("");
    await loadFormData();
    setModalOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.vehicleId || !form.customerId) {
      setError("Please select a vehicle and a customer");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await api.post("/sales", form);
      setModalOpen(false);
      await load();
    } catch (err) {
      setError(apiErrorMessage(err, "Failed to record sale"));
    } finally {
      setSaving(false);
    }
  }

  async function updateStatus(sale: Sale, status: Sale["status"]) {
    try {
      await api.put(`/sales/${sale.id}`, { status });
      await load();
    } catch (err) {
      alert(apiErrorMessage(err, "Failed to update sale"));
    }
  }

  async function handleDelete(sale: Sale) {
    if (!confirm("Delete this sale record? The vehicle will return to In Stock.")) return;
    try {
      await api.delete(`/sales/${sale.id}`);
      await load();
    } catch (err) {
      alert(apiErrorMessage(err, "Failed to delete sale"));
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Sales</h2>
          <p className="text-slate-500 text-sm">Record and track vehicle sales</p>
        </div>
        <button className="btn-primary" onClick={openCreate}>
          + Record Sale
        </button>
      </div>

      <select className="input max-w-[180px]" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
        <option value="">All statuses</option>
        <option value="PENDING">Pending</option>
        <option value="COMPLETED">Completed</option>
        <option value="CANCELLED">Cancelled</option>
      </select>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500 text-left">
            <tr>
              <th className="px-5 py-2.5 font-medium">Vehicle</th>
              <th className="px-5 py-2.5 font-medium">Customer</th>
              <th className="px-5 py-2.5 font-medium">Salesperson</th>
              <th className="px-5 py-2.5 font-medium">Price</th>
              <th className="px-5 py-2.5 font-medium">Payment</th>
              <th className="px-5 py-2.5 font-medium">Date</th>
              <th className="px-5 py-2.5 font-medium">Status</th>
              <th className="px-5 py-2.5 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading && (
              <tr>
                <td colSpan={8} className="px-5 py-6 text-center text-slate-400">
                  Loading…
                </td>
              </tr>
            )}
            {!loading && sales.length === 0 && (
              <tr>
                <td colSpan={8} className="px-5 py-6 text-center text-slate-400">
                  No sales found
                </td>
              </tr>
            )}
            {sales.map((s) => (
              <tr key={s.id}>
                <td className="px-5 py-3">
                  {s.vehicle.year} {s.vehicle.make} {s.vehicle.model}
                </td>
                <td className="px-5 py-3">{s.customer.name}</td>
                <td className="px-5 py-3">{s.salesperson.name}</td>
                <td className="px-5 py-3 font-medium">{formatCurrency(s.salePrice)}</td>
                <td className="px-5 py-3 text-slate-500">{s.paymentMethod.replace("_", " ")}</td>
                <td className="px-5 py-3 text-slate-500">{formatDate(s.saleDate)}</td>
                <td className="px-5 py-3">
                  <StatusBadge status={s.status} />
                </td>
                <td className="px-5 py-3 text-right space-x-2 whitespace-nowrap">
                  {s.status === "PENDING" && (
                    <button className="text-green-600 hover:underline text-sm" onClick={() => updateStatus(s, "COMPLETED")}>
                      Complete
                    </button>
                  )}
                  {s.status !== "CANCELLED" && (
                    <button className="text-amber-600 hover:underline text-sm" onClick={() => updateStatus(s, "CANCELLED")}>
                      Cancel
                    </button>
                  )}
                  <button className="text-red-600 hover:underline text-sm" onClick={() => handleDelete(s)}>
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Record Sale" wide>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Vehicle (in stock)</label>
              <select
                className="input"
                required
                value={form.vehicleId}
                onChange={(e) => {
                  const v = vehicles.find((x) => x.id === Number(e.target.value));
                  setForm({ ...form, vehicleId: e.target.value, salePrice: v?.sellingPrice ?? form.salePrice });
                }}
              >
                <option value="">Select vehicle…</option>
                {vehicles.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.year} {v.make} {v.model} — {formatCurrency(v.sellingPrice)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Customer</label>
              <select className="input" required value={form.customerId} onChange={(e) => setForm({ ...form, customerId: e.target.value })}>
                <option value="">Select customer…</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} — {c.phone}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Sale price</label>
              <input
                type="number"
                className="input"
                required
                value={form.salePrice}
                onChange={(e) => setForm({ ...form, salePrice: Number(e.target.value) })}
              />
            </div>
            <div>
              <label className="label">Payment method</label>
              <select
                className="input"
                value={form.paymentMethod}
                onChange={(e) => setForm({ ...form, paymentMethod: e.target.value as Sale["paymentMethod"] })}
              >
                <option value="CASH">Cash</option>
                <option value="CARD">Card</option>
                <option value="BANK_TRANSFER">Bank transfer</option>
                <option value="FINANCE">Finance</option>
                <option value="LEASE">Lease</option>
              </select>
            </div>
            <div>
              <label className="label">Status</label>
              <select className="input" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as Sale["status"] })}>
                <option value="PENDING">Pending</option>
                <option value="COMPLETED">Completed</option>
              </select>
            </div>
          </div>
          <div>
            <label className="label">Notes</label>
            <textarea className="input" rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" className="btn-secondary" onClick={() => setModalOpen(false)}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? "Saving…" : "Record sale"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
