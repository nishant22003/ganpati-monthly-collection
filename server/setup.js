// import "dotenv/config";
// import { google } from "googleapis";

// const spreadsheetId = process.env.SPREADSHEET_ID;
// if (!spreadsheetId) throw new Error("SPREADSHEET_ID missing in .env");

// const auth = new google.auth.GoogleAuth({
//   keyFile:
//     process.env.GOOGLE_APPLICATION_CREDENTIALS || "./service-account.json",
//   scopes: ["https://www.googleapis.com/auth/spreadsheets"],
// });

// const sheets = google.sheets({ version: "v4", auth });

// const months = [
//   "January",
//   "February",
//   "March",
//   "April",
//   "May",
//   "June",
//   "July",
//   "August",
//   "September",
//   "October",
//   "November",
//   "December",
// ];

// // New Monthly Collection layout:
// // B = Member Name
// // C:N = January to December
// // O = One-Time ₹1,000
// // Row 7 to 106 = Members
// // Row 107 = Totals

// const monthlyRows = Array.from({ length: 111 }, () => []);

// monthlyRows[0] = ["GANPATI MONTHLY COLLECTION"];
// monthlyRows[4] = ["", "Member Name", ...months, "One-Time ₹1,000"];

// monthlyRows[5] = ["Monthly ₹150 | One-Time ₹1,000 | Cash Only"];

// monthlyRows[106] = [
//   "",
//   "TOTAL",
//   ...Array.from(
//     { length: 13 },
//     (_, i) =>
//       `=SUM(${String.fromCharCode(67 + i)}7:${String.fromCharCode(67 + i)}106)`,
//   ),
// ];

// monthlyRows[108] = ["", "MONTHLY TOTAL", "=SUM(C107:N107)"];
// monthlyRows[109] = ["", "ONE-TIME TOTAL", "=O107"];
// monthlyRows[110] = ["", "GRAND TOTAL", "=C109+C110"];

// const tabs = {
//   "Monthly Collection": monthlyRows,

//   Members: [["Member ID", "Name", "PIN Hash", "Status", "Created At"]],

//   "Payment Requests": [
//     [
//       "Request ID",
//       "Member ID",
//       "Member Name",
//       "Payment Type",
//       "Month",
//       "Amount",
//       "Payment Mode",
//       "Status",
//       "Requested At",
//       "Confirmed At",
//       "Confirmed By",
//     ],
//   ],

//   "Entry Log": [
//     [
//       "Entry ID",
//       "Request ID",
//       "Date",
//       "Member ID",
//       "Member Name",
//       "Payment Type",
//       "Month",
//       "Amount",
//       "Payment Mode",
//       "Status",
//     ],
//   ],

//   "Admin Log": [
//     ["Date", "Action", "Request ID", "Member Name", "Amount", "Reason"],
//   ],

//   "Collection Summary": [
//     ["Collection Summary", "Amount"],
//     ["Monthly Collection Total", "=SUM('Monthly Collection'!C7:N106)"],
//     ["One-Time Collection Total", "=SUM('Monthly Collection'!O7:O106)"],
//     ["Grand Total", "=B2+B3"],
//     ["Monthly Contribution", 150],
//     ["One-Time Contribution", 1000],
//   ],
// };

// const meta = await sheets.spreadsheets.get({ spreadsheetId });
// const existing = new Set(
//   (meta.data.sheets || []).map((s) => s.properties.title),
// );

// // Create only missing tabs.
// const requests = [];

// for (const title of Object.keys(tabs)) {
//   if (!existing.has(title)) {
//     requests.push({
//       addSheet: { properties: { title } },
//     });
//   }
// }

// if (requests.length) {
//   await sheets.spreadsheets.batchUpdate({
//     spreadsheetId,
//     requestBody: { requests },
//   });
// }

// // Fill only completely empty tabs.
// // Existing data and formatting will not be overwritten.
// for (const [title, values] of Object.entries(tabs)) {
//   const range = `'${title}'!A1`;

