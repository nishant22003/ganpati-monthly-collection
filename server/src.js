import "dotenv/config";
import express from "express";
import cors from "cors";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { randomUUID } from "node:crypto";
import { google } from "googleapis";

const app = express();
app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "https://ganpati-monthly-collection.vercel.app",
    ],
  }),
);
app.use(express.json());

const PORT = Number(process.env.PORT || 5000);
const spreadsheetId = process.env.SPREADSHEET_ID;
if (!spreadsheetId || !process.env.JWT_SECRET) {
  throw new Error("Set SPREADSHEET_ID and JWT_SECRET in server/.env");
}
const auth = new google.auth.GoogleAuth({
  keyFile:
    process.env.GOOGLE_APPLICATION_CREDENTIALS || "./service-account.json",
  scopes: ["https://www.googleapis.com/auth/spreadsheets"],
});
const sheets = google.sheets({ version: "v4", auth });

// Short-lived in-memory cache for dashboard reads.
// Writes invalidate the cache so payment/member changes appear immediately.
const READ_CACHE_TTL_MS = 10000;
const readCache = new Map();

async function cachedRows(tab, range = "A:Z") {
  const key = `${tab}:${range}`;
  const now = Date.now();
  const cached = readCache.get(key);
  if (cached?.pending) return cached.pending;
  if (cached && now - cached.time < READ_CACHE_TTL_MS) return cached.value;

  const pending = rows(tab, range)
    .then((value) => {
      readCache.set(key, { time: Date.now(), value });
      return value;
    })
    .catch((error) => {
      readCache.delete(key);
      throw error;
    });

  readCache.set(key, { time: now, pending });
  return pending;
}

function invalidateReadCache() {
  readCache.clear();
}

async function rows(tab, range = "A:Z") {
  const r = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `'${tab}'!${range}`,
  });
  return r.data.values || [];
}
async function append(tab, values) {
  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: `'${tab}'!A:Z`,
    valueInputOption: "USER_ENTERED",
    insertDataOption: "INSERT_ROWS",
    requestBody: { values: [values] },
  });
  invalidateReadCache();
}
async function updateCell(tab, cell, value) {
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `'${tab}'!${cell}`,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [[value]] },
  });
  invalidateReadCache();
}
function tokenFor(payload) {
  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: "12h" });
}
function authRequired(req, res, next) {
  const token = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: "Please login again." });
  }
}
function adminRequired(req, res, next) {
  if (req.user?.role !== "admin")
    return res.status(403).json({ error: "Admin access required." });
  next();
}
const clean = (s) => String(s || "").trim();
const validPin = (p) => /^\d{4}$/.test(String(p));
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

app.get("/api/health", (_, res) => res.json({ ok: true }));

app.post("/api/register", async (req, res) => {
  try {
    const name = clean(req.body.name),
      pin = String(req.body.pin || ""),
      confirm = String(req.body.confirmPin || "");
    if (name.length < 2 || name.length > 50)
      return res.status(400).json({ error: "Enter a valid name." });
    if (!validPin(pin) || pin !== confirm)
      return res
        .status(400)
        .json({ error: "PIN must be 4 digits and both PINs must match." });
    const members = await rows("Members");
    if (
      members
        .slice(1)
        .some((r) => clean(r[1]).toLowerCase() === name.toLowerCase())
    )
      return res
        .status(409)
        .json({ error: "This name is already registered." });
    const id = randomUUID();
    const hash = await bcrypt.hash(pin, 12);
    await append("Members", [
      id,
      name,
      hash,
      "Active",
      new Date().toISOString(),
    ]);
    res.json({ message: "Account created. Please login." });
  } catch (e) {
    console.error(e);
    res
      .status(500)
      .json({ error: "Registration failed. Check server and Sheet access." });
  }
});

