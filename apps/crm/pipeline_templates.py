DEFAULT_PIPELINE_TEMPLATE_KEY = "smb_default"


DEFAULT_STAGE_SPECS = (
    {"template_key": "new", "name": "Новая сделка", "color": "#06b6d4", "probability": 10, "sla_minutes": 60, "is_won": False, "is_lost": False},
    {"template_key": "qualification", "name": "Квалификация", "color": "#2563eb", "probability": 30, "sla_minutes": 240, "is_won": False, "is_lost": False},
    {"template_key": "proposal", "name": "Предложение", "color": "#8b5cf6", "probability": 55, "sla_minutes": 480, "is_won": False, "is_lost": False},
    {"template_key": "negotiation", "name": "Согласование", "color": "#d97706", "probability": 75, "sla_minutes": 1440, "is_won": False, "is_lost": False},
    {"template_key": "won", "name": "Успешно", "color": "#16a34a", "probability": 100, "sla_minutes": None, "is_won": True, "is_lost": False},
    {"template_key": "lost", "name": "Потеряно", "color": "#ef4444", "probability": 0, "sla_minutes": None, "is_won": False, "is_lost": True},
)
