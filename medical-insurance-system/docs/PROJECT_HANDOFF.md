# Mirai Assurance — Project Handoff

## Purpose

Mirai Assurance is a full-stack medical-insurance management application. Customers can browse insurance plans, apply with health declarations and documents, pay approved premiums through Razorpay, find hospitals, manage their profile, and file claims. Administrators create/edit plans, manage network hospitals, review applications and claims, and follow up on unpaid policies.

## Technology

| Area | Technology |
| --- | --- |
| Frontend | React 19, Vite, Tailwind CSS, React Router, Axios, Lucide icons |
| Backend | Node.js, Express, Mongoose/MongoDB |
| Authentication | Local bcrypt + JWT and Keycloak OIDC/JWT (dual-authentication design) |
| Payment | Razorpay Orders API and HMAC signature verification |
| Maps | Leaflet / React Leaflet with Geoapify configuration |
| Emails | Nodemailer SMTP for backend notifications; Keycloak SMTP separately for OIDC verification emails |
| Tests | Jasmine backend test suite |

## Repository layout

```text
medical-insurance-system/
├── backend/       Express API, MongoDB models, controllers, routes, tests
├── frontend/      React/Vite customer and administrator UI
├── keycloak/      Local Keycloak Docker configuration, realm import, custom login theme
└── docs/          Handoff and setup documents
```

## Run locally

Start MongoDB first. Then use separate terminals:

```powershell
cd backend
npm install
npm start
```

```powershell
cd frontend
npm install
npm run dev
```

API default: `http://localhost:1234`  
Frontend default: `http://localhost:5173`

Keycloak setup is separate; see `docs/OIDC_KEYCLOAK_SETUP.md` and `docs/OIDC_HANDOFF.md`.

## Environment variables

Never paste real secrets into source code, documentation, or chat. `.env` files are ignored by Git.

### Backend `.env`

```env
PORT=1234
MONGO_URI=mongodb://127.0.0.1:27017/medical_insurance
FRONTEND_ORIGIN=http://localhost:5173
JWT_SECRET=<long-random-local-JWT-secret>
RAZORPAY_KEY_ID=<Razorpay-key-id>
RAZORPAY_KEY_SECRET=<Razorpay-key-secret>
SMTP_HOST=<SMTP-host>
SMTP_PORT=<SMTP-port>
EMAIL_USER=<SMTP-user>
EMAIL_PASS=<SMTP-password-or-app-password>
EMAIL_FROM=<sender-address>
OIDC_ISSUER=http://localhost:8080/realms/mirai-assurance
OIDC_AUDIENCE=mirai-assurance-frontend
OIDC_JWKS_URI=http://localhost:8080/realms/mirai-assurance/protocol/openid-connect/certs
```

### Frontend `.env`

```env
VITE_API_BASE_URL=http://localhost:1234/api
VITE_RAZORPAY_KEY_ID=<public-Razorpay-key-id>
VITE_GEOAPIFY_KEY=<public-Geoapify-key>
VITE_KEYCLOAK_URL=http://localhost:8080
VITE_KEYCLOAK_REALM=mirai-assurance
VITE_KEYCLOAK_CLIENT_ID=mirai-assurance-frontend
```

## Main user journeys

### Customer

1. Registers/signs in using either local email/password or Keycloak OIDC.
2. Opens **Customer Dashboard** to view/search/filter insurance plans.
3. Opens a plan detail modal, then explicitly selects **Apply for this Plan**.
4. Selects individual/family application type, supplies an individual age when required, declares medical conditions, and may upload PDF/JPG/PNG medical-clearance documents.
5. Application is created with `Pending Admin Approval` and payment state `unpaid`.
6. Once an admin approves it, the customer can open Razorpay checkout from the plan/profile policy area.
7. Customer may update profile photo, view policies, file claims, view claims, and see hospital locations.

### Administrator

1. Signs in as a user with role `admin`.
2. Uses Admin Dashboard to review customers, applications, claims, and unpaid policies.
3. Approves/rejects applications; only approved and unpaid applications can start payment.
4. Creates/updates insurance plans using Add Plan.
5. Adds network hospitals using Add Hospital.
6. Reviews claims and changes claim status.

## Data model

### `User`

