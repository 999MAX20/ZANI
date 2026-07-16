# Mobile Privacy And Permission Copy

Date: 2026-06-27

This document defines mobile privacy wording and store-disclosure inputs. It is not legal advice; final wording must be reviewed by the company owner/legal reviewer before store submission.

## Push Permission Rationale

Use this copy near the app-level push preference surface. The OS permission dialog text itself is controlled by iOS/Android.

| Language | Copy |
| --- | --- |
| RU | Включите push, чтобы получать новые заявки, сообщения, задачи и важные изменения по рабочему кабинету. |
| KK | Жаңа өтінімдер, хабарламалар, тапсырмалар және жұмыс кабинетіндегі маңызды өзгерістер туралы push алу үшін қосыңыз. |
| EN | Turn on push to receive new leads, messages, tasks and important workspace changes. |

## Redacted Notification Default

| Language | Copy |
| --- | --- |
| RU | По умолчанию текст клиента скрыт до открытия приложения. |
| KK | Әдепкі бойынша клиент мәтіні қолданба ашылғанға дейін жасырылған. |
| EN | Customer text is hidden until the app is opened by default. |

## Full Notification Text Setting

| Language | Copy |
| --- | --- |
| RU | Показывать краткий текст уведомления на экране устройства. |
| KK | Құрылғы экранында хабарламаның қысқа мәтінін көрсету. |
| EN | Show compact notification text on the device screen. |

## Device Session Copy

| Language | Copy |
| --- | --- |
| RU | Устройства можно отключить в любой момент. После отключения вход и push на этом устройстве прекращаются. |
| KK | Құрылғыларды кез келген уақытта өшіруге болады. Өшірілгеннен кейін бұл құрылғыда кіру және push тоқтайды. |
| EN | Devices can be revoked at any time. After revocation, sign-in and push stop on that device. |

## Store Data Categories

Expected data categories for App Store / Play Store disclosure:

- Account identifiers: email, user id and business membership.
- Business CRM data: leads, clients, tasks, appointments, conversations and notifications shown to the authenticated merchant user.
- Device/session data: platform, app version, build number, OS version, device model, last seen time, IP-derived request metadata.
- Push token data: stored encrypted on the backend and never shown back to API clients.
- Diagnostics: crash reports, request ids, endpoint latency, sanitized error metadata and release/build tags.

Do not claim that the app has no data collection. The app processes business CRM data for the merchant workspace.

## Sensitive Data Rules

- Do not include raw push tokens in logs, API responses, exports or support screenshots.
- Do not include refresh tokens in logs or analytics.
- Do not send full customer message text to push delivery logs.
- Default push payloads must be redacted unless the user explicitly chooses full notification text.
- Support and store-review accounts must use test business data, not a real merchant's customers.
