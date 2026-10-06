# Mirai Assurance — OIDC / Keycloak Handoff

## Scope

This document is only about the Keycloak OpenID Connect work. Read `PROJECT_HANDOFF.md` for the full application context.

## Required architecture

The application must support two methods at the same time:

1. **Local authentication:** email/password → Express → MongoDB → bcrypt comparison → local application JWT.
2. **OIDC authentication:** React → Keycloak Authorization Code Flow + PKCE → Keycloak access token → Express JWKS verification.

OIDC must remain an optional button; it must not remove or replace local registration/login.

## Current implementation

### Frontend

- Dependency: `keycloak-js`.
- Main setup: `frontend/src/auth/keycloak.js`.
- App initializes Keycloak with `onLoad: 'check-sso'`, `pkceMethod: 'S256'`, and `checkLoginIframe: false`.
- Local session token/role are stored in `sessionStorage`, not `localStorage`.
- Axios interceptor (`frontend/src/api.js`) sends Keycloak access token when available; otherwise sends local JWT.
- `Login.jsx` shows local email/password form plus **Continue with Identity Provider**.
- `SignIn.jsx` shows local registration form plus **Register with Identity Provider**, using Keycloak's explicit registration action.
- `OidcComplete.jsx` is the OIDC callback route. It receives the authorization response, lets Keycloak JS process it, then routes customer to the requested safe path or admin to `/admin-dashboard`.
- `ProtectedRoute.jsx` uses the session state and role returned by `keycloak.js`.

### Backend

- `backend/middleware/authMiddleware.js` is the combined authentication middleware.
- It first attempts `jsonwebtoken.verify()` using `JWT_SECRET` and accepts only tokens with `authenticationMethod: 'local'` and a user ID.
- If not a valid local token, it loads Keycloak JWKS using `jose` and verifies the Keycloak token signature, issuer, audience, and expiration.
- OIDC requires token `email_verified === true`, `sub`, email, and realm role `customer` or `admin`.
- `req.user` always receives internal MongoDB user ID, email, role, authentication method, and OIDC subject (if available).
- `roleMiddleware.js` is the RBAC layer: admin routes require `req.user.role === 'admin'`.

### User linking

`backend/models/User.js` includes:

```text
authProvider: local | oidc | hybrid
oidcSubject: Keycloak stable subject ID
oidcIssuer: OIDC issuer associated with the subject
password: optional bcrypt hash for local capability
```

OIDC mapping rules:

1. Look up the user by `(oidcIssuer, oidcSubject)`.
2. Upgrade a legacy OIDC record without `oidcIssuer` when its subject matches the configured issuer.
3. Do not link an existing local account by email alone; explicit account linking is required.
4. If no matching OIDC identity exists, create an `oidc` user.
5. If the email belongs to an unlinked application account, reject the OIDC login.

Linking an already authenticated local account uses a separate short-lived transaction:

1. `POST /auth/link-oidc/start` requires the local JWT in `X-Local-Authorization` and stores only a hash of a random 32-byte transaction ID, its expiry, and the local user ID in `LinkingTransaction`.
2. The frontend passes only the opaque transaction ID as `link_tx` in the Keycloak callback URL. It never puts the local JWT in a URL or browser storage for this flow.
3. After registration, email verification, and a fresh Keycloak Authorization Code + PKCE login, `OidcComplete.jsx` sends the transaction ID and Keycloak access token to `POST /auth/link-oidc`.
4. The backend verifies the Keycloak token with the existing JWKS verifier, atomically consumes the pending transaction, and links the verified issuer and subject to the transaction's local user. Email equality is never used to link accounts.

The transaction is valid for ten minutes and can be consumed once. Because the local user is resolved server-side, the completion works in the original tab or in a new tab opened by the verification email. After linking, the user remains `hybrid`; the local password and normal local/OIDC authentication paths remain available.

## Keycloak local configuration

Files:

```text
keycloak/docker-compose.yml
keycloak/.env                 # local admin account only; ignored by Git
keycloak/realm-mirai-assurance.json
keycloak/themes/mirai/
```

Local realm:

```text
Realm: mirai-assurance
Client ID: mirai-assurance-frontend
Keycloak URL: http://localhost:8080
Frontend URL: http://localhost:5173
```

Client rules:

