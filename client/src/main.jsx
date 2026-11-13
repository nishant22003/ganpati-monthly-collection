import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import "./style.css";

const API = "http://localhost:5000/api";
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

function MemberTable({ members }) {
  return (
    <div className="table-wrap">
      <table className="collection-table">
        <thead>
          <tr>
            <th>Member</th>
            {MONTHS.map((m) => (
              <th key={m}>{m}</th>
            ))}
            <th>One-Time</th>
            <th>Total</th>
          </tr>
        </thead>
        <tbody>
          {members.map((m) => (
            <tr key={m.id}>
              <td>
                <b>{m.name}</b>
              </td>
              {m.monthly.map((x) => (
                <td
                  key={x.month}
                  className={x.paid ? "paid-cell" : "unpaid-cell"}
                >
                  {x.paid ? `₹${x.amount} ✓` : "Pending"}
                </td>
              ))}
              <td className={m.oneTime >= 1000 ? "paid-cell" : "unpaid-cell"}>
                {m.oneTime >= 1000 ? "₹1,000 ✓" : "Pending"}
              </td>
              <td>
                <b>₹{m.grandTotal}</b>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
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
  const [adminPin, setAdminPin] = useState(""),
    [oldPin, setOldPin] = useState(""),
    [newPin, setNewPin] = useState("");
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
      await Promise.all([loadRequests(d.token), loadMembers(d.token)]);
      setAdminPin("");
    });
  const submitPayment = () =>
    act(async () => {
      const d = await call("/payment-requests", { type, month }, token);
      setMsg(d.message);
    });
  const changePin = () =>
    act(async () => {
      const d = await call("/change-pin", { oldPin, newPin }, token);
      setMsg(d.message);
      setOldPin("");
      setNewPin("");
      setShowPinForm(false);
    });
  const refreshAdmin = () =>
    act(async () => {
      await Promise.all([loadRequests(token), loadMembers(token)]);
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
      await Promise.all([loadRequests(token), loadMembers(token)]);
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
      await Promise.all([loadMembers(token), loadRequests(token)]);
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
      await Promise.all([loadMembers(token), loadRequests(token)]);
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
        {page === "member" && (
          <>
            <div className="dashboard-heading">
              <div>
                <h2>Welcome, {user?.name}</h2>
                <p className="subtitle">Collection payment and member status</p>
              </div>
              <button className="secondary" onClick={logout}>
                Logout
              </button>
            </div>
            <div className="content-card">
              <h3>Submit Cash Payment Request</h3>
              <label>Payment Type</label>
              <select value={type} onChange={(e) => setType(e.target.value)}>
                <option value="monthly">Monthly ₹150</option>
                <option value="one-time">One-Time ₹1,000</option>
              </select>
              {type === "monthly" && (
                <>
                  <label>Month</label>
                  <select
                    value={month}
                    onChange={(e) => setMonth(e.target.value)}
                  >
                    {MONTHS.map((m) => (
                      <option key={m}>{m}</option>
                    ))}
                  </select>
                </>
              )}
              <p className="note">
                Cash only. Payment is counted after Admin confirms receipt.
              </p>
              <button
                className="primary full-btn"
                onClick={submitPayment}
                disabled={loading}
              >
                Submit Payment Request
              </button>
            </div>
            <div className="content-card">
              <div className="pin-heading">
                <div>
                  <h3>Change PIN</h3>
                  <small>Update your account security PIN.</small>
                </div>
                <button
                  className="secondary"
                  onClick={() => setShowPinForm((v) => !v)}
                >
                  {showPinForm ? "Cancel" : "Change PIN"}
                </button>
              </div>
              {showPinForm && (
                <>
                  <label>Current PIN</label>
                  <input
                    type="password"
                    maxLength="4"
                    value={oldPin}
                    onChange={(e) =>
                      setOldPin(e.target.value.replace(/\D/g, ""))
                    }
                  />
                  <label>New PIN</label>
                  <input
                    type="password"
                    maxLength="4"
                    value={newPin}
                    onChange={(e) =>
                      setNewPin(e.target.value.replace(/\D/g, ""))
                    }
                  />
                  <button
                    className="primary full-btn"
                    onClick={changePin}
                    disabled={loading}
                  >
                    Save New PIN
                  </button>
                </>
              )}
            </div>
            <div className="content-card">
              <div className="dashboard-heading">
                <div>
                  <h3>Collection Status – All Members</h3>
                  <p className="subtitle">Shared read-only payment status</p>
                </div>
                <button
                  className="secondary"
                  onClick={() => act(() => loadPublicCollection(token))}
                >
                  Refresh
                </button>
              </div>
              <MemberTable members={publicMembers} />
            </div>
          </>
        )}
        {page === "admin" && (
          <>
            <div className="dashboard-heading">
              <div>
                <h2>Admin Dashboard</h2>
                <p className="subtitle">
                  Manage members and collection entries
                </p>
              </div>
              <button className="secondary" onClick={logout}>
                Logout
              </button>
            </div>
            <button
              className="primary full-btn"
              onClick={refreshAdmin}
              disabled={loading}
            >
              Refresh All Data
            </button>
            <h3>All Members ({members.length})</h3>
            {members.map((m) => (
              <article className="member-card" key={m.id}>
                <div className="member-top">
                  <div>
                    <b>{m.name}</b>
                    <small>{m.status}</small>
                  </div>
                  <b>Total: ₹{m.grandTotal}</b>
                </div>
                <div className="member-summary">
                  <span>Monthly ₹{m.monthlyTotal}</span>
                  <span>One-Time ₹{m.oneTime}</span>
                </div>
                <div className="member-months">
                  {m.monthly.map((x) => (
                    <span
                      key={x.month}
                      className={x.paid ? "paid-pill" : "unpaid-pill"}
                    >
                      {x.month}: {x.paid ? `₹${x.amount} Paid` : "Pending"}
                    </span>
                  ))}
                </div>
                <div className="actions">
                  <button className="secondary" onClick={() => renameMember(m)}>
                    Edit Name
                  </button>
                  <button className="danger" onClick={() => deleteMember(m)}>
                    Delete Member
                  </button>
                </div>
              </article>
            ))}
            <h3>Payment Requests & Entries</h3>
            {requests.map((r) => (
              <article className="request" key={r.id}>
                <b>{r.name}</b>
                <span>
                  {r.type === "monthly"
                    ? `${r.month} • ₹150`
                    : "One-Time • ₹1,000"}
                </span>
                <small>{r.status} • Cash</small>
                {r.status === "Pending" && (
                  <div className="actions">
                    <button
                      className="primary"
                      onClick={() => adminAction(r.id, "confirm")}
                    >
                      Confirm Cash Received
                    </button>
                    <button
                      className="danger"
                      onClick={() => adminAction(r.id, "reject")}
                    >
                      Reject
                    </button>
                  </div>
                )}
                {r.status === "Confirmed" && (
                  <button
                    className="danger full-btn"
                    onClick={() => {
                      if (
                        window.confirm(
                          "Remove this payment from collection totals?",
                        )
                      )
                        adminAction(r.id, "remove");
                    }}
                  >
                    Remove Payment Entry
                  </button>
                )}
              </article>
            ))}
          </>
        )}
      </section>
      <footer>
        Ganpati Collection • Cash payments only • October 2026 – September 2027
      </footer>
    </main>
  );
}

createRoot(document.getElementById("root")).render(<App />);
