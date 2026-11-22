import React from "react";
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

export default MemberTable;