- Public client (no client secret in React)
- Standard Authorization Code flow enabled
- PKCE S256 required
- Implicit flow disabled
- Direct/password grant disabled
- Redirect URIs: `http://localhost:5173/*`
- Web origin: `http://localhost:5173`
- Audience token mapper adds `mirai-assurance-frontend`

Backend configuration:

```env
OIDC_ISSUER=http://localhost:8080/realms/mirai-assurance
OIDC_AUDIENCE=mirai-assurance-frontend
OIDC_JWKS_URI=http://localhost:8080/realms/mirai-assurance/protocol/openid-connect/certs
```

Frontend configuration:

```env
VITE_KEYCLOAK_URL=http://localhost:8080
VITE_KEYCLOAK_REALM=mirai-assurance
VITE_KEYCLOAK_CLIENT_ID=mirai-assurance-frontend
```

## Verification-email behavior

Keycloak—not the Express `emailService.js`—sends OIDC verification mail.

- Keycloak realm email settings need their own SMTP host/from/authentication values.
- Gmail should use `smtp.gmail.com`, port `587`, STARTTLS, a valid sender address, and a Google App Password.
- Do not add this app password to project code, `.env.example`, or Git.
- The temporary post-verification callback is treated only as a registration restart. It cannot provision the application user. A fresh credential login completes Authorization Code + PKCE at `/oidc-complete`.

## Roles

Only roles from a verified Keycloak access token are trusted for OIDC users.

- Customer accounts need realm role `customer`.
- Admin accounts need realm role `admin`.
- Assign roles in Keycloak Admin Console: **Users → user → Role mapping → Assign role**.
- Users must log out and sign in again after role changes so their new access token includes the role.

### Important current issue

The `customer` role must be assigned to each existing OIDC user unless the Keycloak realm’s default-role composite has been intentionally configured to include `customer`. Do not make every user a customer by default without confirming that product policy permits self-registration/customer access.

## OIDC cancel / close button

Theme files were added at:

```text
keycloak/themes/mirai/login/theme.properties
keycloak/themes/mirai/login/resources/js/cancel-oidc.js
```

They inject an `×` button into Keycloak-hosted login, registration, and verification pages. It cancels the OIDC request and returns to `http://localhost:5173/login`.

To activate it:

```powershell
cd keycloak
docker compose up -d --force-recreate
```

Then Keycloak Admin Console → `mirai-assurance` → **Realm settings → Themes** → set **Login theme** to `mirai` → Save.

## Current known issues / next work

1. **Profile button visibility:** The frontend has an additional protected-path fallback in `Navbar.jsx` to show the button. If it still does not display, fully restart Vite and hard refresh. Investigate React runtime/session-state mismatch rather than only CSS.
2. **Theme deployment:** The `mirai` theme will not appear until the Docker compose configuration mounts it and the Keycloak container is recreated.
3. **Role provisioning policy:** Decide whether self-registered OIDC users should automatically get customer role. If yes, add `customer` as a composite role of `default-roles-mirai-assurance` in Keycloak Admin Console and document approval. If no, keep manual admin assignment.
4. **Email delivery:** Confirm SMTP Test Connection/Test Authentication in Keycloak Admin Console. Backend SMTP success does not prove Keycloak SMTP works.
5. **Logout:** Validate both local and OIDC logout paths and ensure a Keycloak logout redirects correctly in Chrome.
6. **Testing:** Add integration tests with a disposable Keycloak realm for wrong issuer/audience/signature/expiry, no role, customer/admin routes, subject/email linking, and OIDC callback cancellation.
7. **Production:** Replace HTTP localhost with HTTPS, exact production redirect URIs/web origins, protected secret storage, and a durable Keycloak database (not dev mode/H2).

## OIDC test checklist

- Local customer register, local login, wrong password, local token expiration, local admin authorization.
- OIDC registration, email verification, credential login, `/oidc-complete`, customer dashboard, profile sidebar.
- OIDC cancellation using the theme `×` button.
- Invalid/expired/wrong-audience Keycloak token receives 401.
- OIDC token without customer/admin receives 403.
- Customer receives 403 on admin endpoints; admin succeeds.
- Local and OIDC users with the same email remain separate until an explicit account-linking flow is completed.

## Do not do these things

- Do not remove local bcrypt/JWT authentication while this dual-authentication requirement remains.
- Do not send a Keycloak client secret to React; the current client is public and uses PKCE.
- Do not trust role from frontend state or request body.
- Do not store real SMTP/Razorpay/Keycloak-admin secrets in any document or source file.
