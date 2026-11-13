# Ganpati Monthly Collection

React + Node.js + Express + Google Sheets starter project.

## 1) Requirements
- Node.js 20+
- A Google Cloud service account with Google Sheets API enabled
- Your Google Sheet shared with the service-account email as **Editor**

Spreadsheet ID configured from your link:
`1BpJf0x9OWKRXWFrF9hPOlgdDh_AM496n`

## 2) Google service account
1. In Google Cloud Console, create/select a project.
2. Enable **Google Sheets API**.
3. Create a Service Account and download its JSON key.
4. Share the new Google Sheet with the service account email (Editor).
5. Save the downloaded key as `server/service-account.json`. Do not upload/share this file.

## 3) Run backend
```bash
cd server
copy .env.example .env
npm install
npm run setup
npm run dev
```
On macOS/Linux use `cp .env.example .env` instead of `copy`.

## 4) Run frontend
Open another terminal:
```bash
cd client
npm install
npm run dev
```
Open the local URL printed by Vite.

## Important
This is the initial working foundation: account registration/login, PIN change, payment request submission, admin review/confirmation, and collection totals. Cash must be physically received before an admin confirms a request. Admin PIN is configured in `.env`; change it before using the app. Never expose `.env` or the service-account key.
