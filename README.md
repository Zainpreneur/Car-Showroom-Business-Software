# 🚗 Car Showroom Business Software

A full-stack business management system for a car showroom / dealership —
inventory, customers, sales, employees, expenses, and a live dashboard.

## Stack

| Layer    | Technology |
|----------|------------|
| Frontend | React 18 + TypeScript + Vite + Tailwind CSS + Recharts |
| Backend  | Node.js + Express + TypeScript |
| Database | SQLite via Prisma ORM (swap to Postgres/MySQL by changing `DATABASE_URL` + the provider in `schema.prisma`) |
| Auth     | JWT (JSON Web Tokens) + bcrypt password hashing |

## Features

- **Auth & roles** — JWT login, first-run admin bootstrap, ADMIN / MANAGER / SALESPERSON roles with route-level permission checks.
- **Inventory management** — add/edit/delete vehicles, VIN, pricing, mileage, status (In Stock / Reserved / Sold), search & filter.
- **Customer directory** — CRUD with search, purchase history per customer.
- **Sales workflow** — record a sale against an in-stock vehicle and a customer; the vehicle automatically flips to Reserved/Sold; cancel/delete restores it to stock.
- **Employee management** (Admin only) — create staff accounts, assign roles, activate/deactivate, safe-delete (auto-deactivates staff with sales history instead of destroying records).
- **Expense tracking** — log operating costs by category.
- **Dashboard** — live KPIs (inventory value, monthly/YTD revenue & profit, expenses), a 6-month revenue/profit trend chart, sales volume chart, and a recent-sales feed.

## Project layout

```
backend/    Express + TypeScript API, Prisma schema & migrations
frontend/   React + TypeScript + Vite SPA
```

## Getting started

### 1. Backend

```bash
cd backend
cp .env.example .env
npm install
npx prisma migrate dev --name init   # creates the SQLite DB and applies schema
npx prisma db seed                   # optional: seed demo data
npm run dev                          # http://localhost:4000
```

Seeded demo logins (from `prisma/seed.ts`):
- **Admin:** `admin@showroom.com` / `Admin123!`
- **Salesperson:** `sales@showroom.com` / `Sales123!`

If you skip seeding, the first account you register through the UI becomes
the admin (registration auto-closes after that — new staff are then created
from the Employees page).

### 2. Frontend

```bash
cd frontend
npm install
npm run dev                          # http://localhost:5173
```

The Vite dev server proxies `/api/*` to `http://localhost:4000`, so just run
both servers side by side.

### 3. Production build

```bash
# backend
cd backend && npm run build && npm start

# frontend
cd frontend && npm run build         # outputs static assets to frontend/dist
```

Serve `frontend/dist` with any static host (Nginx, Vercel, Netlify, etc.) and
point it at your deployed API, or serve it from the Express app.

## Switching to Postgres/MySQL for production

1. In `backend/prisma/schema.prisma`, change the datasource provider from
   `sqlite` to `postgresql` (or `mysql`).
2. Set `DATABASE_URL` in `backend/.env` to your connection string.
3. Run `npx prisma migrate deploy`.

(The schema deliberately stores enum-like fields such as `Vehicle.status` and
`Sale.status` as validated strings rather than native `enum`s so it works
identically on SQLite and Postgres/MySQL without a migration rewrite.)

## API overview

All endpoints are under `/api` and (except `/api/auth/*` and `/api/health`)
require `Authorization: Bearer <token>`.

| Route | Description |
|---|---|
| `POST /api/auth/register` | Bootstrap the first admin account (closes after first user) |
| `POST /api/auth/login` | Log in, returns JWT + user |
| `GET /api/auth/me` | Current user profile |
| `GET/POST/PUT/DELETE /api/vehicles` | Inventory CRUD |
| `GET/POST/PUT/DELETE /api/customers` | Customer CRUD |
| `GET/POST/PUT/DELETE /api/sales` | Sales CRUD (vehicle status kept in sync) |
| `GET/POST/PUT/DELETE /api/employees` | Staff management (Admin only) |
| `GET/POST/PUT/DELETE /api/expenses` | Expense tracking |
| `GET /api/dashboard/summary` | KPI summary |
| `GET /api/dashboard/trend?months=6` | Revenue/profit/sales trend |
