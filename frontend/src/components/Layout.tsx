import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const navItems = [
  { to: "/", label: "Dashboard", icon: "📊", end: true },
  { to: "/vehicles", label: "Inventory", icon: "🚗" },
  { to: "/customers", label: "Customers", icon: "👤" },
  { to: "/sales", label: "Sales", icon: "💰" },
  { to: "/expenses", label: "Expenses", icon: "🧾" },
  { to: "/employees", label: "Employees", icon: "🧑‍💼", adminOnly: true },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate("/login");
  }

  return (
    <div className="flex min-h-screen">
      <aside className="w-64 shrink-0 bg-slate-900 text-slate-200 flex flex-col">
        <div className="px-5 py-5 border-b border-slate-800">
          <h1 className="text-lg font-bold text-white flex items-center gap-2">
            🚗 Car Showroom
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">Business Manager</p>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1">
          {navItems.map((item) => {
            if (item.adminOnly && user?.role !== "ADMIN" && user?.role !== "MANAGER") return null;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                    isActive ? "bg-brand-600 text-white" : "text-slate-300 hover:bg-slate-800 hover:text-white"
                  }`
                }
              >
                <span>{item.icon}</span>
                {item.label}
              </NavLink>
            );
          })}
        </nav>
        <div className="px-3 py-4 border-t border-slate-800">
          <div className="px-3 py-2 mb-2">
            <p className="text-sm font-medium text-white">{user?.name}</p>
            <p className="text-xs text-slate-400">{user?.role}</p>
          </div>
          <button onClick={handleLogout} className="w-full btn-secondary bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700">
            Sign out
          </button>
        </div>
      </aside>
      <main className="flex-1 bg-slate-50 overflow-y-auto">
        <div className="max-w-7xl mx-auto p-6 md:p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
