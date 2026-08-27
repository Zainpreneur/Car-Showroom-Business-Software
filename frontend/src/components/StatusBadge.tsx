const styles: Record<string, string> = {
  IN_STOCK: "bg-green-100 text-green-700",
  RESERVED: "bg-amber-100 text-amber-700",
  SOLD: "bg-slate-200 text-slate-600",
  PENDING: "bg-amber-100 text-amber-700",
  COMPLETED: "bg-green-100 text-green-700",
  CANCELLED: "bg-red-100 text-red-700",
  ADMIN: "bg-purple-100 text-purple-700",
  MANAGER: "bg-blue-100 text-blue-700",
  SALESPERSON: "bg-slate-100 text-slate-700",
};

export default function StatusBadge({ status }: { status: string }) {
  return <span className={`badge ${styles[status] || "bg-slate-100 text-slate-700"}`}>{status.replace("_", " ")}</span>;
}