app.post("/api/login", async (req, res) => {
  try {
    const name = clean(req.body.name),
      pin = String(req.body.pin || "");
    const members = await rows("Members");
    const member = members
      .slice(1)
      .find(
        (r) =>
          clean(r[1]).toLowerCase() === name.toLowerCase() && r[3] === "Active",
      );
    if (!member || !(await bcrypt.compare(pin, member[2] || "")))
      return res.status(401).json({ error: "Invalid name or PIN." });
    res.json({
      token: tokenFor({ role: "member", id: member[0], name: member[1] }),
      user: { name: member[1], role: "member" },
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Login failed." });
  }
});

app.post("/api/change-pin", authRequired, async (req, res) => {
  try {
    const oldPin = String(req.body.oldPin || ""),
      newPin = String(req.body.newPin || "");
    if (!validPin(newPin))
      return res.status(400).json({ error: "New PIN must contain 4 digits." });
    const members = await rows("Members");
    const idx = members.findIndex((r, i) => i > 0 && r[0] === req.user.id);
    if (idx < 1 || !(await bcrypt.compare(oldPin, members[idx][2] || "")))
      return res.status(400).json({ error: "Current PIN is incorrect." });
    const rowNumber = idx + 1,
      hash = await bcrypt.hash(newPin, 12);
    await updateCell("Members", `C${rowNumber}`, hash);
    res.json({ message: "PIN changed successfully." });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Could not change PIN." });
  }
});

app.post("/api/payment-requests", authRequired, async (req, res) => {
  try {
    const type = req.body.type,
      month = clean(req.body.month);
    const amount = type === "monthly" ? 150 : type === "one-time" ? 1000 : 0;
    if (!amount)
      return res.status(400).json({ error: "Invalid payment type." });
    if (type === "monthly" && !MONTHS.includes(month))
      return res.status(400).json({ error: "Select a valid month." });
    const all = await rows("Payment Requests");
    const duplicate = all
      .slice(1)
      .some(
        (r) =>
          r[1] === req.user.id &&
          r[3] === type &&
          (type === "one-time" || r[4] === month) &&
          ["Pending", "Confirmed"].includes(r[7]),
      );
    if (duplicate)
      return res
        .status(409)
        .json({ error: "A request/payment already exists for this period." });
    const id = randomUUID();
    await append("Payment Requests", [
      id,
      req.user.id,
      req.user.name,
      type,
      month,
      amount,
      "Cash",
      "Pending",
      new Date().toISOString(),
      "",
      "",
    ]);
    res.json({
      message:
        "Cash payment request submitted. It will count after Admin confirms receipt.",
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Could not submit payment request." });
  }
});

app.post("/api/admin/login", (req, res) => {
  if (String(req.body.pin || "") !== String(process.env.ADMIN_PIN || ""))
    return res.status(401).json({ error: "Incorrect admin PIN." });
  res.json({
    token: tokenFor({ role: "admin", name: "Admin" }),
    user: { name: "Admin", role: "admin" },
  });
});

app.get(
  "/api/admin/requests",
  authRequired,
  adminRequired,
  async (req, res) => {
    const all = await cachedRows("Payment Requests");
    res.json({
      requests: all
        .slice(1)
        .map((r, i) => ({
          row: i + 2,
          id: r[0],
          memberId: r[1],
          name: r[2],
          type: r[3],
          month: r[4],
          amount: Number(r[5]),
          mode: r[6],
          status: r[7],
        }))
        .filter((r) => r.id),
    });
  },
);

app.post(
  "/api/admin/requests/:id/confirm",
  authRequired,
  adminRequired,
  async (req, res) => {
    try {
      const all = await rows("Payment Requests");
      const idx = all.findIndex((r, i) => i > 0 && r[0] === req.params.id);
      if (idx < 1) return res.status(404).json({ error: "Request not found." });
      const r = all[idx],
        row = idx + 1;
      if (r[7] !== "Pending")
        return res.status(409).json({ error: "Request is not pending." });
      const members = await rows("Monthly Collection");
      // Sheet layout: Member Name in B, months C:N, One-Time in O; members start row 7.
      const nameRows = members.slice(6);
      let memberOffset = nameRows.findIndex(
        (x) => clean(x[1]).toLowerCase() === clean(r[2]).toLowerCase(),
      );
      if (memberOffset < 0) {
        memberOffset = nameRows.findIndex((x) => !clean(x[1]));
        if (memberOffset < 0) memberOffset = nameRows.length;
        const targetRow = 7 + memberOffset;
        await updateCell("Monthly Collection", `B${targetRow}`, r[2]);
      }
      const targetRow = 7 + memberOffset;
      const sheetRow = members[targetRow - 1] || [];
      if (r[3] === "monthly") {
        const monthIndex = MONTHS.indexOf(r[4]);
        if (monthIndex < 0)
          return res.status(400).json({ error: "Invalid collection month." });
        const col = String.fromCharCode(67 + monthIndex); // C through N
        const existing = sheetRow[2 + monthIndex];
        if (existing)
          return res
            .status(409)
            .json({ error: "This month is already marked paid." });
        await updateCell("Monthly Collection", `${col}${targetRow}`, 150);
      } else {
        const existing = sheetRow[14]; // O
        if (existing)
          return res
            .status(409)
            .json({ error: "One-time payment already recorded." });
        await updateCell("Monthly Collection", `O${targetRow}`, 1000);
      }
      await updateCell("Payment Requests", `H${row}`, "Confirmed");
      await updateCell("Payment Requests", `J${row}`, new Date().toISOString());
      await updateCell("Payment Requests", `K${row}`, "Admin");
      await append("Entry Log", [
        randomUUID(),
        r[0],
        new Date().toISOString(),
        r[1],
        r[2],
        r[3],
        r[4],
        r[5],
        "Cash",
        "Confirmed",
      ]);
      await append("Admin Log", [
        new Date().toISOString(),
        "CONFIRM",
        r[0],
        r[2],
        r[5],
        "Cash received and confirmed",
      ]);
      res.json({ message: "Payment confirmed." });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: "Could not confirm payment." });
    }
  },
);

app.post(
  "/api/admin/requests/:id/reject",
  authRequired,
  adminRequired,
  async (req, res) => {
    try {
      const all = await rows("Payment Requests");
      const idx = all.findIndex((r, i) => i > 0 && r[0] === req.params.id);
      if (idx < 1) return res.status(404).json({ error: "Request not found." });
      const r = all[idx],
        row = idx + 1;
      if (r[7] !== "Pending")
        return res
          .status(409)
          .json({ error: "Only pending requests can be rejected." });
      await updateCell("Payment Requests", `H${row}`, "Rejected");
      await append("Admin Log", [
        new Date().toISOString(),
        "REJECT",
        r[0],
        r[2],
        r[5],
        clean(req.body.reason) || "Not received",
      ]);
      res.json({ message: "Request rejected." });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: "Could not reject request." });
    }
  },
);

