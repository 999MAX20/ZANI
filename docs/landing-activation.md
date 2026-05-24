# Landing Activation

Zani Core receives activation events from an external landing/payment pipeline. It does not generate landing pages.

## Endpoint

Platform users can activate a merchant workspace:

```bash
POST https://<zani-api-domain>/api/platform/activate-landing/
Authorization: Bearer <platform_access_token>
Content-Type: application/json
```

Example:

```bash
curl -X POST "https://<zani-api-domain>/api/platform/activate-landing/" \
  -H "Authorization: Bearer <platform_access_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "landing_id": "landing-demo-clinic-001",
    "owner_email": "owner@example.com",
    "owner_password": "ZaniTest123!",
    "owner_full_name": "Demo Owner",
    "business_name": "Demo Clinic",
    "business_type": "medical",
    "landing_domain": "promo.example.com",
    "landing_preview_url": "https://preview.example.com/demo-clinic"
  }'
```

## What Activation Creates

The activation service creates or updates:

- `User` with `role=business_owner`;
- `Business` with `status=trial`;
- `BusinessMember` owner membership;
- default system roles and permissions;
- CRM Light pipeline;
- default landing `LeadForm` with `public_id`;
- `Subscription` with `status=trial`;
- 30-day `next_payment_at` for gifted trial access;
- `Business.landing_id`, `landing_domain`, `landing_preview_url`.

The operation is idempotent by `landing_id`: calling it again updates the same business instead of creating duplicates.

## Default CRM Light Stages

Activation creates these pilot stages:

- `Новая заявка`;
- `Связались`;
- `Записан / в работе`;
- `Оплатил / закрыт`;
- `Не дозвонились`;
- `Отказ`.

## Response

The response includes the created business, owner, subscription, lead form `public_id` and pipeline summary. The external landing should use `lead_form.public_id` for future public form submissions.
