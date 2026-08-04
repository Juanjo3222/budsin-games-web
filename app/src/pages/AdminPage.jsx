import { useState, useEffect, useCallback } from "react";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { listUsers, setUserPro, payMonth, listGameRequests, setRequestStatus, ensureUserDoc } from "../lib/firebase";

function fmtDate(d) {
  if (!d) return "—";
  return d.toLocaleDateString();
}

function UserBadge({ pro, trial, paidUntil }) {
  const expired = paidUntil && paidUntil < new Date();
  if (pro && expired) return <span className="badge-free">⚠️ {trial ? "Trial vencido" : "Vencido"}</span>;
  if (pro && trial) {
    const diff = paidUntil ? Math.ceil((paidUntil - Date.now()) / 86400000) : "?";
    return <span className="badge-trial">📅 Trial ({diff} d)</span>;
  }
  if (pro) return <span className="badge-pro">⭐ PRO</span>;
  return <span className="badge-free">Gratuito</span>;
}

export default function AdminPage() {
  const { user, login } = useAuth();
  const { showToast } = useToast();
  const [users, setUsers] = useState(null);
  const [requests, setRequests] = useState(null);
  const [busy, setBusy] = useState(false);

  const reload = useCallback(async () => {
    setUsers(await listUsers());
    setRequests(await listGameRequests());
  }, []);

  useEffect(() => {
    if (user) {
      ensureUserDoc(user).then(reload);
    } else {
      setUsers(null);
      setRequests(null);
    }
  }, [user, reload]);

  if (!user) {
    return (
      <div className="admin-shell">
        <a className="back-link" href="#/">← Volver al portal</a>
        <div className="card admin-card">
          <h1>Admin · Pro</h1>
          <p style={{ color: "var(--muted)" }}>Gestiona los usuarios Pro de Budsin Games.</p>
          <button type="button" className="btn btn-primary" onClick={login}>Iniciar sesión con Google</button>
        </div>
      </div>
    );
  }

  const handleTogglePro = async (u) => {
    setBusy(true);
    try {
      if (u.pro) {
        if (!window.confirm("¿Revocar Pro a " + u.email + "?")) return;
        await setUserPro(u.uid, { pro: false });
        showToast("Pro revocado", false);
      } else {
        const expiry = new Date(Date.now() + 35 * 24 * 60 * 60 * 1000);
        await setUserPro(u.uid, { pro: true, paidUntil: expiry });
        showToast("⭐ Hizo Pro", false);
      }
      await reload();
    } catch (e) {
      showToast("Error: " + e.message, true);
    } finally {
      setBusy(false);
    }
  };

  const handlePay = async (u) => {
    setBusy(true);
    try {
      await payMonth(u.uid, 35);
      showToast("✅ Pagado 35 días", false);
      await reload();
    } catch (e) {
      showToast("Error: " + e.message, true);
    } finally {
      setBusy(false);
    }
  };

  const handleRequest = async (id, status) => {
    try {
      await setRequestStatus(id, status);
      await reload();
    } catch (e) {
      showToast("Error: " + e.message, true);
    }
  };

  return (
    <div className="admin-shell">
      <a className="back-link" href="#/">← Volver al portal</a>
      <div className="card admin-card">
        <div className="admin-header">
          <div>
            <h1>Admin · Pro</h1>
            <span className="email">{user.email}</span>
          </div>
        </div>
        <table className="admin-table">
          <thead>
            <tr><th>Email</th><th>Estado</th><th>Registrado</th><th>Pagado hasta</th><th>Acción</th></tr>
          </thead>
          <tbody>
            {users === null && <tr><td colSpan="5" style={{ textAlign: "center", color: "var(--muted)" }}>Cargando usuarios...</td></tr>}
            {users && users.length === 0 && <tr><td colSpan="5" style={{ textAlign: "center", color: "var(--muted)" }}>No hay usuarios registrados todavía.</td></tr>}
            {users &&
              users.map((u) => (
                <tr key={u.uid}>
                  <td>{u.email}</td>
                  <td><UserBadge pro={u.pro} trial={u.trial} paidUntil={u.paidUntil} /></td>
                  <td style={{ fontSize: ".8rem", color: "var(--muted)" }}>{fmtDate(u.createdAt)}</td>
                  <td style={{ fontSize: ".8rem", color: "var(--muted)" }}>
                    {fmtDate(u.paidUntil)}
                    {u.paidUntil && u.paidUntil < new Date() ? " ⚠️" : ""}
                  </td>
                  <td>
                    {u.pro && (
                      <button type="button" className="btn btn-sm btn-green" disabled={busy} onClick={() => handlePay(u)}>✅ Pagar este mes</button>
                    )}
                    <button type="button" className={`btn btn-sm ${u.pro ? "btn-danger" : "btn-green"}`} disabled={busy} onClick={() => handleTogglePro(u)}>
                      {u.pro ? "Revocar Pro" : "Hacer Pro"}
                    </button>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      <div className="card admin-card">
        <h2 style={{ margin: 0, marginBottom: 12, fontSize: "1.1rem" }}>🎮 Solicitudes de juegos</h2>
        <table className="admin-table">
          <thead>
            <tr><th>Juego</th><th>URL</th><th>Usuario</th><th>Fecha</th><th>Estado</th><th>Acción</th></tr>
          </thead>
          <tbody>
            {requests === null && <tr><td colSpan="6" style={{ textAlign: "center", color: "var(--muted)" }}>Cargando solicitudes...</td></tr>}
            {requests && requests.length === 0 && <tr><td colSpan="6" style={{ textAlign: "center", color: "var(--muted)" }}>No hay solicitudes aún.</td></tr>}
            {requests &&
              requests.map((r) => (
                <tr key={r.id}>
                  <td style={{ fontWeight: 600 }}>{r.gameName}</td>
                  <td style={{ fontSize: ".8rem", color: "var(--muted)" }}>
                    {r.gameUrl ? <a href={r.gameUrl} target="_blank" rel="noreferrer" style={{ color: "var(--blue)" }}>{r.gameUrl}</a> : "—"}
                  </td>
                  <td style={{ fontSize: ".8rem", color: "var(--muted)" }}>{r.email}</td>
                  <td style={{ fontSize: ".8rem", color: "var(--muted)" }}>{fmtDate(r.createdAt)}</td>
                  <td>
                    <span className={`req-status ${r.status}`}>{r.status}</span>
                  </td>
                  <td>
                    {r.status === "pending" && (
                      <>
                        <button type="button" className="btn btn-sm btn-green" onClick={() => handleRequest(r.id, "approved")}>✅ Aprobar</button>
                        <button type="button" className="btn btn-sm btn-danger" onClick={() => handleRequest(r.id, "rejected")}>❌ Rechazar</button>
                      </>
                    )}
                    {r.status !== "pending" && "—"}
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
