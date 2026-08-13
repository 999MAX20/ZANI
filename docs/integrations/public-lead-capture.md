# Public Lead Capture

Zani Core does not generate landing pages. External landing builders, Codex agents or partner websites submit leads into Zani through a public lead form endpoint.

## Endpoint

```bash
POST https://<zani-api-domain>/api/public/forms/<public_id>/submit/
Content-Type: application/json
```

`public_id` belongs to a `LeadForm` and safely resolves the target `Business`.

## Example

```bash
curl -X POST "https://<zani-api-domain>/api/public/forms/<public_id>/submit/" \
  -H "Content-Type: application/json" \
  -d '{
    "full_name": "Alya Ivanova",
    "phone": "+77015550101",
    "email": "alya@example.com",
    "message": "I want to book a consultation",
    "source": "landing",
    "landing_id": "landing-demo-clinic-001",
    "page_url": "https://promo.example.com/spring",
    "campaign": "spring-pilot",
    "utm_source": "meta",
    "utm_medium": "cpc",
    "utm_campaign": "spring"
  }'
```

Successful response:

```json
{
  "ok": true,
  "success_message": "Спасибо! Мы скоро свяжемся с вами.",
  "submission_id": 123,
  "lead_id": 456,
  "duplicate_warning": false
}
```

## Stored Data

The backend creates or reuses a `Client`, creates a `Lead`, stores `LeadFormSubmission`, writes analytics/activity events and starts `lead_created` automations.

The submission stores:

- raw payload;
- UTM tags;
- `landing_id`;
- `page_url`;
- page domain;
- campaign/source context;
- IP address;
- user-agent;
- duplicate warnings.

Validation errors are recorded in `LeadFormSubmissionError` so support can diagnose broken external forms without losing context.

## Guardrails

- `public_form` DRF throttle protects the public endpoint.
- Required fields configured on the form are validated server-side.
- Basic honeypot fields `website_url`, `company_website`, `homepage` reject obvious spam.
- Merchant APIs remain tenant-filtered; another business cannot see the created lead or submission.