// Build read-only collection details from Members and Monthly Collection tabs.
async function getCollectionMembers() {
  const [allMembers, collectionRows] = await Promise.all([
    cachedRows("Members"),
    cachedRows("Monthly Collection"),
  ]);
  const result = allMembers
    .slice(1)
    .filter((r) => r[0] && r[3] !== "Deleted")
    .map((member) => {
      const collection =
        collectionRows
          .slice(6)
          .find(
            (r) => clean(r[1]).toLowerCase() === clean(member[1]).toLowerCase(),
          ) || [];
      const monthly = MONTHS.map((month, i) => {
        const amount = Number(collection[i + 2] || 0);
        return { month, amount, paid: amount >= 150 };
      });
      const monthlyTotal = monthly.reduce((sum, item) => sum + item.amount, 0);
      const oneTime = Number(collection[14] || 0);
      return {
        id: member[0],
        name: member[1],
        status: member[3],
        monthly,
        monthlyTotal,
        oneTime,
        grandTotal: monthlyTotal + oneTime,
      };
    });
  return result;
}

// Logged-in members can see the shared read-only collection status.
app.get("/api/collection", authRequired, async (req, res) => {
  try {
    const members = await getCollectionMembers();
    res.json({ members, months: MONTHS });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Could not load collection status." });
  }
});

