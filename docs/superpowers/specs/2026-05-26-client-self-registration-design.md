# Client self-registration design

## Goal

Allow a new client to create their own access from the login screen, register one or more vehicles during signup, and start scheduling immediately with the `Clientes` role.

## Decisions

- Signup is public, but it always creates role `Clientes`; role, permissions, status, and base access are not accepted from the browser.
- The client selects one base during signup. Admins can later adjust allowed bases from Settings.
- At least one vehicle is required on signup. The client can add more vehicles later from the scheduling flow that already exists.
- Existing vehicle plates are never overwritten by signup. If a plate already exists, signup stops with a conflict message.
- The created session uses the same secure cookie flow as normal login, so the client lands directly in scheduling.

## Form fields

- Client/company name
- Email
- Password and confirmation
- Preferred base
- Vehicle list: plate, model, type

## Backend contract

`POST /api/auth/register-client`

Payload:

```json
{
  "name": "Empresa Exemplo",
  "email": "cliente@empresa.com",
  "password": "SenhaForte#123",
  "confirmPassword": "SenhaForte#123",
  "baseId": "taruma",
  "vehicles": [
    { "plate": "ABC1D23", "model": "Hilux", "type": "pickup_4x4" }
  ]
}
```
Response:

```json
{
  "user": { "role": "Clientes" },
  "expiresAt": "2026-06-02T00:00:00.000Z",
  "vehicles": []
}
```
