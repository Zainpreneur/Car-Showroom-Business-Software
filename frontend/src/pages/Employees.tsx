import { useEffect, useState } from "react";
import { api, apiErrorMessage } from "../api/client";
import { User } from "../types";
import Modal from "../components/Modal";
import StatusBadge from "../components/StatusBadge";
import { useAuth } from "../context/AuthContext";

const emptyForm = { name: "", email: "", password: "", role: "SALESPERSON" as User["role"], phone: "" };

export default function Employees() {
  const { user: currentUser } = useAuth();
  const [employees, setEmployees] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const res = await api.get("/employees");
      setEmployees(res.data);
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
      await api.post("/employees", form);
      setModalOpen(false);
      await load();
    } catch (err) {
      setError(apiErrorMessage(err, "Failed to create employee"));
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(emp: User) {
    try {
      await api.put(`/employees/${emp.id}`, { active: !emp.active });
      await load();
    } catch (err) {
      alert(apiErrorMessage(err, "Failed to update employee"));
    }
  }

  async function handleDelete(emp: User) {
    if (!confirm(`Remove employee ${emp.name}?`)) return;
    try {
      await api.delete(`/employees/${emp.id}`);
      await load();
    } catch (err) {
      alert(apiErrorMessage(err, "Failed to delete employee"));
    }
  }

  const isAdmin = currentUser?.role === "ADMIN";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Employees</h2>
          <p className="text-slate-500 text-sm">Manage staff accounts and roles</p>
        </div>
        {isAdmin && (
          <button className="btn-primary" onClick={openCreate}>
            + Add Employee
          </button>
        )}
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500 text-left">
            <tr>
              <th className="px-5 py-2.5 font-medium">Name</th>
              <th className="px-5 py-2.5 font-medium">Email</th>
              <th className="px-5 py-2.5 font-medium">Role</th>
              <th className="px-5 py-2.5 font-medium">Status</th>
              {isAdmin && <th className="px-5 py-2.5 font-medium text-right">Actions</th>}
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
            {employees.map((emp) => (
              <tr key={emp.id}>
                <td className="px-5 py-3 font-medium text-slate-900">{emp.name}</td>
                <td className="px-5 py-3 text-slate-500">{emp.email}</td>
                <td className="px-5 py-3">
                  <StatusBadge status={emp.role} />
                </td>
                <td className="px-5 py-3">
                  <span className={`badge ${emp.active ? "bg-green-100 text-green-700" : "bg-slate-200 text-slate-600"}`}>
                    {emp.active ? "Active" : "Inactive"}
                  </span>
                </td>
                {isAdmin && (
                  <td className="px-5 py-3 text-right space-x-2">
                    <button className="text-brand-600 hover:underline text-sm" onClick={() => toggleActive(emp)}>
                      {emp.active ? "Deactivate" : "Activate"}
                    </button>
                    {emp.id !== currentUser?.id && (
                      <button className="text-red-600 hover:underline text-sm" onClick={() => handleDelete(emp)}>
                        Remove
                      </button>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Add Employee">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">Full name</label>
            <input className="input" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div>
            <label className="label">Email</label>
            <input type="email" className="input" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>
          <div>
            <label className="label">Temporary password</label>
            <input
              type="password"
              className="input"
              required
              minLength={6}
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
            />
          </div>
          <div>
            <label className="label">Role</label>
            <select className="input" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as User["role"] })}>
              <option value="SALESPERSON">Salesperson</option>
              <option value="MANAGER">Manager</option>
              <option value="ADMIN">Admin</option>
            </select>
          </div>
          <div>
            <label className="label">Phone</label>
            <input className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" className="btn-secondary" onClick={() => setModalOpen(false)}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? "Saving…" : "Add employee"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