// Admin gets the same full details plus member IDs for management actions.
app.get("/api/admin/members", authRequired, adminRequired, async (req, res) => {
  try {
    const members = await getCollectionMembers();
    res.json({ members, months: MONTHS });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Could not load members." });
  }
});

// One dashboard request loads member collection and payment requests together.
app.get(
  "/api/admin/dashboard",
  authRequired,
  adminRequired,
  async (req, res) => {
    try {
      const [members, allRequests] = await Promise.all([
        getCollectionMembers(),
        cachedRows("Payment Requests"),
      ]);
      const requests = allRequests
        .slice(1)
        .map((r, i) => ({
          row: i + 2,
          id: r[0],
          memberId: r[1],
          name: r[2],
          type: r[3],
          month: r[4],
          amount: Number(r[5]),
          mode: r[6],
          status: r[7],
        }))
        .filter((r) => r.id);
      res.json({ members, requests, months: MONTHS });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: "Could not load admin dashboard." });
    }
  },
);

// Admin: rename a member consistently across the member and collection logs.
app.post(
  "/api/admin/members/:id/rename",
  authRequired,
  adminRequired,
  async (req, res) => {
    try {
      const newName = clean(req.body.name);
      if (newName.length < 2 || newName.length > 50)
        return res
          .status(400)
          .json({ error: "Enter a valid name (2–50 characters)." });
      const all = await rows("Members");
      const idx = all.findIndex((r, i) => i > 0 && r[0] === req.params.id);
      if (idx < 1) return res.status(404).json({ error: "Member not found." });
      const oldName = clean(all[idx][1]);
      if (
        all
          .slice(1)
          .some(
            (r, i) =>
              i + 1 !== idx &&
              r[3] === "Active" &&
              clean(r[1]).toLowerCase() === newName.toLowerCase(),
          )
      )
        return res
          .status(409)
          .json({ error: "Another active member already has this name." });
      const memberRow = idx + 1;
      await updateCell("Members", `B${memberRow}`, newName);
      const collection = await rows("Monthly Collection");
      const cidx = collection.findIndex(
        (r, i) => i >= 6 && clean(r[1]).toLowerCase() === oldName.toLowerCase(),
      );
      if (cidx >= 6)
        await updateCell("Monthly Collection", `B${cidx + 1}`, newName);
      const requests = await rows("Payment Requests");
      for (let i = 1; i < requests.length; i++)
        if (clean(requests[i][1]) === req.params.id)
          await updateCell("Payment Requests", `C${i + 1}`, newName);
      const entries = await rows("Entry Log");
      for (let i = 1; i < entries.length; i++)
        if (clean(entries[i][3]) === req.params.id)
          await updateCell("Entry Log", `E${i + 1}`, newName);
      await append("Admin Log", [
        new Date().toISOString(),
        "RENAME_MEMBER",
        "",
        `${oldName} → ${newName}`,
        "",
        "Member name updated by admin",
      ]);
      res.json({ message: "Member name updated." });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: "Could not update member name." });
    }
  },
);

