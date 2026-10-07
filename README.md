# S.S Study Point — Digital Library

Admin panel for a study library: students, seats, timings, fees, payments, receipts, emails and reports.
It works on desktop, laptop, tablet and mobile.

| Part | Tech |
|---|---|
| `frontend/` | React 19, TypeScript, Vite, Tailwind CSS, React Router, React Hook Form, Zod |
| `backend/` | NestJS 12 (REST API), Mongoose, MongoDB, JWT in an httpOnly cookie |

Everything is free and open source. There are no paid services and no API keys to buy.

---

## 1. Requirements

- **Node.js 20.19+** (Node 22 LTS also works)
- **MongoDB**: either installed locally (the free Community Server) or a free **MongoDB Atlas M0** cluster

## 2. Run it locally

```bash
# Backend (API on http://localhost:4000)
cd backend
npm install
cp .env.example .env        # then edit .env (see below)
npm run start:dev

# Frontend (http://localhost:5173), in a second terminal
cd frontend
npm install
npm run dev
```

Open **http://localhost:5173** and sign in with `ADMIN_EMAIL` / `ADMIN_PASSWORD` from `backend/.env`.
That first admin account is created automatically on the first start.

## 3. Configuration (`backend/.env`)

| Variable | What it does |
|---|---|
| `MONGODB_URI` | MongoDB connection string |
| `JWT_SECRET` | **Required.** A long random string. Generate one with `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"` |
| `JWT_EXPIRES_IN` | How long a login lasts (default `8h`) |
| `ADMIN_NAME`, `ADMIN_EMAIL`, `ADMIN_PASSWORD` | First admin account |
| `TIMEZONE` | Library time zone for "today" and due dates (default `Asia/Kolkata`) |
| `COOKIE_SECURE` | Set to `true` when the site runs on HTTPS |

## 4. Features

- **Login**: email + password. Change password signs out other devices. Sessions use an httpOnly cookie, and
  login endpoints are rate-limited.
- **Roles & users** (`/users`, admins only): **Admin** has full access and can add users, change roles, disable
  accounts and set passwords. **User** can do day-to-day work but cannot change settings (library details, fee plans,
  timings, seats), delete students or payments, or manage users. There must always be at least one active admin.
- **Students** (`/students`): responsive table on desktop and cards on phones. Search, filter by status, timing
  and fee status. View, edit, deactivate or reactivate, and delete (delete is only allowed when the student has no payments).
- **Add student**: photo upload with preview, change and remove (JPG/PNG/WebP up to 2 MB, file contents checked).
  Age is calculated from DOB and can be overridden. Indian mobile validation. A seat can be shared only by active
  students whose timings don't overlap (e.g. Morning + Evening is fine, Morning + Full Day is not), and free seats
  for the chosen timing are suggested. Timings come from Settings.
- **Fee setup on admission**: Monthly, Half-Yearly or Yearly, with the default fee pre-filled. The next due date
  is calculated automatically (e.g. 01 Jan → 01 Jul for Half-Yearly). Optionally records the first fee as a receipt.
- **Student profile** (`/students/:id`): every detail, plus Record Payment, payment history, and Deactivate.
- **Fees** (`/fees`): status shown as Paid, Due, Overdue or Partially Paid. Filter chips with counts, one-click Pay.
- **Payments** (`/payments`): record a payment with automatic receipt numbers (`SSSP-00001`). Search, filter by
  date range, mode and fee plan, view details and print. The latest payment can
  be deleted if it was entered by mistake, which restores the previous due date.
- **Reports**: collection by month, payment mode and fee plan. CSV export of payments and students.
- **Settings**: library name and contact details, receipt prefix, how many days early a fee shows as "Due",
  default fee per plan, timings, seats, and your profile/password.

### How fees are calculated

- Each student has a **next due date**. Recording a payment of one full fee moves it forward by one plan period.
  Paying for several periods at once moves it forward several periods.
- A smaller amount is kept as credit, and the student shows as **Partially Paid** until the rest is paid.
- Paying extra is not allowed: once a payment covers at least one period, it must cover whole periods exactly.
- **Due** means the next due date is within the reminder window (5 days by default). **Overdue** means the date has passed.

## 5. Production / free hosting

```bash
cd frontend && npm run build          # creates frontend/dist
cd ../backend && npm run build
# in backend/.env:  FRONTEND_DIST=../frontend/dist   COOKIE_SECURE=true
npm start                              # serves the API and the React app on one port
```

Free options: **MongoDB Atlas M0** for the database, plus any free Node host or your own PC/VPS.
Student photos are stored in `backend/uploads/`, so keep that folder on persistent storage and back it up
together with the database.

## 6. Project structure

```
backend/src/
  auth/        login, password change, session guard
  students/    students API, photo storage
  payments/    payments, receipts
  fees/        fee list and status counts
  reports/     reports, CSV exports (+ dashboard)
  settings/    library settings, timings, seats, fee plans
  models/      User, Student, Payment, FeePlan, Seat, Timing, Setting, Counter
  common/      date & fee rules, validation, helpers

frontend/src/
  app/         pages: login, dashboard, students, fees, payments, reports, settings
  components/  layout, ui (buttons, inputs, dialog…), common, students, fees, payments, dashboard
  lib/         api client, auth context, hooks, zod validation, utils
  types/
```
