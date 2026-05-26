# Client self-registration implementation plan

## Scope

Create immediate public client signup with vehicle registration from the login screen, preserving all existing vehicle and customer data.

## Steps

1. Add a backend signup normalizer/helper and tests for forced `Clientes` role, allowed base validation, vehicle normalization, and required vehicle data.
2. Add `POST /api/auth/register-client` as a public endpoint using one database transaction for member plus vehicles.
3. Extend the API client with signup payload and response types.
4. Replace the login-only screen with a login/signup switch and dynamic vehicle list.
5. Wire app session startup so signup follows the same path as login and lands in scheduling.
6. Run the targeted signup test, TypeScript lint, docs checks, and production build.
7. Deploy after local verification.
