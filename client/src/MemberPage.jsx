import React from "react";
import MemberTable from "./MemberTable.jsx";

export default function MemberPage(props) {
  const {
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
  } = props;
  const paidMonths = new Set(
    (
      publicMembers.find(
        (member) => member.name?.toLowerCase() === user?.name?.toLowerCase(),
      )?.monthly || []
    )
      .filter((item) => item.paid)
      .map((item) => item.month),
  );
  return (
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
            <select value={month} onChange={(e) => setMonth(e.target.value)}>
              {MONTHS.map((m) => (
                <option key={m} value={m} disabled={paidMonths.has(m)}>
                  {m}
                  {paidMonths.has(m) ? " — Paid ✓" : " — Pending"}
                </option>
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
              onChange={(e) => setOldPin(e.target.value.replace(/\D/g, ""))}
            />
            <label>New PIN</label>
            <input
              type="password"
              maxLength="4"
              value={newPin}
              onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ""))}
            />
            <label>Confirm New PIN</label>
            <input
              type="password"
              inputMode="numeric"
              maxLength="4"
              value={confirmNewPin}
              onChange={(e) =>
                setConfirmNewPin(e.target.value.replace(/\D/g, ""))
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
  );
}
