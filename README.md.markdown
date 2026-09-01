# PLUS 233 AUTOMASTER — E-Commerce Platform

**"Home of Trusted Parts. Superior Performance."**

A production-style online automotive marketplace for PLUS 233 AUTOMASTER (28 Chemu Rd, Accra, Down-Right, Ghana). Customers can browse genuine auto parts, check vehicle compatibility, add to cart and order online for delivery across Ghana. Staff manage products, prices, stock, compatibility, orders, customers and settings through an admin dashboard.

---

## Quick Start

```bash
cd plus233
npm install          # once
node db/seed.js      # populate sample catalogue (60 products, 14 categories, 67 vehicle models)
npm start            # → http://localhost:3000
```

- **Storefront:** http://localhost:3000
- **Admin dashboard:** http://localhost:3000/admin — login `admin` / `admin123`

The server auto-seeds on first boot if the database is empty.

## Stack

| Layer      | Tech |
|------------|------|
| Backend    | Node.js + Express (REST API) |
| Database   | SQLite via better-sqlite3 (file: `data/automaster.sqlite`) |
| Frontend   | Multi-page storefront — vanilla JS, no build step |
| Admin      | SPA dashboard (vanilla JS, token auth) |

Everything is structured so the SQLite layer can be swapped for PostgreSQL/MongoDB by replacing `db/database.js`; the API and frontend never touch SQL directly.

## Pages

**Storefront:** Home · Shop (search/filter/sort/pagination) · Product detail · Categories · Find Parts for My Car (vehicle selector) · Cart · Checkout · Track Order · Account · About · Contact · Delivery Info · Returns · Terms · Privacy · 404

**Admin:** Dashboard (orders/revenue/stock alerts) · Products (CRUD + compatibility editor + stock quick-update) · Orders (status & payment management) · Customers · Categories · Messages · Vehicle catalogue · Settings

## Key Architecture Points

- **No hard-coded prices or stock** — everything is read from the database through `/api/products`. Prices are shown in GH₵.
- **Vehicle compatibility engine** — `product_compatibility` table maps each part to make/model/year-range/engines. The Find Parts flow (`POST /api/parts/find`) returns every compatible part; "Universal" marks parts that fit all vehicles (fluids, chemicals).
- **Checkout safety** — the server re-validates every line item against the live price and stock in the database, rejects overselling (`409`), decrements stock in a transaction and computes the delivery fee server-side from store settings (Accra GH₵40 / nationwide GH₵90 / free over GH₵1,500 — all editable in admin).
- **Orders** — order numbers like `PA-20260830-XXXXX`, trackable by customers via `/track-order.html?order=…`.
- **Admin auth** — prototype HMAC token auth (12 h expiry). Replace with a proper auth provider before production.
- **Images** — category/product photos live in `public/images/`; a fallback middleware serves branded SVG placeholders until real photos are added (paths stay stable, e.g. `/images/prod-ngk-spark.jpg`).

## Sample Data

- 14 categories (Spark Plugs → Sealants & Epoxy)
- 60 products across ~35 brands (NGK, Denso, Bosch, Mann-Filter, Toyota Genuine, MOOG, Mobil 1, Castrol, Liqui Moly…)
- 67 vehicle models across 15 makes popular in Ghana (Toyota, Hyundai, Kia, Honda, Nissan, Mercedes-Benz, BMW, VW, Ford, Suzuki, Mitsubishi, Chevrolet, Mazda, Peugeot, Lexus)

## Project Structure

```
plus233/
├── server.js            # Express app — all REST API routes
├── db/
│   ├── database.js      # SQLite schema (single DB access point)
│   └── seed.js          # sample catalogue + admin user
├── public/
│   ├── index.html       # + 16 more storefront pages
│   ├── css/main.css     # design system (dark/electric-blue theme)
│   ├── js/              # shared components + per-page logic
│   ├── admin/           # admin dashboard shell
│   └── images/          # logo, hero, category/product photos
└── data/                # SQLite file (created at runtime)
```

## Roadmap / Production Notes

- Real product photography (placeholders are in place)
- Customer accounts (sign-in / saved vehicles / order history)
- Online payment gateway (MoMo, cards) integration
- HTTPS, rate limiting, proper auth, backups
- Move to PostgreSQL / MongoDB when traffic grows
