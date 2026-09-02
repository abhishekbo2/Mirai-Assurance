# Keycloak OIDC and JWT setup

## What changed

The application supports two independent sign-in methods:

- **Local email/password:** the existing Mirai registration and login endpoints hash passwords with bcrypt and issue a one-day application JWT.
- **OIDC / Keycloak:** the React application uses the OIDC Authorization Code flow with PKCE and obtains a short-lived Keycloak access token.

The login and registration pages show both options. Local tokens are kept only in browser session storage; Keycloak tokens are managed by the Keycloak adapter. The backend accepts either a valid local JWT or a valid Keycloak JWT.

Every protected Express endpoint expects `Authorization: Bearer <access-token>`. The backend verifies the token signature using Keycloak's JWKS, and also validates the issuer, audience, and expiration. It reads only Keycloak realm roles (`customer` and `admin`) for authorization.

The MongoDB `User` record contains `authProvider` (`local`, `oidc`, or `hybrid`) and is linked to Keycloak using the immutable `sub` claim in `oidcSubject`. If a verified Keycloak email matches an existing local user, it becomes a `hybrid` account instead of creating a duplicate. The local password remains usable.

## Local start

1. Copy `keycloak/.env.example` to `keycloak/.env` and choose a strong local admin password. Do not commit it.
2. Run `docker compose --env-file .env up -d` from the `keycloak` folder.
3. Copy the OIDC values in `backend/.env.example` into `backend/.env` and the Keycloak values in `frontend/.env.example` into `frontend/.env`.
4. Start MongoDB, then start the backend and frontend as usual.
5. Open the app and select **Create account**. Keycloak hosts the registration screen; verified users receive the `customer` realm role by default.

## Admin access

In the Keycloak Admin Console, open realm `mirai-assurance`, locate the user, and assign the `admin` realm role. Remove `customer` if the account should be administrator-only. Sign out and sign in again so the access token contains the new role.

## Email verification

Keycloak sends OIDC verification emails itself. The backend SMTP variables do not configure Keycloak.

For Gmail delivery, open `http://localhost:8080`, sign in to the Keycloak Admin Console, select the `mirai-assurance` realm, then open **Realm settings → Email**. Configure:

- Host: `smtp.gmail.com`
- Port: `587`
- From: the Gmail address used to send mail
- Enable StartTLS and authentication
- User: the same Gmail address
- Password: a Google App Password, not the normal Gmail password

Use **Test connection** and **Test authentication** before trying registration again. Keep the App Password only in Keycloak's configuration; never add it to frontend or backend source files. For local testing without an SMTP account, temporarily turn off **Verify email** in the same realm settings.

The current Keycloak log confirms the cause of failed delivery: `No sender address configured in the realm settings for emails`.

After verification, Keycloak returns to `/oidc-complete`. That page completes the Authorization Code + PKCE flow and routes an authenticated user to their dashboard. This is safer than treating an email verification link as an application login by itself. If a user cancels an identity-provider screen, they can use the browser Back button to return to the Mirai login or registration page; doing so cancels the in-progress OIDC authorization request.

## OIDC cancel button

The repository includes a small Keycloak login theme at `keycloak/themes/mirai`. It adds an `×` button to Keycloak-hosted login, registration, and verification pages. Clicking it abandons the in-progress OIDC request and returns to `http://localhost:5173/login`.

After pulling these changes, recreate the local Keycloak container so Docker mounts the theme:

```powershell
cd keycloak
docker compose up -d --force-recreate
```

Then in Keycloak Admin Console, choose the `mirai-assurance` realm, open **Realm settings → Themes**, select `mirai` as the **Login theme**, and save. This setting is stored in Keycloak's local realm database, not in the frontend or backend source code.

## Production checklist

- Use HTTPS for Keycloak, frontend, and API; replace localhost redirect URIs and CORS origin with exact production URLs.
- Keep the frontend client public and use Authorization Code + PKCE. Do not enable implicit flow or direct-access/password grants.
- Store Keycloak admin credentials, Razorpay secret, SMTP password, and MongoDB URI in the deployment secret manager, never source control.
- Restrict Keycloak redirect URIs and web origins to exact trusted application origins.
- Configure email delivery before enabling self-registration in production so `verifyEmail` can be completed.
- Rotate credentials and revoke user sessions after an incident.

## Verification checklist

- A request without a Bearer token returns `401`.
- A token with another issuer, an invalid signature, wrong audience, or expired `exp` returns `401`.
- A valid token without `customer` or `admin` returns `403`.
- Customer tokens receive `403` on administrative routes.
- The first valid request creates or links the MongoDB user using `oidcSubject`.
