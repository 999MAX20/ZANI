import json


CSV_FORMULA_PREFIXES = ("=", "+", "-", "@")


def safe_csv_cell(value):
    if value is None:
        return ""
    if isinstance(value, (dict, list)):
        value = json.dumps(value, ensure_ascii=False, sort_keys=True)
    text = str(value)
    stripped = text.lstrip()
    if stripped.startswith(CSV_FORMULA_PREFIXES):
        return f"'{text}"
    return text
