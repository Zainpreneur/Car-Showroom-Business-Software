import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { api, apiErrorMessage } from "../api/client";

export default function Login() {
  const { login, register, user } = useAuth();
  const navigate = useNavigate();
  const [needsSetup, setNeedsSetup] = useState<boolean | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) navigate("/");
  }, [user, navigate]);

  useEffect(() => {
    api
      .get("/auth/bootstrap-status")
      .then((res) => setNeedsSetup(res.data.needsSetup))
      .catch(() => setNeedsSetup(false));
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      if (needsSetup) {
        await register(name, email, password);
      } else {
        await login(email, password);
      }
      navigate("/");
    } catch (err) {
      setError(apiErrorMessage(err, "Login failed"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100 px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-6">
          <div className="text-4xl mb-2">🚗</div>
          <h1 className="text-xl font-bold text-slate-900">Car Showroom Manager</h1>
          <p className="text-sm text-slate-500 mt-1">
            {needsSetup ? "Set up your admin account to get started" : "Sign in to your account"}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="card p-6 space-y-4">
          {needsSetup && (
            <div>
              <label className="label">Full name</label>
              <input className="input" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
          )}
          <div>
            <label className="label">Email</label>
            <input
              type="email"
              className="input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="label">Password</label>
            <input
              type="password"
              className="input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button type="submit" className="btn-primary w-full" disabled={loading}>
            {loading ? "Please wait…" : needsSetup ? "Create admin account" : "Sign in"}
          </button>

          {needsSetup === false && (
            <p className="text-xs text-slate-400 text-center pt-2">
              Demo login: admin@showroom.com / Admin123!
            </p>
          )}
        </form>
      </div>
    </div>
  );
}
