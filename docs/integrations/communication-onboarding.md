# Communication-First Onboarding

Phase 6 makes onboarding prove the first business value path:

```text
niche template -> first channel -> first message -> client/lead/inbox
```

## API

Existing:

- `GET /api/onboarding/templates/`
- `GET /api/onboarding/status/?business=`
- `POST /api/onboarding/apply-template/`
- `POST /api/onboarding/demo-data/`

New:

- `POST /api/onboarding/setup-channel/`
- `POST /api/onboarding/first-message/`

## Setup Channel

Payload:

```json
{
  "business": 1,
  "channel": "website"
}
```

Supported MVP channels:

- `website`;
- `telegram`;
- `whatsapp`.

Website is the recommended first pilot channel because it works without external credentials.

Telegram and WhatsApp create safe mock connectors with clear setup state. Real provider credentials are handled later in `/dashboard/integrations`.

## First Message

`POST /api/onboarding/first-message/` creates:

- active website bot/channel if missing;
- `BusinessConnector`;
- `Client`;
- `Lead`;
- `BotConversation`;
- inbound `BotMessage`;
- normalized `BusinessEvent`.

This lets the merchant open:

- `/dashboard/conversations`;
- `/dashboard/leads`;
- `/dashboard/integrations`;

and immediately understand how communication becomes CRM work.

## Checklist

The onboarding checklist now includes:

- niche template;
- services;
- resources;
- working hours;
- quick replies;
- automations;
- first channel;
- first message;
- first lead;
- first appointment.

## Permissions

Onboarding setup uses the existing settings permission:

```text
settings.update
```

Owners/admins can run setup. Operators cannot run setup.

## Next Steps

- turn mock Telegram/WhatsApp setup into guided real setup;
- add provider-specific recovery cards;
- show copied website widget snippet after website channel creation;
- add “send test message” from public widget preview;
- map onboarding events into the unified activity timeline.
