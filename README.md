# MobileHub — iPhone store starter

A static front-end (home, about, contact, registration, login, catalog,
checkout, and admin) plus a small Node.js backend that handles accounts,
product data, contact enquiries, and Ozow payments.

```
iphone-store/
├── frontend/     ← static site: HTML/CSS/JS, deploy anywhere static
└── backend/      ← Node.js/Express API: auth + Ozow checkout
```

## 1. Run it locally

**Backend**
```bash
cd backend
npm install
cp .env.example .env      # then fill in your Ozow test credentials
npm start                 # runs on http://localhost:4000
```

**Frontend**
Just open `frontend/index.html` in a browser, or serve the folder so
paths behave (recommended): from the `frontend` folder run
```bash
npx serve .                # or: python3 -m http.server 5500
```
`frontend/js/config.js` already points at `http://localhost:4000` when
you're on localhost.

## 2. Admin access

The backend creates or repairs the default admin account on startup:

```text
Email: admin@mobilehub.co.za
Password: admin123456
```

Admins are redirected to `frontend/admin.html` after login. The admin dashboard
can view products, orders, low-stock counts, and Contact Us messages.

## 3. Database

The deployable Node database layer lives in `backend/db.js`. It stores data in
JSON collections under `backend/data`:

```text
users.json      customer/admin accounts
sessions.json   login sessions
products.json   store catalog and stock
orders.json     checkout orders
messages.json   Contact Us enquiries
```

This keeps the project easy to deploy on basic Node hosting because there is no
native database server to install. For production with higher order volume, move
the same `db.js` methods to SQLite, Postgres, or another hosted database.

## 4. Contact form email

Contact Us enquiries are saved in `backend/data/messages.json` and can also be
emailed to:

```text
justcellitza826@gmail.com
```

To enable email delivery, add SMTP settings to `backend/.env` or your deployed
backend environment variables:

```text
CONTACT_TO_EMAIL=hello@mobilehub.co.za
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your_sending_email@gmail.com
SMTP_PASS=your_gmail_app_password_here
MAIL_FROM="MobileHub Website <your_sending_email@gmail.com>"
```

For Gmail, `SMTP_PASS` must be an app password, not the normal mailbox password.

## 5. Get your Ozow credentials

1. Sign up at https://pay.ozow.com as a merchant (you'll need business/bank
   details for verification — this is required by law for anyone accepting
   payments).
2. In the merchant admin, add a "site" — this gives you a **SiteCode**.
3. Under merchant details you'll find your **Private Key** and **API Key**.
4. Ozow gives you sandbox/test credentials automatically so you can test the
   whole flow — including fake bank logins — before going live. Put those in
   `backend/.env` as `OZOW_SITE_CODE` and `OZOW_PRIVATE_KEY`, and leave
   `OZOW_IS_TEST=true` until you're ready to accept real money.
5. When you go live, Ozow reviews and approves production access, then you
   flip `OZOW_IS_TEST=false` and swap in your live SiteCode/PrivateKey.

**Important:** the private key must only ever live on the backend
(`backend/.env`), never in any frontend file. That's the whole reason a
backend exists here — a static site cannot keep this secret.

## 6. How the payment flow works

1. Customer clicks "Buy now" → logs in/registers if needed.
2. On the checkout page they pick a quantity and click "Continue to Ozow".
3. Your backend (`POST /api/checkout`) creates an order record and builds a
   signed URL for Ozow, using your private key server-side.
4. The customer is redirected to Ozow, selects their bank, logs into their
   own online banking, and approves the exact amount.
5. Ozow redirects them back to `checkout.html` with a status — but more
   importantly, Ozow also calls your backend directly
   (`POST /api/ozow-webhook`) to confirm the payment server-to-server. That
   webhook call, not the redirect, is what actually marks the order "paid"
   and reduces stock. This matters because a redirect alone could be faked;
   the webhook is signed and verified.

## 7. Deploying

**Backend → Render (or Railway/Fly.io)**
1. Push this repo to GitHub.
2. On Render: New → Web Service → connect the repo → root directory
   `backend` → build command `npm install` → start command `npm start`.
3. Add all the variables from `.env.example` as environment variables in
   Render's dashboard (never commit your real `.env`).
4. Once deployed, note your backend's URL — you'll need it next.
5. In your Ozow merchant admin, set the **Notify URL** for your site to
   `https://your-backend.onrender.com/api/ozow-webhook` (the code also sends
   it per-request, but setting it in the dashboard too is a good backup).

**Frontend → any static host** (Netlify, Vercel, GitHub Pages, Render static
site)
1. Update `frontend/js/config.js` — replace
   `https://YOUR-BACKEND-URL.onrender.com` with your real backend URL.
2. Update `FRONTEND_URL` in the backend's environment variables to match
   your deployed frontend's URL (used for CORS and Ozow's redirect links).
3. Deploy the `frontend` folder.

## 8. Before you take real payments

- Swap the JSON-file storage (`backend/data/*.json`) for a real database —
  it works for building and testing, but isn't safe for concurrent orders
  or real customer data at scale.
- Add HTTPS (Render/Netlify give you this by default) — Ozow requires it.
- Read Ozow's go-live checklist in their merchant admin; they'll review your
  site before enabling production payments.
- Consider adding email confirmations, an admin view of orders, and proper
  logging.
