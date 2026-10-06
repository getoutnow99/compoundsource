# CompoundSource

Clinic ordering portal. Clinics sign up with the same details as the pharmacy sign-up forms, get approved, then order for a patient from one combined list of 542 compounded medications across partner pharmacies. Admins place each order in the pharmacy's own portal and track it here.

## Pages

| Who | Page | What it does |
| --- | --- | --- |
| Public | `/` | Landing page, sign-up and sign-in links |
| Public | `/signup` | Clinic sign-up: clinic, prescribers (license, NPI, DEA), license copies, shipping, billing (no card numbers), provider agreement, login |
| Clinic | `/order/new` | Patient, then medications, then review with prescription upload |
| Clinic | `/orders`, `/orders/[id]` | Order history and status, tracking |
| Clinic | `/account` | Clinic details on file |
| Admin | `/admin` | Order queue with counts and filters |
| Admin | `/admin/orders/[id]` | Mark sent, shipped (with tracking), delivered, or cancel |
| Admin | `/admin/clinics`, `/admin/clinics/[id]` | Review sign-ups, view license copies, approve or reject |
| Admin | `/admin/medications` | Side-by-side pharmacy price list |

## Run it

Needs Node 20+ and Postgres 14+.

```bash
npm install
cp .env.example .env.local          # set DATABASE_URL, APP_URL, ADMIN_NOTIFY_EMAIL, RESEND_API_KEY
npx tsx --env-file=.env.local scripts/setup-db.ts             # tables + pharmacies + medications (safe to re-run)
npx tsx --env-file=.env.local scripts/create-admin.ts you@yourdomain.com "Your Name" "a-long-password"
npm run build && npm start
```

To update prices, edit `data/medications.json` and re-run `setup-db.ts`.

## Environment variables

- `DATABASE_URL`: Postgres connection string.
- `APP_URL`: public address, used in email links (for example `https://compoundsource.com`).
- `ADMIN_NOTIFY_EMAIL`: where new sign-up and new order alerts go.
- `RESEND_API_KEY`, `EMAIL_FROM`: email sending through Resend. Without a key, emails are printed to the server log.

## Privacy and security (HIPAA)

The site stores patient names, birth dates, addresses and prescriptions, so it must run on hosting that signs a Business Associate Agreement (BAA), for both the server and the database. Options: AWS (BAA free in AWS Artifact), or Vercel Pro/Enterprise with a HIPAA add-on plus Supabase Team with the HIPAA add-on. The email provider never receives patient data: emails only carry clinic names, order numbers and links.

Built in: hashed passwords (bcrypt), sessions that expire after 60 minutes idle or 12 hours, audit log of every view and change to orders and clinics, file downloads only for the owning clinic or an admin, security headers, no card numbers collected.

Before launch: legal review of `src/lib/agreement.ts` and of how clinic membership fees are charged (Anti-Kickback Statute, Florida Patient Brokering Act), HTTPS on the domain, database backups.