// Admin: permanently clear member credentials, name, collection row and linked payment records.
// Blank rows are kept (rather than deleting physical rows) so the formatted sheet and total formulas stay in place.
app.post(
  "/api/admin/members/:id/delete",
  authRequired,
  adminRequired,
  async (req, res) => {
    try {
      const allMembers = await rows("Members");
      const memberIndex = allMembers.findIndex(
        (r, i) => i > 0 && r[0] === req.params.id,
      );
      if (memberIndex < 1)
        return res.status(404).json({ error: "Member not found." });
      const member = allMembers[memberIndex];
      const memberRow = memberIndex + 1;
      const memberName = clean(member[1]);

      const collection = await rows("Monthly Collection");
      const collectionIndex = collection.findIndex(
        (r, i) =>
          i >= 6 && clean(r[1]).toLowerCase() === memberName.toLowerCase(),
      );

      const paymentRequests = await rows("Payment Requests");
      const requestRanges = [];
      for (let i = 1; i < paymentRequests.length; i++) {
        if (clean(paymentRequests[i][1]) === req.params.id)
          requestRanges.push(`'Payment Requests'!A${i + 1}:K${i + 1}`);
      }

      const entryLog = await rows("Entry Log");
      const entryRanges = [];
      for (let i = 1; i < entryLog.length; i++) {
        if (clean(entryLog[i][3]) === req.params.id)
          entryRanges.push(`'Entry Log'!A${i + 1}:J${i + 1}`);
      }

      const ranges = [
        `'Members'!A${memberRow}:E${memberRow}`,
        ...(collectionIndex >= 6
          ? [
              `'Monthly Collection'!B${collectionIndex + 1}:O${collectionIndex + 1}`,
            ]
          : []),
        ...requestRanges,
        ...entryRanges,
      ];

      // Clear identity, PIN hash, payment requests, confirmed-entry logs and the member's collection cells.
      await sheets.spreadsheets.values.batchClear({
        spreadsheetId,
        requestBody: { ranges },
      });

      // Keep a minimal admin audit record; do not retain the deleted member ID or PIN hash.
      await append("Admin Log", [
        new Date().toISOString(),
        "DELETE_MEMBER_AND_DATA",
        "",
        memberName,
        "",
        `Deleted member credentials, collection row and ${requestRanges.length} payment request(s), ${entryRanges.length} entry log(s)`,
      ]);

      res.json({
        message:
          "Member name, ID, PIN hash, collection entries and linked payment records were deleted from their sheets.",
      });
    } catch (e) {
      console.error(e);
      res
        .status(500)
        .json({ error: "Could not delete member and linked sheet data." });
    }
  },
);

// Admin: remove a confirmed payment from the collection and mark its logs as removed.
app.post(
  "/api/admin/requests/:id/remove",
  authRequired,
  adminRequired,
  async (req, res) => {
    try {
      const all = await rows("Payment Requests");
      const idx = all.findIndex((r, i) => i > 0 && r[0] === req.params.id);
      if (idx < 1)
        return res.status(404).json({ error: "Payment request not found." });
      const r = all[idx];
      if (r[7] !== "Confirmed")
        return res
          .status(409)
          .json({ error: "Only confirmed payments can be removed." });
      const collection = await rows("Monthly Collection");
      const memberOffset = collection
        .slice(6)
        .findIndex(
          (x) => clean(x[1]).toLowerCase() === clean(r[2]).toLowerCase(),
        );
      if (memberOffset < 0)
        return res
          .status(404)
          .json({ error: "Member row not found in Monthly Collection." });
      const sheetRow = 7 + memberOffset;
      if (r[3] === "monthly") {
        const mi = MONTHS.indexOf(r[4]);
        if (mi < 0)
          return res
            .status(400)
            .json({ error: "Invalid month on payment request." });
        const col = String.fromCharCode(67 + mi);
        await updateCell("Monthly Collection", `${col}${sheetRow}`, "");
      } else {
        await updateCell("Monthly Collection", `O${sheetRow}`, "");
      }
      await updateCell("Payment Requests", `H${idx + 1}`, "Removed");
      const entries = await rows("Entry Log");
      for (let i = 1; i < entries.length; i++)
        if (
          clean(entries[i][1]) === req.params.id &&
          entries[i][9] === "Confirmed"
        )
          await updateCell("Entry Log", `J${i + 1}`, "Removed");
      const reason = clean(req.body.reason) || "Payment entry removed by admin";
      await append("Admin Log", [
        new Date().toISOString(),
        "REMOVE_PAYMENT",
        r[0],
        r[2],
        r[5],
        reason,
      ]);
      res.json({
        message:
          "Payment entry removed from collection. Audit history retained.",
      });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: "Could not remove payment entry." });
    }
  },
);

app.listen(PORT, () =>
  console.log(`Ganpati API running at http://localhost:${PORT}`),
);
