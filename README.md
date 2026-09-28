# RevoTech — Frontend

A storefront for **RevoTech**, the computer-parts shop whose Flask API was built in Module 2. Current-generation
PC components priced in rupiah, with live search, a cart and checkout, an admin dashboard, and a build planner
that checks your parts actually fit together.

**Live:** [`https://revou-module-3-revo-tech.vercel.app/`](https://revou-module-3-revo-tech.vercel.app/) &nbsp;·&nbsp; **Backend (Module 2):** [jim1504/Revou-revoshop-jim1504](https://github.com/jim1504/Revou-revoshop-jim1504)

![Home page](docs/screenshots/home-desktop.avif)

---

## Contents

- [RevoTech — Frontend](#revotech--frontend)
  - [Contents](#contents)
  - [Overview](#overview)
  - [Features](#features)
  - [Tech stack](#tech-stack)
  - [How the data works](#how-the-data-works)
  - [Run it locally](#run-it-locally)
    - [Scripts](#scripts)
  - [Run the tests](#run-the-tests)
  - [Deploy to Vercel](#deploy-to-vercel)
  - [Checkpoint 1 — Fundamentals](#checkpoint-1--fundamentals)
  - [Checkpoint 2 — Components \& App Router](#checkpoint-2--components--app-router)
    - [React components](#react-components)
    - [App Router and data fetching](#app-router-and-data-fetching)
    - [Rendering strategies](#rendering-strategies)
  - [Checkpoint 3 — Forms, auth, testing \& deployment](#checkpoint-3--forms-auth-testing--deployment)
  - [Beyond the brief](#beyond-the-brief)
  - [Roles and permissions](#roles-and-permissions)
  - [Database access (DBeaver)](#database-access-dbeaver)
  - [Product images](#product-images)
  - [Store settings and logo](#store-settings-and-logo)
  - [New arrivals and the first-visit pop-up](#new-arrivals-and-the-first-visit-pop-up)
  - [Editing in place and handling orders](#editing-in-place-and-handling-orders)
  - [Official links, overviews, specifications and galleries](#official-links-overviews-specifications-and-galleries)
  - [Known limitations](#known-limitations)
  - [Project structure](#project-structure)

---

## Overview

RevoTech sells 20 current-generation parts across six categories — Intel Core Ultra Plus and Ryzen 9000 X3D
processors, LGA1851 and AM5 motherboards, DDR5 memory and PCIe 5.0 storage, RTX 50 and RDNA 4 graphics, power and
cooling, and peripherals.

- **Shoppers** browse, search by model number, filter by category, and plan a whole build.
- **Customers** (signed in) keep a cart that survives refreshes, check out, and track their orders.
- **Admins** manage products and categories and see revenue, stock and order status at a glance.

The design direction is *neon cyber-grid*: a deep navy base, cyan and magenta accents, a drifting grid, glowing
borders and monospace numerals.

## Features

| Area | What is there |
|---|---|
| Catalogue | Home with hero slider and featured parts · `/products` with live search, `?search=` and `?category_id=` URLs · product detail with an image gallery (hover to zoom 2.5× into the full-resolution photo), key features, stock meter, a link to the manufacturer's page, a credited overview, the full technical specification table and related parts · `/categories` |
| Cart & checkout | Add with quantity, cart table with per-row quantity and remove, totals, disabled checkout when empty, `POST /orders`, order history and detail |
| Accounts | Register (4 validation rules), login, session restored on refresh, role-based redirects, an account page for your own profile and password |
| Roles | Three: superadmin, admin, customer — checked in the UI *and* on every write endpoint (see [Roles and permissions](#roles-and-permissions)) |
| Admin | Product CRUD in modals (official link, overview, technical specs fetched from the official page or pasted from the browser, up to 12 images — any upload is converted to AVIF), category CRUD with a deletion guard, order handling (status pipeline, cancel/reopen with restock, shipping address), stats HUD · **edit in place**: an admin bar on the homepage, About page and every product page |
| Admin area | Full width with the dashboard tabs in a **vertical sidebar** (a scrolling row on phones), no storefront footer, and a **dark / light theme** switch for staff |
| Screens | From 390 px phones to **4K monitors**: above 1920 px the whole layout scales with the window, so it fills a 4K screen instead of sitting in a narrow strip |
| Extras | Card-to-detail **view transition**, **Ctrl/⌘ K command palette**, **build planner** with compatibility checks |
| Quality | 79 Playwright tests (run against both the in-memory store and PostgreSQL), toasts for every write, skeleton loaders and error boundaries on every data route |

## Tech stack

| | Version |
|---|---|
| Next.js (App Router, Turbopack) | 16.3.6 |
| React | 19.2.8 |
| TypeScript (strict) | 5 |
| Tailwind CSS (CSS-first `@theme`) | 4 |
| react-hot-toast | 2.6 |
| Playwright | 1.63 |
| sharp (image pipeline and upload conversion) | 0.35 |
| postgres (postgres.js — the PostgreSQL / Supabase client) | 3.4 |
| @vercel/blob (uploaded images in production) | 2.8 |

Node.js 20.9 or newer is required.

ESLint stays on version 9: the React rules inside `eslint-config-next` 16.3 don't run on ESLint 10 yet, so
`npm install` prints a deprecation notice for it. It doesn't affect the build, since Next 16 no longer runs ESLint
during `next build`. `package.json` also has an `allowScripts` entry, the list npm 12 uses to decide which
dependencies may run install scripts: `unrs-resolver` is denied, because its script only downloads a native binary
npm already installs.

## How the data works

The brief asked for the backend's sample data **without integrating the backend itself**. So the Flask API's
contract is replicated inside this app as Next.js Route Handlers under `app/api/*`:

```
Browser / Server Component ──fetch──▶ NEXT_PUBLIC_API_BASE_URL ──▶ app/api/* ──▶ lib/server/store.ts ──▶ lib/server/db
                                         (defaults to /api)          (route handlers)   (the business rules)   memory or PostgreSQL
```

**Where the data lives** (`lib/server/db/`) depends on one server-only variable, `DATABASE_URL`:

| `DATABASE_URL` | Data source | Used by |
|---|---|---|
| not set | In memory, seeded from `data/catalog.json`; resets when the server restarts | `npm run dev`, the Playwright suite |
| set | PostgreSQL — the tables in `db/schema.sql`, seeded from the same catalogue by `npm run db:setup` | Production on Vercel (Supabase); locally, any Postgres |

Both implement the same `DataSource` interface, so the validation, permissions, stock rules and error bodies in
`store.ts` are identical either way — the suite passes against both. The database is this app's own: it is created
from the seed data, not shared with the Module 2 deployment.

`NEXT_PUBLIC_API_BASE_URL` is always an **HTTP API** address, never a database URL. Anything prefixed
`NEXT_PUBLIC_` is compiled into the JavaScript the browser downloads, so a connection string there would publish the
database password. `DATABASE_URL` has no prefix and is only ever read on the server.

**Passwords are hashed** with PBKDF2-SHA256 in Werkzeug's format (`pbkdf2:sha256:600000$salt$hash`,
`lib/server/password.ts`) — the format Flask's `generate_password_hash` writes — so the `users` table stays readable
by the Module 2 API. The API never returns the hash.

Every endpoint returns the **same status codes and JSON shapes as the Flask routes** — `product_id`,
`stock_quantity`, `{ error, details[] }` on 400, `409` with `active_orders` when deleting a product that is still
in an open order, and so on. Because the frontend only ever talks to `NEXT_PUBLIC_API_BASE_URL`, switching to the real
backend is a one-line change:

```bash
NEXT_PUBLIC_API_BASE_URL=https://revou-revoshop-jim1504-seven.vercel.app
```

The mock adds a few things the Flask API does not have:

- `?search=` and `?category_id=` on `GET /products` (the brief requires them);
- `official_url`, `overview`, `overview_source`, `images`, `specs` and `specs_source` on products;
- `POST /uploads`, `GET /images/<file>`, `GET /official-preview?url=` and `GET|POST /official-specs` for the admin form
  (see [Official links, overviews, specifications and galleries](#official-links-overviews-specifications-and-galleries));
- `GET|PUT /settings` and `GET|POST|DELETE /settings/logo` for the store settings and the logo
  (see [Store settings and logo](#store-settings-and-logo));
- `GET|PUT /content/home` and `/content/about` for the editable page content
  (see [Editing in place and handling orders](#editing-in-place-and-handling-orders));
- `GET /users` (superadmin) and `PUT /users/<id>` for profiles, password changes and role changes
  (see [Roles and permissions](#roles-and-permissions)).

Every write endpoint checks the caller's role, which the browser sends as `x-user-id` — where the Flask API would
read the JWT it signed.

`PUT /orders/<id>` is **not** an addition: it copies the Flask route (status and/or shipping address, the same
messages and status codes). The one difference is stock — the mock takes stock off when an order is placed, so
cancelling puts it back and reopening takes it again; the Flask API doesn't track stock per order.

Deleting a product that only appears in **delivered or cancelled** orders doesn't remove it: those orders still
point at it (a foreign key in PostgreSQL), so it is withdrawn from sale instead — `is_active: false`, answered with
`200 { message, id, withdrawn: true }` — and past orders keep showing its name.

`docs/updated-seed.sql` adds the six product columns to the Module 2 database; the Flask `Product` model needs
the matching fields before the real API returns them. It also creates a `site_content` table (one JSON document per
page) with the default homepage and About content, for when the Flask API gets a content route.

`data/catalog.json` is the single source of truth. It holds the Module 2 seed data **refreshed to
current-generation parts** (e.g. i5-14400F → Core Ultra 5 250K Plus, RTX 4070 Super → MSI RTX 5070 Gaming Trio OC, Kingston DDR4 → Corsair Dominator Titanium DDR5-7600, 980 Pro → 9100 Pro).
[`docs/updated-seed.sql`](docs/updated-seed.sql) applies the same refresh to the Module 2 database.

## Run it locally

```bash
npm install
cp .env.example .env.local      # already filled in with working defaults
npm run dev                     # http://localhost:8100
```

`npm run dev` first copies the AVIF images from `assets/` into `public/` (`predev`).

**Demo accounts** — password `password123` for all three (the login page has one-click buttons):

| Role | Email | Gets |
|---|---|---|
| Superadmin | `andi.pratama@example.com` | Everything, including Users and Settings |
| Admin | `budi.santoso@example.com` | Products, categories, orders, page content |
| Customer | `siti.rahayu@example.com` | The shop, and their own account page |

**Seeing the loading and error states.** The API runs in-process, so it can't be "stopped" like the Flask one.
Two switches in `.env.local` simulate it — restart `npm run dev` after changing them:

```bash
MOCK_API_LATENCY_MS=1500   # every API response is delayed -> loading.tsx skeletons
MOCK_API_DOWN=1            # every API call answers 503   -> error.tsx boundaries
```

### Scripts

| Command | Does |
|---|---|
| `npm run dev` / `build` / `start` | Next.js |
| `npm run lint` / `typecheck` | ESLint (flat config) / `tsc --noEmit` |
| `npx playwright test` | End-to-end suite |
| `npm run db:setup` | Creates the tables in `DATABASE_URL` and seeds an empty database from the catalogue (`-- --reset` drops and recreates them) |
| `npm run catalog:check` | Validates `data/catalog.json` (ids, prices, order totals) |
| `npm run images:all` | Rebuilds every image: fetch, generate, banners, variants |
| `npm run brand:logo` | Rebuilds the default logo (`data/logo.json`) from `assets/brand/logo-source.jpg` with the same SVG converter as the settings page |
| `npm run images:gallery` | Builds the multi-image galleries from the folders listed in `scripts/gallery-sources.json` |
| `npm run catalog:specs` | Fills missing spec tables from each product's spec or official page (`-- --force` to refetch all) |
| `npm run catalog:overviews` | Fills missing overviews from each product's official page (`-- --force` to refetch all) |
| `npm run seed:export` | Regenerates `docs/updated-seed.sql` from the catalogue |
| `node scripts/screenshots.mjs --base=<url>` | Re-captures `docs/screenshots/` |

## Run the tests

```bash
npx playwright install chromium     # once
npx playwright test                 # starts `npm run dev` if nothing is on :8100
npx playwright show-report          # HTML report
```

Against the live deployment:

```bash
PLAYWRIGHT_BASE_URL=https://<your-project>.vercel.app npx playwright test
```

| Spec | Covers |
|---|---|
| `home.spec.ts` | Heading visible, click Products → URL is `/products` (first with role locators, then refactored to `getByTestId`), hero slider controls, autoplay and pause |
| `register.spec.ts` | Each of the four validation rules, and that an invalid form never sends a request |
| `auth.spec.ts` | Register → signed in → survives refresh → log out → log back in; bad password; admin lands on `/dashboard`; "Login to buy" returns to the product; route guards |
| `mock.spec.ts` | `page.route()` mocks `GET /products`: custom data, a 500, an empty result |
| `browse.spec.ts` | Search → detail → add 2 → cart survives refresh → checkout → order appears; category filter; empty cart; signing out empties and hides the cart |
| `build.spec.ts` | Socket clash flagged on the slots and marked in the dropdown before picking; a DDR5-7600 kit on the H810 board (falls back to 4800 MT/s) and on AM5 (Intel XMP only), none on B860; status bar on narrow screens |
| `settings.spec.ts` | Settings validation; the logo served as locked-down SVG in full and square variants; an uploaded PNG converted to SVG in its real colours; nothing from an uploaded SVG (scripts, handlers) reaches the output; non-images rejected; renaming the shop and switching to WITA / 12-hour updates title, header and order dates; a new logo moves the favicon |
| `promo.spec.ts` | The new-arrivals pop-up shows once on the first page a visitor opens, leads with the iCUE LINK TITAN II, and stays away after being clicked through or closed with Esc, and on sign-in |
| `dashboard.spec.ts` | Create → success toast + new row → edit price → delete with confirmation; validation; 409 delete guard; a product only in past orders is withdrawn from sale instead of deleted |
| `media.spec.ts` | Hover zoom follows the pointer and uses the full-resolution image; uploads a product drops are deleted (a shared one only when the last product lets go); official link and credited overview; the summary fetcher refuses private addresses; images hosted elsewhere are rejected; uploads come back as AVIF; upload → reorder → save → gallery on the product page (upload specs run locally only) |
| `rbac.spec.ts` | Every write endpoint answers 401 to a stranger and 403 to a customer, naming the permission; an admin may edit the catalogue but not settings or users; a customer edits only their own profile, cannot grant themselves a role, and needs their current password to change it; a superadmin resets a password without it, cannot change their own role, and cannot demote the last superadmin; each role's dashboard tabs; the account page end to end |
| `admin.spec.ts` | Customers see Orders and no admin bars, admins see Dashboard instead; edit a product from its page, the homepage (slide, heading, featured pick, validation) and the About page, each surviving a fresh load; content validated by the API; `PUT /orders` contract; mark paid → cancel (restocks) → reopen → change address |
| `specs.spec.ts` | Grouped spec table with its source and "Show all" (NVIDIA's RTX 5060 column, not the Ti's); pasted HTML → rows; the spec fetcher refuses private addresses; invalid rows are rejected; paste → edit → save → product page; "Label: value" text |
| `layout.spec.ts` | The root font size at 1440, 1920, 2560 and 3840 px and the page column growing with it; the dashboard full width with stacked sidebar tabs and no footer (the storefront keeps it); tabs in a row on a phone with no sideways scroll; the light theme switching, surviving a reload from the first paint, staying off the storefront, and never applying to a customer |
| `global-setup.ts` | Registers a test user through `POST /users` (no UI), stores `{ id, username, email }` in localStorage, saves the session to `tests/.auth/` |

The suite passes against `next dev`, and was also run green against a production build (`next build && next start`)
and against PostgreSQL:

```bash
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/revotech npm run db:setup -- --reset
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/revotech npm run dev
npx playwright test                 # in a second terminal
```

## Deploy to Vercel

The production setup is **Vercel** (the app) + **Supabase** (PostgreSQL) + **Vercel Blob** (uploaded images). Without
the last two it still deploys and runs, but on the in-memory catalogue, which resets on every cold start.

**1. Database — Supabase**

1. [supabase.com](https://supabase.com) → **New project**. Note the database password; pick the region nearest your
   Vercel functions (Singapore for Indonesia).
2. **Connect** (top of the project page) shows the connection strings. Two are needed:
   - **Session pooler**, port `5432` — for `db:setup` from your machine;
   - **Transaction pooler**, port `6543` — for Vercel, where every function opens its own short-lived connection.
3. Create and seed the tables once, from your machine:

   ```bash
   DATABASE_URL="postgresql://postgres.<ref>:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres" npm run db:setup
   ```

   It prints the row counts: 6 categories, 23 products, 6 users, 6 orders, 15 order items, the page content and
   settings. Run it again any time — it never overwrites data; `-- --reset` starts over (destructive).

**2. Images — Vercel Blob**

In the Vercel project: **Storage → Create → Blob → Connect to project**. That adds `BLOB_READ_WRITE_TOKEN` to the
project's environment variables; nothing else to configure. Uploads then go to the Blob CDN — only the three
converted AVIFs, never the original — and unused ones are deleted (see
[Official links, overviews, specifications and galleries](#official-links-overviews-specifications-and-galleries)).

**3. The app — Vercel**

1. Push the repository to GitHub.
2. **Add New → Project →** import the repository. The framework is detected automatically; the root directory is
   `./`.
3. **Settings → Environment Variables** (Production, and Preview if you want previews on the same data):

   | Variable | Value |
   |---|---|
   | `DATABASE_URL` | the Supabase **transaction pooler** URL (port `6543`) |
   | `BLOB_READ_WRITE_TOKEN` | added by step 2 |
   | `API_SECRET_KEY` | any long random string |

   `NEXT_PUBLIC_API_BASE_URL` is not needed — it defaults to `/api` in code (`lib/api.ts`), which the browser uses
   directly and the server resolves against the production domain.
4. **Deploy** (or **Redeploy** after changing variables — they are read at build time too, since the catalogue pages
   are prerendered from the database).
5. Run the test suite against the live URL (above). It writes test users, products and orders into the database;
   `npm run db:setup -- --reset` against the session pooler URL clears them.
6. **Analytics → Enable** in the Vercel project. The `<Analytics />` component in `app/layout.tsx` (Vercel Web
   Analytics) then reports page views, including client-side navigations, to the project's Analytics tab. It sends
   nothing in development or outside Vercel, and it uses no cookies.

**Environment files** — two, and only one of them is committed:

| File | Committed | Holds |
|---|---|---|
| `.env.example` | yes | Every variable the project understands, documented, with placeholder values. Copy it to `.env.local`. It also carries the Module 2 backend block (PostgreSQL, SQLAlchemy, Flask, Gunicorn) — not read by this app, but the same values go in DBeaver and in the Flask project's own `.env`. |
| `.env.local` | no | Your real values. Two lines are enough locally: `NEXT_PUBLIC_API_BASE_URL=/api` and `API_SECRET_KEY=…`. Add `DATABASE_URL` to develop against a database, `BLOB_READ_WRITE_TOKEN` to upload to Blob. |

Everything else has a default in code: the API base (`/api`), the port (8100, passed by the npm scripts) and the
Playwright base URL (`http://localhost:8100`, override with `PLAYWRIGHT_BASE_URL`).

---

## Checkpoint 1 — Fundamentals

Checkpoint 1 lives on the **About me** page, [`/about`](app/about/page.tsx), plus a plain, framework-free version of
the same profile at [`/checkpoint-1/index.html`](public/checkpoint-1/index.html) — same brand, no build step: the
JW logo there is a static `logo.svg`, written by the same converter as the app's (`npm run brand:logo`).

| Rubric item | Where |
|---|---|
| Semantic HTML5 profile page | `public/checkpoint-1/index.html` — `header`, `nav`, `main`, `section`, `article`, `aside`, `footer` |
| Contact form with input types and labels | Same file (`email`, `tel`, `select`, `textarea`, `<label for>`), and `components/about/ContactForm.tsx` |
| CSS selectors and the box model | `public/checkpoint-1/styles.css` — `box-sizing`, explicit margin / border / padding on `.section` |
| CSS Grid layout | `.skill-grid`, `.project-list`, `.contact-form` in `styles.css`; skills grid on `/about` |
| Responsive breakpoints | `@media (max-width: 900px)` and `(max-width: 640px)` in `styles.css`; mobile-first Tailwind on `/about` |
| Variables, types, operators, functions | `components/about/DomLab.tsx` |
| Select / update DOM, toggle classes, create / remove elements | `DomLab.tsx` — `querySelector`, `createElement`, `classList.toggle`, `remove()`, `replaceChildren()` |
| `click` / `submit` handlers, `preventDefault` | `DomLab.tsx` (`addEventListener`), `ContactForm.tsx` |
| `forEach`, `map`, `filter`, `reduce` | `components/about/ArrayLab.tsx` — each shown next to its live result over the real catalogue |
| TypeScript interfaces, type aliases, union types | `lib/types.ts` — `Product`, `OrderStatus`, `Availability`; `lib/roles.ts` — `Role`, `Permission` |
| Nested objects and arrays typed | `OrderDetail` with `OrderItem[]`, `CategoryDetail` with `Product[]` |
| Tailwind installed, utility-first | `app/globals.css` (Tailwind v4 `@theme`), used throughout |
| Typed data mapped to Tailwind classes | `getButtonClasses(inStock: boolean)` in `lib/classes.ts`; availability → badge tone in `components/ui/Badge.tsx` |
| Typed interactive catalogue: renders, live search, state update | `/products` — `ProductList.tsx` filters as you type, add to cart updates the header count |

| Desktop | Mobile |
|---|---|
| ![About](docs/screenshots/about-desktop.avif) | ![About mobile](docs/screenshots/about-mobile.avif) |
| ![Plain HTML/CSS](docs/screenshots/checkpoint-1-static-desktop.avif) | ![Plain HTML/CSS mobile](docs/screenshots/checkpoint-1-static-mobile.avif) |

---

## Checkpoint 2 — Components & App Router

### React components

| Rubric item | Where |
|---|---|
| `Header`, `Footer`, `ProductCard` as typed function components | `components/layout/Header.tsx`, `Footer.tsx`, `components/product/ProductCard.tsx` |
| `ProductCardProps` with optional props and destructuring defaults | `ProductCard.tsx` — `showDescription = true`, `showStock = true`, `readOnly = false` … |
| `Card` wrapper | `components/ui/Card.tsx` |
| Quantity counter on `ProductCard` | `components/ui/QuantityCounter.tsx`, used in the card |
| Conditional rendering | `ProductCard.tsx` — unavailable overlay, low-stock warning, "In cart ×n", "Login to buy" vs "Add to cart" |
| `getButtonClasses(inStock: boolean): string` | `lib/classes.ts` |
| One `.map()` over `Product[]`, no hardcoded cards | `components/product/ProductGrid.tsx` |
| `SearchBar` with `onChange` | `components/product/SearchBar.tsx` (controlled; also `onSubmit` on Enter) |
| Immutable add-to-cart | `context/CartContext.tsx` — spread and `.map()`, never mutation |
| `AddProductForm`, controlled inputs, `validate(data: FormState): FormErrors` | `components/dashboard/AddProductForm.tsx` |
| New products appended with the spread pattern | `ProductManager.tsx` — `setProducts(prev => [...prev, p])` |
| Cart summary with count and total | `components/product/CartSummary.tsx` on `/products`, and the header pill |

### App Router and data fetching

| Rubric item | Where |
|---|---|
| Routes as `page.tsx` under `app/` | `/`, `/products`, `/products/[id]`, `/categories`, `/orders`, `/orders/[id]`, `/about`, `/build`, `/cart`, `/checkout`, `/login`, `/register`, `/dashboard/*` |
| Root layout with `<Header />` / `<Footer />`, nested `app/products/layout.tsx` | `app/layout.tsx`, `app/products/layout.tsx` |
| Nested layout stays mounted | The **catalogue session timer** under the header keeps counting between `/products` and `/products/[id]`; the console logs `[products/layout] mounted` once |
| Active route styling with `usePathname()` | `Header.tsx` |
| `router.push('/products?search=…')` on Enter, `useSearchParams()` on the page | `Header.tsx` (`HeaderSearch`), `ProductList.tsx` |
| `NEXT_PUBLIC_API_BASE_URL` and `API_SECRET_KEY` | `.env.local`; the secret is sent server-side only as `x-api-key` (`lib/api.server.ts`) |
| `metadata` exports | Root layout and every page |
| `generateMetadata({ params })` with the real product name | `app/products/[id]/page.tsx` |
| `GET /products` in a Server Component with async/await and native `fetch` | `app/page.tsx`, `app/products/page.tsx` via `lib/api.server.ts` |
| `res.ok` check throwing a typed error | `lib/api.server.ts` → `ApiError` in `lib/api.ts` |
| `error.tsx` and `loading.tsx` | `app/products/`, `app/products/[id]/`, `app/categories/`, `app/orders/`, `app/dashboard/`, `app/build/`, root |
| Home: pure Server Component, first 5 products, read-only cards | `app/page.tsx` |
| `ProductList` client component: search, `useEffect` on `useSearchParams()`, `CategoryFilter` | `components/product/ProductList.tsx`, `CategoryFilter.tsx` |
| Server fetch for categories and orders | `app/categories/page.tsx`, `app/orders/page.tsx` |

### Rendering strategies

| Strategy | Routes |
|---|---|
| Static (SSG) | `/about` — rebuilt once on demand when an admin saves its content |
| SSG + ISR | `/products/[id]` — all products prerendered with `generateStaticParams`, revalidated every 5 min |
| ISR | `/` (5 min, and on demand when an admin saves), `/categories` (10 min) |
| Dynamic | `/products`, `/orders`, `/build`, `/dashboard/*` |

| | |
|---|---|
| ![Products](docs/screenshots/products-desktop.avif) | ![Product detail](docs/screenshots/product-detail-desktop.avif) |
| ![Search](docs/screenshots/products-search-desktop.avif) | ![Category filter](docs/screenshots/products-category-desktop.avif) |
| ![Loading state](docs/screenshots/state-loading-desktop.avif) | ![Error state](docs/screenshots/state-error-desktop.avif) |
| ![Categories](docs/screenshots/categories-desktop.avif) | ![Orders](docs/screenshots/orders-desktop.avif) |
| ![Home on a phone](docs/screenshots/home-mobile.avif) | ![Products on a phone](docs/screenshots/products-mobile.avif) |
| ![Product detail on a phone](docs/screenshots/product-detail-mobile.avif) | ![Account page on a phone](docs/screenshots/account-mobile.avif) |

---

## Checkpoint 3 — Forms, auth, testing & deployment

| Rubric item | Where |
|---|---|
| `CreateProductForm` → `POST /products` with `fetch`, `method: "POST"`, `Content-Type: application/json` | `components/dashboard/ProductForms.tsx`, `lib/api.client.ts` |
| 201 closes the modal and calls `router.refresh()`; 400 shows the Flask `{ error }` as a form error | `ProductManager.tsx`, `ProductForms.tsx` |
| `EditProductForm` pre-populated from `GET /products/[id]`, `PUT`, `.map()` update, 404 form error | `ProductForms.tsx` |
| Delete with inline "Are you sure?", `.filter()` on 200, backend message on conflict | `ProductManager.tsx` |
| `app/cart/page.tsx` in `ProtectedRoute`: table, remove, total, empty state, disabled checkout | `app/cart/page.tsx`, `components/cart/CartView.tsx` |
| `app/checkout/page.tsx` in `ProtectedRoute`, `POST /orders` on confirm | `components/cart/CheckoutView.tsx` |
| `CreateCategoryForm`, validated non-empty | `components/dashboard/CategoryManager.tsx` |
| `RegisterForm` + `RegisterFormData`, 4 rules, stores `{ id, username, email }`, `router.push('/')` | `components/auth/RegisterForm.tsx` |
| `AuthContext`: `User`, `currentUser`, `isLoggedIn`, `login()`, `logout()`, `useAuth()`; restores on mount | `context/AuthContext.tsx` |
| `<AuthProvider>` in the root layout; header shows username or "Register" | `components/layout/Providers.tsx`, `Header.tsx` |
| `LoginForm` → `POST /auth/login`, admin to `/dashboard`, "Invalid email or password" | `components/auth/LoginForm.tsx` |
| `ProtectedRoute`, `AdminRoute`, `PublicOnlyRoute` (plus `RequirePermission`) with `router.replace()` in `useEffect` | `components/auth/Guards.tsx` |
| `CartContext` persisted to localStorage, `<CartProvider>`, "Login to buy" when signed out | `context/CartContext.tsx`, `AddToCartButton.tsx` |
| `app/dashboard/categories/page.tsx` behind the dashboard's `AdminRoute` + `RequirePermission` | yes |
| `react-hot-toast`, `<Toaster />`, `lib/toast.ts`, success on 2xx / error on 4xx–5xx | `lib/toast.ts`, `Providers.tsx` |
| Playwright suite, `global-setup.ts`, `page.route()` | see [Run the tests](#run-the-tests) |
| `.env.example` / `.env.local` | see [Deploy to Vercel](#deploy-to-vercel) |

**Route guards, as implemented:** `PublicOnlyRoute` wraps `/login` and `/register` and sends signed-in users on.
`/`, `/products` and `/categories` are public to everyone, so they need no wrapper. `AdminRoute` now means "any
staff role" and wraps the whole dashboard; each dashboard page adds the one permission it needs with
`RequirePermission` — see [Roles and permissions](#roles-and-permissions).

| | |
|---|---|
| ![Register](docs/screenshots/register-desktop.avif) | ![Login](docs/screenshots/login-desktop.avif) |
| ![Cart](docs/screenshots/cart-desktop.avif) | ![Checkout](docs/screenshots/checkout-desktop.avif) |
| ![Dashboard](docs/screenshots/dashboard-desktop.avif) | ![Dashboard categories](docs/screenshots/dashboard-categories-desktop.avif) |
| ![Dashboard orders](docs/screenshots/dashboard-orders-desktop.avif) | ![Users and roles](docs/screenshots/dashboard-users-desktop.avif) |
| ![Account](docs/screenshots/account-desktop.avif) | ![Cart mobile](docs/screenshots/cart-mobile.avif) |

---

## Beyond the brief

- **View transitions.** A product card's image morphs into the detail page's hero (React `<ViewTransition>` with a
  shared name). The detail pages are statically generated, so they are fully prefetched — which is what lets the
  morph pair up. Respects `prefers-reduced-motion`.
- **Command palette.** Press Ctrl/⌘ K anywhere (the search box hints at it): fuzzy-jump to any product, category or page. Built on a native
  `<dialog>`, so focus trapping, Esc and focus restoration come from the browser.
- **Large screens.** Spacing, type and the page column are all in `rem`, and above a 1920 px-wide window the root
  font size grows with it (`app/globals.css`): 16 px up to 1920, 18.7 px at 2560 (a 4K monitor at Windows' default
  150 % scaling), 24 px at 3840 (4K at 100 %). So a 4K screen shows the same balanced layout, just larger, rather than
  a 1280 px strip in the middle. It never goes below the reader's own browser font setting, and the hero banner
  requests its 2560 px version when it is shown that wide.
- **The admin area.** `/dashboard` drops the storefront footer and uses the full width, with the dashboard tabs as a
  vertical sidebar beside the page (from 1024 px; on a phone they scroll sideways above it, so the tables keep the
  whole width).
- **Dark / light theme for staff.** A switch under the dashboard tabs. The light theme swaps the colour variables
  (`:root[data-theme="light"]` in `app/globals.css`), so every panel, table, dialog and toast follows. It applies to
  the dashboard only — the storefront's product photos and banners are composed on the dark panel colour, so the
  shop stays dark for everyone — and only for admins and superadmins. The choice is remembered in the browser
  (`lib/theme.ts`), and a small inline script applies it before the first paint, so a light dashboard never flashes
  dark on reload.
- **Admin HUD.** Revenue excluding cancelled orders, orders by status (SVG donut), low-stock alerts and catalogue
  value — no chart library.
- **Editing in place.** Admins get an *Edit* bar on the homepage, the About page and every product page — see
  [below](#editing-in-place-and-handling-orders).
- **Build planner** (`/build`). One part per slot, a running total, and checks that are genuinely true of this
  catalogue: an LGA1851 CPU won't fit an AM5 board, the Dominator's DDR5-7600 only runs at 4800 MT/s on the H810
  board (no memory overclocking) and is an Intel-XMP kit on the AM5 board, K-series and X3D chips ship without a
  cooler, and a 650 W supply is tight for an RTX 5070 build. (A DDR4-on-DDR5 check is in the rules too, for any DDR4
  kit an admin adds.) Problems show on the
  affected slot itself, clashing options are marked in the dropdowns before you pick them, and on narrower screens
  a status bar keeps the total and verdict pinned to the bottom.

| | |
|---|---|
| ![Build planner](docs/screenshots/build-desktop.avif) | ![Command palette](docs/screenshots/command-palette-desktop.avif) |
| ![Dashboard, light theme](docs/screenshots/dashboard-light-desktop.avif) | ![Dashboard on a phone](docs/screenshots/dashboard-mobile.avif) |

![Home page at 2560 px — a 4K monitor at 150 % scaling](docs/screenshots/home-wide.avif)

## Roles and permissions

Three roles, from `lib/roles.ts`. Nothing in the app compares role strings — it asks `can(role, permission)`, so
moving a permission between roles is a one-line change in that file.

| | Superadmin | Admin | Customer |
|---|:---:|:---:|:---:|
| Shop, cart, checkout, own orders | ✓ | ✓ | ✓ |
| Own profile, address and password (`/account`) | ✓ | ✓ | ✓ |
| Products & stock, categories, orders (`products:write`, `categories:write`, `orders:manage`) | ✓ | ✓ | |
| Homepage and About content (`content:write`) | ✓ | ✓ | |
| Shop name, logo, time zone (`settings:write`) | ✓ | | |
| Users, roles, password resets (`users:manage`) | ✓ | | |

The seeded accounts are one of each: Andi (superadmin), Budi (admin), and four customers.

**Checked twice.** The UI hides what you may not do — the dashboard shows only the tabs your role can open, and
the in-place *Edit* bars appear only with `content:write` / `products:write`. Then every write endpoint checks
again server-side (`lib/server/auth.ts`), because a hidden button is a courtesy, not a lock:

```
PUT /api/products/15          no one signed in   → 401 { error: "authentication required" }
                              a customer         → 403 { error, permission: "products:write", role: "customer" }
                              an admin           → 200
PUT /api/settings             an admin           → 403 { permission: "settings:write" }
```

The browser identifies itself with `x-user-id` (`lib/api.client.ts`), and the API looks the role up from it. The
Flask API takes the same id out of the JWT it signed, so only that one line differs — the permission table is the
same on both. **This header is demo-grade**: it can be typed by hand, a signed token cannot. See
[Known limitations](#known-limitations).

**Users & roles** (superadmin, *Dashboard → Users*) lists every account, changes a role, and sets a new password
for someone who is locked out. Two rules are enforced in the API and shown in the UI: nobody changes their own
role, and the last superadmin cannot be demoted.

**Your account** (`/account`, anyone signed in) edits name, email, phone and shipping address, and changes the
password — which needs the current one, even for a superadmin. Registration always creates a customer; roles are
only granted from the Users page.

Two endpoints do not exist in the Module 2 API yet: `GET /users` and `PUT /users/<id>`. The roles themselves need
no migration — they are the existing `users.role` column, and `docs/updated-seed.sql` sets the staff ones.

## Database access (DBeaver)

Point DBeaver at the same database as `DATABASE_URL`:

1. **Database → New Database Connection → PostgreSQL**.
2. Fill in the parts of the URL:

   | | Supabase | Local |
   |---|---|---|
   | Host | the session pooler host, e.g. `aws-0-ap-southeast-1.pooler.supabase.com` | `localhost` |
   | Port | `5432` | `5432` |
   | Database | `postgres` | `revotech` |
   | Username | `postgres.<project-ref>` | `postgres` |
   | Password | the project's database password | yours |

   For Supabase also open the **SSL** tab and tick **Use SSL** (mode `require`).
3. **Test Connection** (DBeaver downloads the driver the first time) → **Finish**.
4. The tables are under `Schemas → public → Tables`: `categories`, `products`, `users`, `orders`, `order_items`,
   `site_content` and `site_settings`. Passwords are stored hashed (`users.password_hash`); the product gallery and
   spec table are `JSONB` columns (`products.images`, `products.specs`).

**The Module 2 backend.** The Flask API has its own database. The backend block in `.env.example` holds its
settings (copy it into the Flask project's `.env`); in DBeaver use its `POSTGRES_*` values the same way.
A managed database (Render, Supabase, Neon) needs SSL: `?sslmode=require` on the URL, or **SSL → Use SSL** in
DBeaver. SQLAlchemy reads the whole connection as one URL — `postgresql+psycopg://user:password@host:5432/db` —
where the part after `+` is the driver (`psycopg` = psycopg 3, `psycopg2` = the older one). In production the API
runs under Gunicorn: `gunicorn --bind $GUNICORN_BIND --workers $GUNICORN_WORKERS "app:create_app()"`.

## Product images

Every image is AVIF, produced by the scripts in `scripts/` with sharp:

- **20 of 23 products** use the manufacturer's own product photo, pulled from their product page at the highest
  resolution its CDN serves (graphics cards use board-partner photos, since there is no reference card).
- **5 products come with a full gallery** — the Corsair iCUE LINK TITAN II 360 RX LCD (10 images), Corsair Dominator
  Titanium RGB (10), MSI RTX 5070 Gaming Trio OC (5), SanDisk Optimus GX PRO 850X (10) and WD_BLACK SN850X (4). Their official images were saved into folders under `assets/products/`
  and `npm run images:gallery` turns each folder into tiles, in the order `scripts/gallery-sources.json` gives
  (first = primary): cut-outs are trimmed and centred like the other photos, feature photos and infographics are
  fitted whole so their text is never cropped.
- **3 are generated renders** — Seagate blocks automated downloads (refused connection), Thermal Grizzly's page
  only offered an application photo, and the second Intel SKU would have duplicated the first. Detail pages label these as illustrations.
- The **hero banners** are composed from the product photos, with the headline added as real HTML. The first,
  *New arrivals*, features the TITAN II and the Dominator Titanium.
- Each image has 400 / 800 / 1600 px variants and a blur placeholder, served through a custom `next/image` loader —
  so there is no runtime re-encoding and no Vercel image-optimisation cost.

Product images © their respective manufacturers; used here for a non-commercial course project.

## Store settings and logo

**Dashboard → Settings** holds what used to be hard-coded:

| Setting | Used for |
|---|---|
| Shop name, tagline | Header and footer wordmark (the last word, or the part after the last capital, in cyan), browser-tab titles, the pop-up |
| Logo | Header and footer, and the browser-tab icon (a square variant) |
| Time zone (WIB, WITA, WIT, Singapore, UTC), 12/24-hour clock, date style | Every order date and time, with the zone shown (`18 Sep 2026, 15:55 WIB`); a live "now in the store" preview |
| Support email and phone | The footer, as `mailto:` / `tel:` links |

The root layout reads the settings once per render through a cached fetch tagged `settings`, so pages stay static;
saving expires the tag and every page picks the change up.

**Logo → SVG.** Upload any image — PNG, JPG, WebP, AVIF, GIF or SVG — and `lib/server/logo.ts` converts it to
vector paths:

1. the background is taken from the colours along the image's border, so a plain background — or a checkerboard
   "transparency" pattern saved into the pixels, like the JW logo's — drops out, as do transparent pixels;
2. what differs clearly from it becomes the shapes (the cut-off adapts to the image's contrast, so soft glow and
   JPEG noise are left out);
3. colours: a glowing logo (neon tubes with white-hot centres) takes each stroke's colour from the glow around it,
   brightened; a flat logo keeps its exact colours, and anti-aliased edges snap to the colour they fade from;
4. each colour layer is traced with imagetracerjs and cropped to the artwork.

The settings page shows the result on dark and light backgrounds, with its colours, before *Use this logo*
applies it. The SVG is written from path data only — nothing from the uploaded file is copied into it — and is
served with `Content-Security-Policy: default-src 'none'`. The default logo is the JW mark, built the same way by
`npm run brand:logo`.

| | |
|---|---|
| ![Store settings](docs/screenshots/dashboard-settings-desktop.avif) | ![Users and roles](docs/screenshots/dashboard-users-desktop.avif) |

## New arrivals and the first-visit pop-up

The homepage leads with the store's picks: the first hero slide is *New arrivals* (TITAN II and Dominator
Titanium banner, linking to the featured row), and the featured row — *Fresh drops for the next build* — shows the
TITAN II, Dominator Titanium, MSI RTX 5070 Gaming Trio OC, SanDisk Optimus GX PRO 850X and WD_BLACK SN850X. Both
are ordinary homepage content, so an admin can change them with *Edit homepage*.

**First-visit pop-up.** The first page a visitor opens shows a *New arrivals* dialog after a moment, promoting the
Corsair iCUE LINK TITAN II (photo, pitch, price, *See the TITAN II*) with the other four new parts underneath. It
appears once per browser — it is marked as seen when it opens, so closing it, clicking through or leaving all
count — and never on the admin, sign-in, cart or checkout pages. Returning visitors don't download anything for it.
The campaign lives in `lib/promo.ts`: change its `id` to show a new campaign to everyone once.

## Editing in place and handling orders

**Signed in as an admin**, the storefront pages you can change show a slim *Admin* bar with an Edit button. It opens
the editor in a dialog; saving updates the page straight away — no trip to the dashboard, no waiting for the cache.

| Page | What you can edit |
|---|---|
| Any product page | Everything in the product form — name, price, stock, key features, official link, overview, specifications, images |
| Homepage | Each hero slide's eyebrow, headline, text, button and link; show/hide and reorder slides; the three "why RevoTech" cards; the featured heading and which products are featured (up to 5, in order — none picked means the first five) |
| About | Name, tagline, introduction, skills and projects (add, edit, reorder, remove). The Checkpoint 1 labs are code and stay as they are |

The content is stored by the mock API (`/api/content/home`, `/api/content/about`, seeded from `lib/content.ts`) and
validated by the same rules in the form and on the server. The homepage stays ISR and About stays static: the
pages' fetches are tagged, and each save expires the tag (`revalidateTag(tag, { expire: 0 })`), so the next request
renders fresh instead of serving the old page while it rebuilds. Product, category and order writes do the same
for the `catalog` tag, which is why a price change or a cancelled order's restock shows on the product page at once.

**Orders.** Admins don't have the customer *Orders* link (their own purchases are still at `/orders`, with a pointer
to the dashboard). **Dashboard → Orders** is where orders are handled:

- each row has a one-click next step — *Mark paid*, *Mark shipped*, *Mark delivered*;
- *Manage* opens the order: its lines and total, the status pipeline (any step can be picked, as in Flask),
  *Cancel order* (with a confirmation — its items go back into stock) or *Reopen as pending* (refused if the
  stock has run out meanwhile), and the shipping address;
- the status filters show a count for each status.

## Official links, overviews, specifications and galleries

In **Dashboard → Edit product**, the *Official page & overview* section has:

- **Official product page** — a full `https://` link. Buyers see a *View on official site* button (opens in a new
  tab, `rel="noopener noreferrer"`) with the site's name next to it.
- **Fetch summary** — reads the page's own summary (its `og:description` / meta description) and puts it in the
  overview box for you to check and edit. It is the manufacturer's short description, not a copy of their full
  page. Sales taglines and boilerplate ("Shop now", "5% off your first order") are stripped; if nothing useful is
  left, the form says so and you write it by hand. Intel and a few others fall in that group.
- **Overview credit** — an imported summary is shown on the product page with "Summary from asus.com". Once you have
  rewritten it in your own words, *Remove credit* drops the attribution.

**Technical specifications.** The *Technical specifications* section of the same form fills the full spec table
shown on the product page (the comma-separated *Key features* stay as the short list on cards). Three ways in:

- **Fetch specs** reads the spec page — or the official page when *Spec page* is left blank — and extracts its
  table: label/value tables (Intel, Corsair, MSI's `/Specification` page), term lists (AMD), "Label: value" lists
  (Arctic), LG's spec grid, and comparison tables with a column per model (NVIDIA — the column whose header matches
  the product name is used, so the RTX 5060 doesn't get the 5060 Ti's figures). Section headings become groups;
  link texts, prices and promo headings are dropped.
- **Paste** — for sites that build the table in the browser with JavaScript (ASUS, Gigabyte, Samsung, Logitech,
  Keychron), which a server can't read: open the spec page, select the table, copy, and paste into the box. The
  HTML on the clipboard goes through the same extractor; plain "Label: value" or tab-separated text works too.
- **By hand** — every row is editable; rename or remove a whole group, add rows, clear all.

Buyers see the table grouped in two columns, collapsed to the first 14 rows with *Show all N specifications*, and
credited with a link to the page it came from. 17 of the 23 seeded products have specs imported from their
manufacturer's page (`npm run catalog:specs`); the other 6 are the five JavaScript-built pages above plus Seagate,
which redirects in a loop — paste those in from the browser. MSI's graphics-card spec page builds its table from
div rows rather than a table, so the Gaming Trio's rows were read from them directly.
The SanDisk and WD pages hold one spec block per model variant, so their rows were taken from the block for the
exact SKU sold here (the 1TB heatsink versions) — the page's default block describes the version without one.

Specifications are factual data, so unlike the overview they are imported in full.

**Images.** Each product can have up to 12. Click or drop files onto the tile grid (several at a time), then use
‹ › to reorder, ★ to make one the primary image (the one the catalogue card shows) and ✕ to remove it. Nothing is
saved until *Save changes*.

Whatever you upload — JPG, PNG, WebP, GIF, TIFF or AVIF — the server (`lib/server/uploads.ts`, sharp):

1. checks the file's real format from its contents, not its name, and rejects anything else;
2. applies the EXIF rotation, and replaces a white studio background with the site's panel colour;
3. fits it on a 1600 × 1600 square and saves AVIF at 1600, 800 and 400 px, like the seeded photos.

The status line under the grid shows the result, e.g. `27 KB JPG → 19 KB AVIF`. Files over 4 MB are scaled down
in the browser first, because Vercel refuses request bodies over 4.5 MB.

**Where uploads are stored.** With `BLOB_READ_WRITE_TOKEN` set (production), the three AVIFs go to Vercel Blob as
`uploads/<id>.avif`, `@800` and `@400`, served from its CDN with a one-year cache (the names are random and never
reused, so a URL's bytes never change). Without it (development) they go to `.data/uploads/` (git-ignored), served
by `/api/images/<id>.avif`. The product stores only the master's URL; `lib/image-loader.ts` picks the size.

**Storage clean-up.** Only the three AVIFs are kept — the uploaded original is converted in memory and never
written anywhere: not to disk, not to `/tmp`, not to Blob. Uploads nothing uses are deleted too
(`lib/server/upload-cleanup.ts`, run with Next's `after()` so the admin's request isn't kept waiting):

- saving a product without an uploaded image, or deleting the product, deletes that upload straight away — unless
  another product still uses it;
- after every successful upload, a sweep deletes any unused upload older than an hour: images uploaded into a
  form that was then cancelled, or left behind when the demo store reset. The hour keeps an image in a form that is
  still open from vanishing before it is saved (`UPLOAD_ORPHAN_GRACE_MINUTES` changes it).

**Safety.** A product can only reference images this app serves (`/products/…`, `/api/images/…`, or an upload in
this project's Blob store), so a product can't be pointed at an arbitrary external URL. The summary and spec fetchers only follow public `http(s)` addresses — every
redirect is re-checked, private and local networks are refused, and responses are capped at 2 MB and 12 s.

## Known limitations

- **Without `DATABASE_URL` the data is in memory.** Locally that is one process, so everything is consistent until
  you restart the server. On Vercel each serverless instance would hold its own copy and a cold start would reseed
  it — so production sets `DATABASE_URL` (see [Deploy to Vercel](#deploy-to-vercel)), which makes products, orders,
  users, content, settings and the logo durable. The dashboard CRUD test mocks the created product's endpoints when
  run against a remote URL, so it does not depend on either.
- **The role check is demo-grade.** Every write endpoint does check the caller's role (`lib/server/auth.ts`), but
  the caller identifies itself with an `x-user-id` header the browser sets, and a header can be typed by hand.
  Point `NEXT_PUBLIC_API_BASE_URL` at the Flask API and the same permission table runs behind its signed JWT.
  `/orders` is also still unscoped: it returns every order and the browser filters it to the signed-in user.
- **Uploads need a Blob store in production.** Without `BLOB_READ_WRITE_TOKEN` they are written to
  `.data/uploads/`, which on Vercel is read-only — so connect a Blob store before uploading there.
- **Catalogue pages are cached.** The homepage, categories and product pages are prerendered and revalidated every
  few minutes (and immediately after an edit made through the app). A change made directly in the database — in
  DBeaver, say — shows up after that interval, or after a redeploy.
- **HEIC (iPhone photos) isn't supported** — sharp's prebuilt binary has no HEVC decoder. The form says so and
  suggests exporting as JPG.
- **Prices are indicative** Indonesian street prices from September 2026.
- **Preview deployments** sit behind Vercel's Deployment Protection by default, which blocks the server's own
  requests to `/api`. Production is unaffected.

## Project structure

```
app/                  routes (App Router) and app/api/* - the mock Flask API
components/           about/, account/, admin/, auth/, build/, cart/, dashboard/, layout/, orders/, product/, ui/
context/              AuthContext (session + permissions), CartContext, SettingsContext
lib/                  types, roles, api (shared/server/client), settings, content, specs, compatibility rules, image loader, dashboard theme
lib/server/           the store (business rules), permission gate (auth.ts), password hashing, uploads, logo tracer, page scrapers
lib/server/db/        the data sources: memory.ts (dev + tests) and postgres.ts (Supabase), one DataSource interface
db/                   schema.sql - the PostgreSQL tables (applied by `npm run db:setup`)
data/                 catalog.json (seed data) and logo.json (the default logo, as vector paths)
assets/               AVIF masters + brand/logo-source.jpg (copied into public/ by `npm run assets:sync`)
public/checkpoint-1/  the plain HTML/CSS profile page, its stylesheet and logo.svg
scripts/              image pipeline, logo builder, asset sync, seed export, screenshots, catalogue validation
tests/                Playwright specs and global setup
docs/                 screenshots, updated-seed.sql for the Module 2 database
```
