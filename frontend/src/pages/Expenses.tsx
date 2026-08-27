import { useEffect, useState } from "react";
import { api, apiErrorMessage } from "../api/client";
import { Expense } from "../types";
import Modal from "../components/Modal";
import { formatCurrency, formatDate } from "../utils/format";
import { useAuth } from "../context/AuthContext";

const emptyForm = { category: "", description: "", amount: 0 };
const CATEGORIES = ["Rent", "Utilities", "Salaries", "Marketing", "Maintenance", "Insurance", "Other"];

export default function Expenses() {
  const { user } = useAuth();
  const canManage = user?.role === "ADMIN" || user?.role === "MANAGER";

  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const res = await api.get("/expenses", { params: { pageSize: 100 } });
      setExpenses(res.data.items);
      setTotal(res.data.items.reduce((sum: number, e: Expense) => sum + e.amount, 0));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function openCreate() {
    setForm(emptyForm);
    setError("");
    setModalOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      await api.post("/expenses", form);
      setModalOpen(false);
      await load();
    } catch (err) {
      setError(apiErrorMessage(err, "Failed to save expense"));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(exp: Expense) {
    if (!confirm(`Delete expense "${exp.category}"?`)) return;
    try {
      await api.delete(`/expenses/${exp.id}`);
      await load();
    } catch (err) {
      alert(apiErrorMessage(err, "Failed to delete expense"));
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Expenses</h2>
          <p className="text-slate-500 text-sm">Track operating costs — total on record: {formatCurrency(total)}</p>
        </div>
        {canManage && (
          <button className="btn-primary" onClick={openCreate}>
            + Add Expense
          </button>
        )}
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500 text-left">
            <tr>
              <th className="px-5 py-2.5 font-medium">Category</th>
              <th className="px-5 py-2.5 font-medium">Description</th>
              <th className="px-5 py-2.5 font-medium">Amount</th>
              <th className="px-5 py-2.5 font-medium">Date</th>
              {canManage && <th className="px-5 py-2.5 font-medium text-right">Actions</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading && (
              <tr>
                <td colSpan={5} className="px-5 py-6 text-center text-slate-400">
                  Loading…
                </td>
              </tr>
            )}
            {!loading && expenses.length === 0 && (
              <tr>
                <td colSpan={5} className="px-5 py-6 text-center text-slate-400">
                  No expenses recorded
                </td>
              </tr>
            )}
            {expenses.map((exp) => (
              <tr key={exp.id}>
                <td className="px-5 py-3 font-medium text-slate-900">{exp.category}</td>
                <td className="px-5 py-3 text-slate-500">{exp.description || "—"}</td>
                <td className="px-5 py-3">{formatCurrency(exp.amount)}</td>
                <td className="px-5 py-3 text-slate-500">{formatDate(exp.date)}</td>
                {canManage && (
                  <td className="px-5 py-3 text-right">
                    <button className="text-red-600 hover:underline text-sm" onClick={() => handleDelete(exp)}>
                      Delete
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Add Expense">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">Category</label>
            <select className="input" required value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
              <option value="">Select category…</option>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Description</label>
            <input className="input" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <div>
            <label className="label">Amount</label>
            <input
              type="number"
              className="input"
              required
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })}
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" className="btn-secondary" onClick={() => setModalOpen(false)}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? "Saving…" : "Add expense"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
