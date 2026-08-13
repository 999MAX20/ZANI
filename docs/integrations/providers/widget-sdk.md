# Zani Website Widget SDK MVP

Локальный bundle виджета собирается вместе с frontend:

```bash
cd /Users/maksim/Desktop/Zani/frontend
npm run build
```

Результат:

```text
frontend/dist/widget/zani-widget.js
```

## Embed

Production CDN пока не подключён. Целевая форма embed:

```html
<script
  src="https://cdn.zani.kz/widget.js"
  data-zani-token="PUBLIC_WEBSITE_CHANNEL_TOKEN"
  data-zani-api="https://api.zani.kz"
></script>
```

Локально можно подключить собранный файл и backend:

```html
<script
  src="/widget/zani-widget.js"
  data-zani-token="PUBLIC_WEBSITE_CHANNEL_TOKEN"
  data-zani-api="http://localhost:8000"
></script>
```

## Options

- `data-zani-token` — `BotChannel.public_token` для website channel.
- `data-zani-api` — backend origin. Если frontend и backend на одном origin, можно оставить пустым.
- `data-zani-position` — `right` или `left`, по умолчанию `right`.

Также можно инициализировать вручную:

```html
<script src="/widget/zani-widget.js"></script>
<script>
  window.ZaniWidget.init({
    publicToken: "PUBLIC_WEBSITE_CHANNEL_TOKEN",
    apiUrl: "http://localhost:8000",
    position: "right"
  });
</script>
```

## Что умеет MVP

- показывает chat bubble;
- открывает chat window;
- создаёт conversation через public website chat API;
- отправляет последующие сообщения в тот же conversation;
- показывает basic status после отправки.

## Ограничения MVP

- realtime пока нет;
- AI auto replies нет;
- CDN не подключён;
- advanced themes нет.
