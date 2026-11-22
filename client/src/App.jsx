import React, { useState } from "react";
import MemberPage from "./MemberPage.jsx";
import AdminPage from "./AdminPage.jsx";

const API =
  (import.meta.env.VITE_API_URL || "http://localhost:5000").replace(/\/$/, "") +
  "/api";
const MONTHS = [
  "October 2026",
  "November 2026",
  "December 2026",
  "January 2027",
  "February 2027",
  "March 2027",
  "April 2027",
  "May 2027",
  "June 2027",
  "July 2027",
  "August 2027",
  "September 2027",
];

async function call(path, body, token) {
  const hasBody = body !== undefined && body !== null;
  const response = await fetch(API + path, {
    method: hasBody ? "POST" : "GET",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(hasBody ? { body: JSON.stringify(body) } : {}),
  });
  const text = await response.text();
  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(
      `API returned HTML instead of JSON (${response.status}). Stop and restart the backend from the server folder. Check http://localhost:5000/api/health.`,
    );
  }
  if (!response.ok)
    throw new Error(data.error || `Request failed (${response.status})`);
  return data;
}

function App() {
  const adminPath = window.location.pathname === "/admin";
  const [page, setPage] = useState(adminPath ? "adminLogin" : "login");
  const [name, setName] = useState(""),
    [pin, setPin] = useState(""),
    [confirmPin, setConfirmPin] = useState("");
  const [token, setToken] = useState(""),
    [user, setUser] = useState(null),
    [msg, setMsg] = useState(""),
    [err, setErr] = useState("");
  const [month, setMonth] = useState(MONTHS[0]),
    [type, setType] = useState("monthly");
  const [requests, setRequests] = useState([]),
    [members, setMembers] = useState([]),
    [publicMembers, setPublicMembers] = useState([]);
  const [selectedMemberId, setSelectedMemberId] = useState("");
  const [memberSearch, setMemberSearch] = useState("");
  const [adminPin, setAdminPin] = useState(""),
    [oldPin, setOldPin] = useState(""),
    [newPin, setNewPin] = useState(""),
    [confirmNewPin, setConfirmNewPin] = useState("");
  const [showPin, setShowPin] = useState(false);
  const [showPinForm, setShowPinForm] = useState(false),
    [loading, setLoading] = useState(false);

  const act = async (fn) => {
    setMsg("");
    setErr("");
    setLoading(true);
    try {
      await fn();
    } catch (e) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  };
  const loadRequests = async (t) => {
    const d = await call("/admin/requests", null, t);
    setRequests(d.requests || []);
  };
  const loadMembers = async (t) => {
    const d = await call("/admin/members", null, t);
    setMembers(d.members || []);
  };
  const loadAdminDashboard = async (t) => {
    const d = await call("/admin/dashboard", null, t);
    setMembers(d.members || []);
    setRequests(d.requests || []);
  };
  const loadPublicCollection = async (t) => {
    const d = await call("/collection", null, t);
    setPublicMembers(d.members || []);
  };
  const register = () =>
    act(async () => {
      const d = await call("/register", { name, pin, confirmPin });
      setMsg(d.message);
      setPage("login");
      setPin("");
      setConfirmPin("");
    });
  const login = () =>
    act(async () => {
      const d = await call("/login", { name, pin });
      setToken(d.token);
      setUser(d.user);
      setPage("member");
      setPin("");
      await loadPublicCollection(d.token);
    });
  const adminLogin = () =>
    act(async () => {
      const d = await call("/admin/login", { pin: adminPin });
      setToken(d.token);
      setUser(d.user);
      setPage("admin");
      await loadAdminDashboard(d.token);
      setAdminPin("");
    });
  const submitPayment = () =>
    act(async () => {
      const d = await call("/payment-requests", { type, month }, token);
      setMsg(d.message);
    });
  const changePin = () =>
    act(async () => {
      if (!/^\\d{4}$/.test(newPin) || newPin !== confirmNewPin)
        throw new Error("New PIN must be 4 digits and both PINs must match.");
      const d = await call("/change-pin", { oldPin, newPin }, token);
      setMsg(d.message);
      setOldPin("");
      setNewPin("");
      setConfirmNewPin("");
      setShowPinForm(false);
    });
  const refreshAdmin = () =>
    act(async () => {
      await loadAdminDashboard(token);
    });
  const adminAction = (id, action) =>
    act(async () => {
      const reason =
        action === "remove"
          ? { reason: "Removed by admin" }
          : action === "reject"
            ? { reason: "Cash not received" }
            : {};
      const d = await call(`/admin/requests/${id}/${action}`, reason, token);
      setMsg(d.message);
      await loadAdminDashboard(token);
    });
  const renameMember = (m) => {
    const newName = window.prompt("Enter corrected member name:", m.name);
    if (newName === null) return;
    act(async () => {
      const d = await call(
        `/admin/members/${m.id}/rename`,
        { name: newName },
        token,
      );
      setMsg(d.message);
      await loadAdminDashboard(token);
    });
  };
  const deleteMember = (m) => {
    if (
      !window.confirm(
        `Permanently delete ${m.name}, their ID/PIN hash, monthly collection row and linked payment requests/logs from Google Sheets? This cannot be undone.`,
      )
    )
      return;
    act(async () => {
      const d = await call(`/admin/members/${m.id}/delete`, {}, token);
      setMsg(d.message);
      await loadAdminDashboard(token);
    });
  };
  const logout = () => {
    setToken("");
    setUser(null);
    setRequests([]);
    setMembers([]);
    setPublicMembers([]);
    setPage("login");
    setMsg("Logged out.");
    if (window.location.pathname === "/admin")
      window.history.replaceState({}, "", "/");
  };

  const memberPageProps = {
    user,
    logout,
    type,
    setType,
    month,
    setMonth,
    MONTHS,
    submitPayment,
    loading,
    showPinForm,
    setShowPinForm,
    oldPin,
    setOldPin,
    newPin,
    setNewPin,
    confirmNewPin,
    setConfirmNewPin,
    changePin,
    publicMembers,
    act,
    loadPublicCollection,
    token,
  };
  const adminPageProps = {
    refreshAdmin,
    loading,
    logout,
    members,
    memberSearch,
    setMemberSearch,
    selectedMemberId,
    setSelectedMemberId,
    requests,
    renameMember,
    deleteMember,
    adminAction,
  };

  return (
    <main className="shell">
      <header className="top-header">
        <div className="brand-icon">ॐ</div>
        <div>
          <h1>Ganpati Monthly Collection</h1>
          <p>Faith • Unity • Contribution</p>
        </div>
      </header>
      {!adminPath && page !== "member" && (
        <nav className="main-nav">
          <button
            className={page === "login" ? "nav-active" : ""}
            onClick={() => {
              setPage("login");
              setErr("");
              setMsg("");
            }}
          >
            Member Login
          </button>
          <button
            className={page === "register" ? "nav-active" : ""}
            onClick={() => {
              setPage("register");
              setErr("");
              setMsg("");
            }}
          >
            Create Account
          </button>
        </nav>
      )}
      <section className="panel">
        {msg && <div className="success">{msg}</div>}
        {err && <div className="error">{err}</div>}
        {page === "login" && (
          <div className="form-content">
            <h2>Member Login</h2>
            <p className="subtitle">Login to your collection account.</p>
            <label>Member Name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter your name"
            />
            <label>4-digit PIN</label>
            <input
              type="password"
              inputMode="numeric"
              maxLength="4"
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
              placeholder="Enter PIN"
            />
            <button
              type="button"
              className="pin-visibility"
              onClick={() => setShowPin((v) => !v)}
            >
              {showPin ? "Hide PIN" : "Show PIN"}
            </button>
            <button
              className="primary full-btn"
              onClick={login}
              disabled={loading}
            >
              Login
            </button>
          </div>
        )}
        {page === "register" && (
          <div className="form-content">
            <h2>Create Account</h2>
            <label>Full Name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter full name"
            />
            <label>Create 4-digit PIN</label>
            <input
              type="password"
              inputMode="numeric"
              maxLength="4"
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
            />
            <label>Confirm PIN</label>
            <input
              type="password"
              inputMode="numeric"
              maxLength="4"
              value={confirmPin}
              onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ""))}
            />
            <button
              className="primary full-btn"
              onClick={register}
              disabled={loading}
            >
              Create Account
            </button>
          </div>
        )}
        {page === "adminLogin" && (
          <div className="form-content">
            <h2>Admin Login</h2>
            <p className="subtitle">Authorized access only.</p>
            <label>Admin PIN</label>
            <input
              type="password"
              inputMode="numeric"
              maxLength="4"
              value={adminPin}
              onChange={(e) => setAdminPin(e.target.value.replace(/\D/g, ""))}
            />
            <button
              className="primary full-btn"
              onClick={adminLogin}
              disabled={loading}
            >
              Secure Login
            </button>
          </div>
        )}
        {page === "member" && <MemberPage {...memberPageProps} />}

        {page === "admin" && <AdminPage {...adminPageProps} />}
      </section>
      <footer>
        Ganpati Collection • Cash payments only • October 2026 – September 2027
      </footer>
    </main>
  );
}

export default App;
