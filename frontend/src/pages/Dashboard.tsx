import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  BarChart,
  Bar,
} from "recharts";
import { api } from "../api/client";
import { DashboardSummary, TrendPoint } from "../types";
import StatCard from "../components/StatCard";
import StatusBadge from "../components/StatusBadge";
import { formatCurrency, formatDate } from "../utils/format";

export default function Dashboard() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [trend, setTrend] = useState<TrendPoint[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([api.get("/dashboard/summary"), api.get("/dashboard/trend?months=6")])
      .then(([s, t]) => {
        setSummary(s.data);
        setTrend(t.data);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading || !summary) {
    return <p className="text-slate-400">Loading dashboard…</p>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Dashboard</h2>
        <p className="text-slate-500 text-sm">Overview of your showroom's performance</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Vehicles in stock" value={String(summary.inventory.inStock)} hint={`${summary.inventory.total} total`} />
        <StatCard label="Reserved" value={String(summary.inventory.reserved)} accent="text-amber-600" />
        <StatCard label="Sold (all time)" value={String(summary.inventory.sold)} accent="text-slate-600" />
        <StatCard label="Customers" value={String(summary.customers.total)} accent="text-blue-600" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard label="Revenue this month" value={formatCurrency(summary.sales.monthRevenue)} hint={`${summary.sales.monthCount} sales`} />
        <StatCard label="Profit this month" value={formatCurrency(summary.sales.monthProfit)} accent="text-green-600" />
        <StatCard label="Expenses this month" value={formatCurrency(summary.monthExpenses)} accent="text-red-600" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard label="Revenue (year to date)" value={formatCurrency(summary.sales.yearRevenue)} hint={`${summary.sales.yearCount} sales`} />
        <StatCard label="Profit (year to date)" value={formatCurrency(summary.sales.yearProfit)} accent="text-green-600" />
        <StatCard label="Inventory value (cost)" value={formatCurrency(summary.inventoryValue)} accent="text-slate-600" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-slate-700 mb-4">Revenue &amp; Profit trend (6 months)</h3>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={trend}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="label" tick={{ fontSize: 12 }} stroke="#94a3b8" />
              <YAxis tick={{ fontSize: 12 }} stroke="#94a3b8" tickFormatter={(v) => `$${v / 1000}k`} />
              <Tooltip formatter={(v: number) => formatCurrency(v)} />
              <Line type="monotone" dataKey="revenue" stroke="#2456f5" strokeWidth={2} dot={false} name="Revenue" />
              <Line type="monotone" dataKey="profit" stroke="#16a34a" strokeWidth={2} dot={false} name="Profit" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="card p-5">
          <h3 className="text-sm font-semibold text-slate-700 mb-4">Sales volume (6 months)</h3>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={trend}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="label" tick={{ fontSize: 12 }} stroke="#94a3b8" />
              <YAxis allowDecimals={false} tick={{ fontSize: 12 }} stroke="#94a3b8" />
              <Tooltip />
              <Bar dataKey="count" fill="#4d7fff" radius={[4, 4, 0, 0]} name="Vehicles sold" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="card">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
          <h3 className="text-sm font-semibold text-slate-700">Recent sales</h3>
          <Link to="/sales" className="text-sm text-brand-600 hover:underline">
            View all
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 text-left">
              <tr>
                <th className="px-5 py-2.5 font-medium">Vehicle</th>
                <th className="px-5 py-2.5 font-medium">Customer</th>
                <th className="px-5 py-2.5 font-medium">Salesperson</th>
                <th className="px-5 py-2.5 font-medium">Price</th>
                <th className="px-5 py-2.5 font-medium">Status</th>
                <th className="px-5 py-2.5 font-medium">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {summary.recentSales.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-6 text-center text-slate-400">
                    No sales yet
                  </td>
                </tr>
              )}
              {summary.recentSales.map((s) => (
                <tr key={s.id}>
                  <td className="px-5 py-3">
                    {s.vehicle.year} {s.vehicle.make} {s.vehicle.model}
                  </td>
                  <td className="px-5 py-3">{s.customer.name}</td>
                  <td className="px-5 py-3">{s.salesperson.name}</td>
                  <td className="px-5 py-3">{formatCurrency(s.salePrice)}</td>
                  <td className="px-5 py-3">
                    <StatusBadge status={s.status} />
                  </td>
                  <td className="px-5 py-3 text-slate-500">{formatDate(s.saleDate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
