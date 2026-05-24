# Block 9 — Data Import / Sales & Services Seed

Цель блока: владелец не должен попадать в пустой ZANI. Даже если новый лендинг ещё не привёл заявок, бизнес может загрузить продажи, услуги/товары и клиентов через CSV/XLSX, после чего dashboard и AI получают реальные business events.

## Что проверяется

- CSV/XLSX import для sales, catalog, clients.
- Preview before confirm.
- Человеческие ошибки валидации.
- Confirm import создаёт BusinessEvent для продаж и каталога.
- Dashboard начинает показывать revenue на основе `sale.recorded`.
- Sample CSV-файлы лежат в `docs/import_samples/`.
- Команда `write_import_samples` может выгрузить актуальные шаблоны из backend templates.

## Команды ручной проверки

```bash
python manage.py write_import_samples --output-dir /tmp/zani_import_samples
python manage.py test apps.core.tests_import_export apps.core.tests_import_samples -v 2
```

## Sample files

- `docs/import_samples/sales_template.csv`
- `docs/import_samples/catalog_template.csv`
- `docs/import_samples/clients_template.csv`

## Product meaning

Landing is only the entry. Data import is the moment ZANI starts becoming useful:

```text
лендинг активирован
↓
загрузка продаж / услуг / клиентов
↓
BusinessEvent
↓
Dashboard оживает
↓
AI не выдумывает, а объясняет реальные данные
```
