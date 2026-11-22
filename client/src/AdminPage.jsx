import React from "react";

export default function AdminPage(props) {
  const {
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
  } = props;
  return (
    <>
      <div className="admin-heading">
        <div>
          <span className="admin-kicker">COLLECTION CONTROL</span>
          <h2>Admin Dashboard</h2>
          <p className="subtitle">
            Google Sheet collection overview and member-wise entries
          </p>
        </div>
        <div className="admin-head-actions">
          <button
            className="secondary"
            onClick={refreshAdmin}
            disabled={loading}
          >
            ↻ Refresh
          </button>
          <button className="secondary" onClick={logout}>
            Logout
          </button>
        </div>
      </div>

      <div className="admin-stats-grid">
        <div className="admin-stat">
          <small>Total Members</small>
          <strong>{members.length}</strong>
        </div>
        <div className="admin-stat">
          <small>Expected Collection</small>
          <strong>₹{(members.length * 2800).toLocaleString("en-IN")}</strong>
          <span>₹150 × 12 + ₹1,000 each</span>
        </div>
        <div className="admin-stat">
          <small>Total Received</small>
          <strong>
            ₹
            {members
              .reduce((sum, m) => sum + Number(m.grandTotal || 0), 0)
              .toLocaleString("en-IN")}
          </strong>
          <span>Confirmed sheet entries</span>
        </div>
        <div className="admin-stat">
          <small>Balance Pending</small>
          <strong>
            ₹
            {Math.max(
              0,
              members.length * 2800 -
                members.reduce((sum, m) => sum + Number(m.grandTotal || 0), 0),
            ).toLocaleString("en-IN")}
          </strong>
          <span>Expected minus received</span>
        </div>
        <div className="admin-stat admin-stat-pending">
          <small>Pending Cash Requests</small>
          <strong>
            {requests.filter((r) => r.status === "Pending").length}
          </strong>
          <span>Awaiting admin confirmation</span>
        </div>
      </div>

      <div className="admin-section-heading">
        <div>
          <h3>Members</h3>
          <p className="subtitle">
            Select a member to see only their collection and payment entries.
          </p>
        </div>
        <input
          className="member-search"
          value={memberSearch}
          onChange={(e) => setMemberSearch(e.target.value)}
          placeholder="Search member name..."
        />
      </div>

      {!selectedMemberId ? (
        <div className="admin-member-grid">
          {members
            .filter((m) =>
              m.name.toLowerCase().includes(memberSearch.trim().toLowerCase()),
            )
            .map((m) => (
              <button
                type="button"
                className="admin-member-tile"
                key={m.id}
                onClick={() => setSelectedMemberId(m.id)}
              >
                <span className="admin-avatar">
                  {m.name.slice(0, 1).toUpperCase()}
                </span>
                <span className="admin-member-info">
                  <b>{m.name}</b>
                  <small>{m.status || "Active"}</small>
                </span>
                <span className="admin-member-total">
                  ₹{Number(m.grandTotal || 0).toLocaleString("en-IN")}
                </span>
                <span className="admin-chevron">›</span>
              </button>
            ))}
          {members.filter((m) =>
            m.name.toLowerCase().includes(memberSearch.trim().toLowerCase()),
          ).length === 0 && <p className="empty-state">No members found.</p>}
        </div>
      ) : (
        (() => {
          const m = members.find((x) => x.id === selectedMemberId);
          if (!m)
            return (
              <div className="empty-state">
                Member not found.{" "}
                <button onClick={() => setSelectedMemberId("")}>
                  Back to members
                </button>
              </div>
            );
          const memberRequests = requests.filter((r) => r.memberId === m.id);
          return (
            <div className="member-detail-panel">
              <div className="member-detail-heading">
                <button
                  className="secondary"
                  onClick={() => setSelectedMemberId("")}
                >
                  ← All Members
                </button>
                <div className="member-detail-title">
                  <span className="admin-avatar large">
                    {m.name.slice(0, 1).toUpperCase()}
                  </span>
                  <div>
                    <h3>{m.name}</h3>
                    <small>
                      {m.status || "Active"} · Member collection details
                    </small>
                  </div>
                </div>
                <div className="actions">
                  <button className="secondary" onClick={() => renameMember(m)}>
                    Edit Name
                  </button>
                  <button className="danger" onClick={() => deleteMember(m)}>
                    Delete Member
                  </button>
                </div>
              </div>

              <div className="member-detail-stats">
                <div>
                  <small>Monthly Total</small>
                  <b>₹{Number(m.monthlyTotal || 0).toLocaleString("en-IN")}</b>
                </div>
                <div>
                  <small>One-Time</small>
                  <b>₹{Number(m.oneTime || 0).toLocaleString("en-IN")}</b>
                </div>
                <div>
                  <small>Total Paid</small>
                  <b>₹{Number(m.grandTotal || 0).toLocaleString("en-IN")}</b>
                </div>
                <div>
                  <small>Remaining</small>
                  <b>
                    ₹
                    {Math.max(
                      0,
                      2800 - Number(m.grandTotal || 0),
                    ).toLocaleString("en-IN")}
                  </b>
                </div>
              </div>

              <h3 className="detail-section-title">Monthly Payment Details</h3>
              <div className="month-detail-grid">
                {m.monthly.map((x) => (
                  <div
                    className={`month-detail ${x.paid ? "is-paid" : "is-unpaid"}`}
                    key={x.month}
                  >
                    <span>{x.month}</span>
                    <b>{x.paid ? `₹${x.amount} · Paid` : "Not Paid"}</b>
                  </div>
                ))}
              </div>

              <div
                className={`one-time-detail ${m.oneTime >= 1000 ? "is-paid" : "is-unpaid"}`}
              >
                <span>One-Time Contribution</span>
                <b>
                  {m.oneTime >= 1000 ? "₹1,000 · Paid" : "₹1,000 · Not Paid"}
                </b>
              </div>

              <h3 className="detail-section-title">
                This Member's Payment Requests
              </h3>
              {memberRequests.length === 0 ? (
                <p className="empty-state">
                  No payment requests for this member.
                </p>
              ) : (
                memberRequests.map((r) => (
                  <article className="request admin-request" key={r.id}>
                    <div className="request-main">
                      <b>
                        {r.type === "monthly"
                          ? r.month
                          : "One-Time Contribution"}
                      </b>
                      <strong>
                        ₹{Number(r.amount).toLocaleString("en-IN")}
                      </strong>
                    </div>
                    <small>{r.status} · Cash</small>
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
                              "Remove this payment from the collection total?",
                            )
                          )
                            adminAction(r.id, "remove");
                        }}
                      >
                        Remove Payment Entry
                      </button>
                    )}
                  </article>
                ))
              )}
            </div>
          );
        })()
      )}

      {!selectedMemberId && requests.some((r) => r.status === "Pending") && (
        <div className="pending-queue">
          <h3>Pending Cash Requests</h3>
          <p className="subtitle">
            These requests are waiting for cash verification.
          </p>
          {requests
            .filter((r) => r.status === "Pending")
            .map((r) => (
              <article className="request" key={r.id}>
                <div className="request-main">
                  <b>{r.name}</b>
                  <strong>₹{Number(r.amount).toLocaleString("en-IN")}</strong>
                </div>
                <small>
                  {r.type === "monthly" ? r.month : "One-Time"} · Pending · Cash
                </small>
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
                  <button
                    className="secondary"
                    onClick={() => setSelectedMemberId(r.memberId)}
                  >
                    View Member
                  </button>
                </div>
              </article>
            ))}
        </div>
      )}
    </>
  );
}