- `name`, `email` (unique), `role` (`customer` or `admin`)
- `password`: bcrypt hash for local accounts; intentionally not returned by normal queries
- `authProvider`: `local`, `oidc`, or `hybrid`
- `oidcSubject`: stable Keycloak `sub` for OIDC identity linkage
- profile image stored as MongoDB `Buffer` plus `contentType`, not as a machine-local image path

### `InsurancePlan`

- title, category, premium, coverage
- min/max eligible age
- covered conditions array
- terms, exclusions, network benefits

### `Application`

- customer user and plan references
- status: Pending Admin Approval / approved / rejected / active / default
- payment state, date, Razorpay order ID and payment ID
- individual/family type, individual age, structured health declaration, uploaded clearance-document URL

### `Claim` and `Hospital`

- Claim references the user and policy/application, amount, type, uploaded bill documents, and status.
- Hospital stores name, city, address, contact, network status, and map coordinates.

## API summary

All paths are below `http://localhost:1234/api`.

| Area | Routes / purpose |
| --- | --- |
| Auth | `POST /auth/register`, `POST /auth/login`, `GET /auth/profile`, `POST /auth/profile/image` |
| Plans | public `GET /plans`; admin `POST /plans/add`, `PUT /plans/:id` |
| Applications | `POST /applications/apply`, `GET /applications/my-policies`; admin `GET /applications/admin/all`, `PUT /applications/:id/status` |
| Payments | `POST /payments/order`, `POST /payments/verify` |
| Claims | customer `POST /claims/file`, `GET /claims/my-claims`; admin `GET /claims/admin/all`, `PUT /claims/:id/status` |
| Hospitals | public `GET /hospitals`; admin `POST /hospitals/add` |
| Admin | customers, unpaid applications, payment reminders, claim-status endpoints under `/admin` |

Protected routes require `Authorization: Bearer <token>`. The backend accepts a local application JWT or a verified Keycloak access token. Admin routes additionally use `roleMiddleware`.

## Payment implementation

Frontend component: `frontend/src/components/PaymentButton.jsx`.

1. Client calls `POST /payments/order` with only the application ID.
2. Backend verifies the caller owns the application, confirms `approved` + `unpaid`, and obtains the real premium from the database. It does **not** trust a client-provided amount.
3. Backend creates Razorpay order in paise and saves `razorpayOrderId`.
4. Razorpay checkout returns payment/order/signature values.
5. Client sends them to `POST /payments/verify`.
6. Backend verifies the HMAC SHA-256 signature using the Razorpay secret, checks the saved order ID and ownership, then records `paid`, payment date, and Razorpay payment ID.

Razorpay key ID is public frontend configuration. Razorpay key secret stays backend-only.

## Security notes and known improvement areas

- Credentials are environment variables; do not commit `.env` files.
- Passwords are bcrypt hashes; local authentication uses a signed application JWT.
- OIDC tokens are validated for signature via JWKS, issuer, audience, expiration, verified email, and trusted Keycloak role claims.
- Profile images are stored in the database, which makes them available across devices using the same database/API.
- Medical-clearance and claim uploads currently use the backend `uploads/` directory. For production, move them to protected object storage and authorize each download.
- Add database field encryption for highly sensitive PII/medical data and use a managed secret/KMS solution in production.
- Claims should additionally verify that `applicationId` belongs to `req.user.id` before insertion; this is a recommended next security fix.
- Payment records are kept on `Application`; a dedicated immutable `Payment` collection and Razorpay webhooks are recommended for a production-grade audit trail.

## Validation already performed

- Backend Jasmine tests: previously passed with 12 specs.
- Frontend production Vite build: previously passed.
- Keycloak end-to-end testing depends on the local Keycloak container, SMTP, roles, and redirect configuration.

## Important files for future work

- `frontend/src/pages/CustomerDashboard.jsx` — plans, filtering, plan details, application flow
- `frontend/src/components/ProfileSidebar.jsx` — policy/claim/profile UI
- `frontend/src/components/PaymentButton.jsx` — Razorpay checkout
- `backend/controllers/paymentController.js` — order creation and HMAC verification
- `backend/controllers/applicationController.js` — eligibility, medical declarations and document saving
- `backend/middleware/authMiddleware.js` — dual local/OIDC token handling
- `docs/OIDC_HANDOFF.md` — dedicated OIDC implementation and pending work