//   const current = await sheets.spreadsheets.values
//     .get({
//       spreadsheetId,
//       range,
//     })
//     .catch(() => ({ data: { values: [] } }));

//   if (!current.data.values?.length) {
//     await sheets.spreadsheets.values.update({
//       spreadsheetId,
//       range,
//       valueInputOption: "USER_ENTERED",
//       requestBody: { values },
//     });

//     console.log(`Created data for: ${title}`);
//   } else {
//     console.log(`Preserved existing tab: ${title}`);
//   }
// }

// console.log("Ganpati Collection setup completed successfully!");

import "dotenv/config";
import { google } from "googleapis";

const spreadsheetId = process.env.SPREADSHEET_ID;
if (!spreadsheetId) throw new Error("SPREADSHEET_ID missing in .env");
const auth = new google.auth.GoogleAuth({
  keyFile:
    process.env.GOOGLE_APPLICATION_CREDENTIALS || "./service-account.json",
  scopes: ["https://www.googleapis.com/auth/spreadsheets"],
});
const sheets = google.sheets({ version: "v4", auth });
const months = [
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

const meta = await sheets.spreadsheets.get({ spreadsheetId });
const existing = new Set(
  (meta.data.sheets || []).map((s) => s.properties.title),
);
const missing = [
  "Monthly Collection",
  "Members",
  "Payment Requests",
  "Entry Log",
  "Admin Log",
  "Collection Summary",
].filter((t) => !existing.has(t));
if (missing.length)
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: missing.map((title) => ({
        addSheet: { properties: { title } },
      })),
    },
  });

// Update only the required header/formula cells; preserve member/payment data.
const updates = [
  {
    range: "'Monthly Collection'!B5:O5",
    values: [["Member Name", ...months, "One-Time ₹1,000"]],
  },
  {
    range: "'Monthly Collection'!B107:O107",
    values: [
      [
        "TOTAL",
        ...Array.from(
          { length: 12 },
          (_, i) =>
            `=SUM(${String.fromCharCode(67 + i)}7:${String.fromCharCode(67 + i)}106)`,
        ),
        "=SUM(O7:O106)",
      ],
    ],
  },
  {
    range: "'Monthly Collection'!B109:C111",
    values: [
      ["MONTHLY TOTAL", "=SUM(C107:N107)"],
      ["ONE-TIME TOTAL", "=O107"],
      ["GRAND TOTAL", "=C109+C110"],
    ],
  },
  {
    range: "'Members'!A1:E1",
    values: [["Member ID", "Name", "PIN Hash", "Status", "Created At"]],
  },
  {
    range: "'Payment Requests'!A1:K1",
    values: [
      [
        "Request ID",
        "Member ID",
        "Member Name",
        "Payment Type",
        "Month",
        "Amount",
        "Payment Mode",
        "Status",
        "Requested At",
        "Confirmed At",
        "Confirmed By",
      ],
    ],
  },
  {
    range: "'Entry Log'!A1:J1",
    values: [
      [
        "Entry ID",
        "Request ID",
        "Date",
        "Member ID",
        "Member Name",
        "Payment Type",
        "Month",
        "Amount",
        "Payment Mode",
        "Status",
      ],
    ],
  },
  {
    range: "'Admin Log'!A1:F1",
    values: [
      ["Date", "Action", "Request ID", "Member Name", "Amount", "Reason"],
    ],
  },
  {
    range: "'Collection Summary'!A1:B6",
    values: [
      ["Collection Summary", "Amount"],
      ["Monthly Collection Total", "=SUM('Monthly Collection'!C7:N106)"],
      ["One-Time Collection Total", "=SUM('Monthly Collection'!O7:O106)"],
      ["Grand Total", "=B2+B3"],
      ["Monthly Contribution", 150],
      ["One-Time Contribution", 1000],
    ],
  },
];
await sheets.spreadsheets.values.batchUpdate({
  spreadsheetId,
  requestBody: { valueInputOption: "USER_ENTERED", data: updates },
});
console.log(
  "Setup complete: October 2026 to September 2027. Existing member/payment rows preserved.",
);
