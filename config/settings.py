from pathlib import Path
from datetime import timedelta
from urllib.parse import quote
import json

import environ


BASE_DIR = Path(__file__).resolve().parent.parent

env = environ.Env(
    DEBUG=(bool, False),
    ALLOWED_HOSTS=(list, []),
    CORS_ALLOWED_ORIGINS=(list, []),
    CORS_ALLOW_CREDENTIALS=(bool, False),
    CSRF_TRUSTED_ORIGINS=(list, []),
    SECURE_SSL_REDIRECT=(bool, False),
    SESSION_COOKIE_SECURE=(bool, False),
    CSRF_COOKIE_SECURE=(bool, False),
    DB_CONN_MAX_AGE=(int, 60),
    SUPPORT_REQUIRES_GRANT=(bool, False),
    AUDIT_LOG_RETENTION_DAYS=(int, 365),
    LOG_LEVEL=(str, "INFO"),
    CELERY_TASK_DEFAULT_QUEUE=(str, "default"),
    CELERY_TASK_ALWAYS_EAGER=(bool, False),
    CELERY_TASK_STORE_EAGER_RESULT=(bool, False),
    AUTOMATIONS_RUN_INLINE=(bool, True),
    PAID_BETA_STAGING_SMOKE_GREEN=(bool, False),
    PAID_BETA_BROWSER_E2E_GREEN=(bool, False),
    PAID_BETA_BACKUP_RESTORE_DRILL_DONE=(bool, False),
    PAID_BETA_SUPPORT_GRANT_FLOW_TESTED=(bool, False),
    SOCIAL_AUTH_AUTO_CREATE_MERCHANT=(bool, True),
)
environ.Env.read_env(BASE_DIR / ".env")

SECRET_KEY = env("SECRET_KEY", default="change-me-in-production")
DEBUG = env("DEBUG")
ENVIRONMENT = env("ENVIRONMENT", default="development")
IS_PRODUCTION_LIKE_ENVIRONMENT = ENVIRONMENT in {"production", "staging"}
ALLOWED_HOSTS = env("ALLOWED_HOSTS", default=["*"])
CORS_ALLOWED_ORIGINS = env("CORS_ALLOWED_ORIGINS", default=[])
CORS_ALLOW_CREDENTIALS = env("CORS_ALLOW_CREDENTIALS")
CSRF_TRUSTED_ORIGINS = env("CSRF_TRUSTED_ORIGINS", default=[])


def build_database_url():
    explicit_url = env("DATABASE_URL", default="")
    if explicit_url:
        return explicit_url

    project_ref = env("SUPABASE_PROJECT_REF", default="")
    password = env("SUPABASE_DB_PASSWORD", default="")
    if not project_ref or not password:
        return f"sqlite:///{BASE_DIR / 'db.sqlite3'}"

    connection_mode = env("SUPABASE_DB_CONNECTION_MODE", default="pooler").lower()
    database_name = env("SUPABASE_DB_NAME", default="postgres")
    if connection_mode == "direct":
        username = env("SUPABASE_DB_USER", default="postgres")
        host = env("SUPABASE_DB_HOST", default=f"db.{project_ref}.supabase.co")
        port = env("SUPABASE_DB_PORT", default="5432")
    else:
        username = env("SUPABASE_DB_USER", default=f"postgres.{project_ref}")
        host = env("SUPABASE_DB_POOLER_HOST", default=env("SUPABASE_DB_HOST", default=""))
        region = env("SUPABASE_DB_REGION", default="")
        if not host and region:
            host = f"aws-0-{region}.pooler.supabase.com"
        port = env("SUPABASE_DB_PORT", default="6543")

    return "postgresql://{user}:{password}@{host}:{port}/{database}?sslmode=require".format(
        user=quote(username, safe=""),
        password=quote(password, safe=""),
        host=host,
        port=port,
        database=quote(database_name, safe=""),
    )

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "corsheaders",
    "rest_framework",
    "rest_framework_simplejwt",
    "rest_framework_simplejwt.token_blacklist",
    "apps.accounts",
    "apps.activities",
    "apps.ai_core",
    "apps.automations",
    "apps.billing",
    "apps.bots",
    "apps.businesses",
    "apps.clients",
    "apps.crm",
    "apps.services",
    "apps.leads",
    "apps.scheduling",
    "apps.tasks",
    "apps.conversations",
    "apps.notifications",
    "apps.outreach",
    "apps.analytics",
    "apps.core",
    "apps.integrations",
    "apps.pricing",
    "apps.onboarding",
]

USE_S3 = env.bool("USE_S3", default=False)
if USE_S3:
    INSTALLED_APPS.append("storages")

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "config.wsgi.application"
ASGI_APPLICATION = "config.asgi.application"

DATABASES = {"default": env.db_url_config(build_database_url())}
DATABASES["default"]["CONN_MAX_AGE"] = env("DB_CONN_MAX_AGE")

AUTH_USER_MODEL = "accounts.User"

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

LANGUAGE_CODE = "en-us"
TIME_ZONE = "UTC"
USE_I18N = True
USE_TZ = True

STATIC_URL = "static/"
STATIC_ROOT = env("STATIC_ROOT", default=str(BASE_DIR / "staticfiles"))
MEDIA_URL = env("MEDIA_URL", default="media/")
MEDIA_ROOT = env("MEDIA_ROOT", default=str(BASE_DIR / "media"))
PRIVATE_MEDIA_ROOT = env("PRIVATE_MEDIA_ROOT", default=str(BASE_DIR / "media" / "private"))
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

MAX_UPLOAD_SIZE_MB = env.int("MAX_UPLOAD_SIZE_MB", default=10)
IMPORT_MAX_ROWS = env.int("IMPORT_MAX_ROWS", default=5000)
IMPORT_PREVIEW_ROWS = env.int("IMPORT_PREVIEW_ROWS", default=10)
ALLOWED_UPLOAD_EXTENSIONS = env.list(
    "ALLOWED_UPLOAD_EXTENSIONS",
    default=["jpg", "jpeg", "png", "webp", "pdf", "txt", "doc", "docx", "xls", "xlsx", "mp3", "ogg", "wav"],
)
ALLOWED_UPLOAD_CONTENT_TYPES = env.list(
    "ALLOWED_UPLOAD_CONTENT_TYPES",
    default=[
        "image/jpeg",
        "image/png",
        "image/webp",
        "application/pdf",
        "text/plain",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/vnd.ms-excel",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "audio/mpeg",
        "audio/ogg",
        "audio/wav",
    ],
)

if USE_S3:
    AWS_ACCESS_KEY_ID = env("AWS_ACCESS_KEY_ID", default="")
    AWS_SECRET_ACCESS_KEY = env("AWS_SECRET_ACCESS_KEY", default="")
    AWS_STORAGE_BUCKET_NAME = env("AWS_STORAGE_BUCKET_NAME", default="")
    AWS_S3_ENDPOINT_URL = env("AWS_S3_ENDPOINT_URL", default="")
    AWS_S3_REGION_NAME = env("AWS_S3_REGION_NAME", default="")
    AWS_QUERYSTRING_AUTH = env.bool("AWS_QUERYSTRING_AUTH", default=True)
    AWS_DEFAULT_ACL = None
    AWS_S3_FILE_OVERWRITE = False
    STORAGES = {
        "default": {
            "BACKEND": "storages.backends.s3.S3Storage",
            "OPTIONS": {
                "bucket_name": AWS_STORAGE_BUCKET_NAME,
                "endpoint_url": AWS_S3_ENDPOINT_URL or None,
                "region_name": AWS_S3_REGION_NAME or None,
                "access_key": AWS_ACCESS_KEY_ID or None,
                "secret_key": AWS_SECRET_ACCESS_KEY or None,
                "querystring_auth": AWS_QUERYSTRING_AUTH,
                "default_acl": AWS_DEFAULT_ACL,
                "file_overwrite": AWS_S3_FILE_OVERWRITE,
            },
        },
        "staticfiles": {
            "BACKEND": "django.contrib.staticfiles.storage.StaticFilesStorage",
        },
    }

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": (
        "rest_framework_simplejwt.authentication.JWTAuthentication",
    ),
    "DEFAULT_PERMISSION_CLASSES": (
        "rest_framework.permissions.IsAuthenticated",
    ),
    "DEFAULT_PAGINATION_CLASS": "rest_framework.pagination.PageNumberPagination",
    "PAGE_SIZE": 50,
    "DEFAULT_THROTTLE_CLASSES": (
        "rest_framework.throttling.ScopedRateThrottle",
    ),
    "DEFAULT_THROTTLE_RATES": {
        "auth_login": env("AUTH_LOGIN_RATE", default="10/min"),
        "auth_refresh": env("AUTH_REFRESH_RATE", default="30/min"),
        "auth_social": env("AUTH_SOCIAL_RATE", default="20/min"),
        "auth_signup": env("AUTH_SIGNUP_RATE", default="10/hour"),
        "auth_password_reset": env("AUTH_PASSWORD_RESET_RATE", default="5/hour"),
        "public_api": env("PUBLIC_API_RATE", default="120/min"),
        "public_form": env("PUBLIC_FORM_RATE", default="60/min"),
        "public_widget": env("PUBLIC_WIDGET_RATE", default="120/min"),
        "integration_webhook": env("INTEGRATION_WEBHOOK_RATE", default="300/min"),
        "ai_assistant": env("AI_ASSISTANT_RATE", default="30/min"),
    },
}

SIMPLE_JWT = {
    "ROTATE_REFRESH_TOKENS": True,
    "BLACKLIST_AFTER_ROTATION": True,
    "UPDATE_LAST_LOGIN": True,
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=env.int("JWT_ACCESS_TOKEN_MINUTES", default=15)),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=env.int("JWT_REFRESH_TOKEN_DAYS", default=7)),
}

GOOGLE_OAUTH_CLIENT_IDS = env.list("GOOGLE_OAUTH_CLIENT_IDS", default=[])
APPLE_OAUTH_CLIENT_IDS = env.list("APPLE_OAUTH_CLIENT_IDS", default=[])
SOCIAL_AUTH_AUTO_CREATE_MERCHANT = env.bool("SOCIAL_AUTH_AUTO_CREATE_MERCHANT", default=True)

CELERY_BROKER_URL = env("REDIS_URL", default="redis://redis:6379/0")
CELERY_RESULT_BACKEND = CELERY_BROKER_URL
CELERY_TASK_DEFAULT_QUEUE = env("CELERY_TASK_DEFAULT_QUEUE")
CELERY_TASK_ROUTES = {
    "apps.integrations.*": {"queue": "integrations"},
    "apps.pricing.*": {"queue": "integrations"},
    "pricing.*": {"queue": "integrations"},
    "apps.automations.*": {"queue": "automations"},
    "apps.notifications.*": {"queue": "notifications"},
    "apps.ai_core.*": {"queue": "ai"},
    "apps.core.import_export*": {"queue": "reports_exports"},
}
CELERY_TASK_ACKS_LATE = env.bool("CELERY_TASK_ACKS_LATE", default=True)
CELERY_WORKER_PREFETCH_MULTIPLIER = env.int("CELERY_WORKER_PREFETCH_MULTIPLIER", default=1)
CELERY_TASK_ALWAYS_EAGER = env.bool("CELERY_TASK_ALWAYS_EAGER", default=False)
CELERY_TASK_STORE_EAGER_RESULT = env.bool("CELERY_TASK_STORE_EAGER_RESULT", default=False)
AUTOMATIONS_RUN_INLINE = env.bool("AUTOMATIONS_RUN_INLINE", default=True)
PAID_BETA_STAGING_SMOKE_GREEN = env.bool("PAID_BETA_STAGING_SMOKE_GREEN", default=False)
PAID_BETA_BROWSER_E2E_GREEN = env.bool("PAID_BETA_BROWSER_E2E_GREEN", default=False)
PAID_BETA_BACKUP_RESTORE_DRILL_DONE = env.bool("PAID_BETA_BACKUP_RESTORE_DRILL_DONE", default=False)
PAID_BETA_SUPPORT_GRANT_FLOW_TESTED = env.bool("PAID_BETA_SUPPORT_GRANT_FLOW_TESTED", default=False)

SECURE_SSL_REDIRECT = env.bool("SECURE_SSL_REDIRECT", default=IS_PRODUCTION_LIKE_ENVIRONMENT)
SESSION_COOKIE_SECURE = env.bool("SESSION_COOKIE_SECURE", default=IS_PRODUCTION_LIKE_ENVIRONMENT)
CSRF_COOKIE_SECURE = env.bool("CSRF_COOKIE_SECURE", default=IS_PRODUCTION_LIKE_ENVIRONMENT)
SECURE_PROXY_SSL_HEADER_VALUE = env("SECURE_PROXY_SSL_HEADER", default="")
SECURE_PROXY_SSL_HEADER = (
    tuple(SECURE_PROXY_SSL_HEADER_VALUE.split(",", 1))
    if SECURE_PROXY_SSL_HEADER_VALUE
    else None
)
SECURE_HSTS_SECONDS = env.int("SECURE_HSTS_SECONDS", default=0 if DEBUG else 31536000)
SECURE_HSTS_INCLUDE_SUBDOMAINS = env.bool("SECURE_HSTS_INCLUDE_SUBDOMAINS", default=not DEBUG)
SECURE_HSTS_PRELOAD = env.bool("SECURE_HSTS_PRELOAD", default=not DEBUG)

SUPPORT_REQUIRES_GRANT = env.bool("SUPPORT_REQUIRES_GRANT", default=IS_PRODUCTION_LIKE_ENVIRONMENT)
AUDIT_LOG_RETENTION_DAYS = env("AUDIT_LOG_RETENTION_DAYS")

SENTRY_DSN = env("SENTRY_DSN", default="")
RELEASE = env("RELEASE", default="local")
SENTRY_TRACES_SAMPLE_RATE = env.float("SENTRY_TRACES_SAMPLE_RATE", default=0.05)

TELEGRAM_ENABLED = env.bool("TELEGRAM_ENABLED", default=False)
TELEGRAM_BASE_API_URL = env("TELEGRAM_BASE_API_URL", default="https://api.telegram.org")
TELEGRAM_WEBHOOK_SECRET = env("TELEGRAM_WEBHOOK_SECRET", default="")
WHATSAPP_ENABLED = env.bool("WHATSAPP_ENABLED", default=False)
WHATSAPP_GRAPH_API_VERSION = env("WHATSAPP_GRAPH_API_VERSION", default="v25.0")
WHATSAPP_GRAPH_BASE_URL = env("WHATSAPP_GRAPH_BASE_URL", default="https://graph.facebook.com")
WHATSAPP_VERIFY_TOKEN = env("WHATSAPP_VERIFY_TOKEN", default="")
WHATSAPP_APP_SECRET = env("WHATSAPP_APP_SECRET", default="")
META_APP_ID = env("META_APP_ID", default="")
META_APP_SECRET = env("META_APP_SECRET", default="")
WHATSAPP_EMBEDDED_SIGNUP_CONFIG_ID = env("WHATSAPP_EMBEDDED_SIGNUP_CONFIG_ID", default="")
WHATSAPP_EMBEDDED_SIGNUP_LOGIN_URL = env("WHATSAPP_EMBEDDED_SIGNUP_LOGIN_URL", default="https://www.facebook.com/dialog/oauth")
INSTAGRAM_ENABLED = env.bool("INSTAGRAM_ENABLED", default=False)
INSTAGRAM_GRAPH_API_VERSION = env("INSTAGRAM_GRAPH_API_VERSION", default="v25.0")
INSTAGRAM_GRAPH_BASE_URL = env("INSTAGRAM_GRAPH_BASE_URL", default="https://graph.facebook.com")
INSTAGRAM_VERIFY_TOKEN = env("INSTAGRAM_VERIFY_TOKEN", default="")
INSTAGRAM_APP_SECRET = env("INSTAGRAM_APP_SECRET", default=META_APP_SECRET)
KASPI_ENABLED = env.bool("KASPI_ENABLED", default=False)
KASPI_API_BASE_URL = env("KASPI_API_BASE_URL", default="https://kaspi.kz/shop/api/v2")
KASPI_REPRICING_ENABLED = env.bool("KASPI_REPRICING_ENABLED", default=False)
KASPI_REPRICING_WRITE_ENABLED = env.bool("KASPI_REPRICING_WRITE_ENABLED", default=False)
KASPI_REPRICING_SCHEDULE_ENABLED = env.bool("KASPI_REPRICING_SCHEDULE_ENABLED", default=False)
KASPI_REPRICING_INTERVAL_SECONDS = env.int("KASPI_REPRICING_INTERVAL_SECONDS", default=1800)
KASPI_REPRICING_APPLY_AUTOPILOT = env.bool("KASPI_REPRICING_APPLY_AUTOPILOT", default=False)
KASPI_PRICE_WRITE_PROVIDER = env("KASPI_PRICE_WRITE_PROVIDER", default="price_feed")
KASPI_PRICE_WRITE_API_URL = env("KASPI_PRICE_WRITE_API_URL", default="")
KASPI_PRICE_WRITE_API_KEY = env("KASPI_PRICE_WRITE_API_KEY", default="")
KASPI_COMPETITOR_MONITOR_PROVIDER = env("KASPI_COMPETITOR_MONITOR_PROVIDER", default="mock")
KASPI_COMPETITOR_MONITOR_API_URL = env("KASPI_COMPETITOR_MONITOR_API_URL", default="")
KASPI_COMPETITOR_MONITOR_API_KEY = env("KASPI_COMPETITOR_MONITOR_API_KEY", default="")
CELERY_BEAT_SCHEDULE = {}
if KASPI_REPRICING_SCHEDULE_ENABLED:
    CELERY_BEAT_SCHEDULE["kaspi-pricing-cycle"] = {
        "task": "pricing.run_kaspi_pricing_cycle",
        "schedule": KASPI_REPRICING_INTERVAL_SECONDS,
        "kwargs": {"apply_autopilot": KASPI_REPRICING_APPLY_AUTOPILOT},
    }
MOYSKLAD_ENABLED = env.bool("MOYSKLAD_ENABLED", default=False)
MOYSKLAD_API_BASE_URL = env("MOYSKLAD_API_BASE_URL", default="https://api.moysklad.ru/api/remap/1.2")
WILDBERRIES_ENABLED = env.bool("WILDBERRIES_ENABLED", default=False)
WILDBERRIES_STATISTICS_API_BASE_URL = env("WILDBERRIES_STATISTICS_API_BASE_URL", default="https://statistics-api.wildberries.ru")
OZON_ENABLED = env.bool("OZON_ENABLED", default=False)
OZON_SELLER_API_BASE_URL = env("OZON_SELLER_API_BASE_URL", default="https://api-seller.ozon.ru")

OPENAI_API_KEY = env("OPENAI_API_KEY", default="")
OPENAI_BASE_URL = env("OPENAI_BASE_URL", default="https://api.openai.com/v1")
OPENAI_MODEL = env("OPENAI_MODEL", default="gpt-4.1-mini")
OPENAI_TEMPERATURE = env.float("OPENAI_TEMPERATURE", default=0.4)
OPENROUTER_API_KEY = env("OPENROUTER_API_KEY", default="")
OPENROUTER_BASE_URL = env("OPENROUTER_BASE_URL", default="https://openrouter.ai/api/v1")
OPENROUTER_SITE_URL = env("OPENROUTER_SITE_URL", default="")
OPENROUTER_APP_NAME = env("OPENROUTER_APP_NAME", default="ZANI")
KIMI_API_KEY = env("KIMI_API_KEY", default="")
KIMI_BASE_URL = env("KIMI_BASE_URL", default="https://api.moonshot.ai/v1")

_AI_PROVIDER_DEFAULT = "mock"
if OPENROUTER_API_KEY:
    _AI_PROVIDER_DEFAULT = "openrouter"
elif OPENAI_API_KEY:
    _AI_PROVIDER_DEFAULT = "openai"

AI_ENABLED = env.bool("AI_ENABLED", default=True)
AI_PROVIDER = env("AI_PROVIDER", default=_AI_PROVIDER_DEFAULT).lower()
AI_MODEL = env("AI_MODEL", default="")
if not AI_MODEL:
    AI_MODEL = {
        "kimi": "kimi-k2.6",
        "openrouter": "openrouter/auto",
        "openai": OPENAI_MODEL,
    }.get(AI_PROVIDER, "mock-ai")
AI_FAST_MODEL = env("AI_FAST_MODEL", default=AI_MODEL)
AI_SMART_MODEL = env("AI_SMART_MODEL", default=AI_MODEL)
AI_CHEAP_MODEL = env("AI_CHEAP_MODEL", default=AI_FAST_MODEL)
AI_DEFAULT_MODEL_TIER = env("AI_DEFAULT_MODEL_TIER", default="smart")
AI_PROMPT_MODEL_TIERS = env(
    "AI_PROMPT_MODEL_TIERS",
    default=json.dumps(
        {
            "crm_assistant": "smart",
            "lead_reply": "fast",
            "client_summary": "smart",
            "daily_summary": "smart",
            "notification_summary": "cheap",
        }
    ),
)
AI_TEMPERATURE = env.float("AI_TEMPERATURE", default=OPENAI_TEMPERATURE)
AI_HTTP_TIMEOUT_SECONDS = env.int("AI_HTTP_TIMEOUT_SECONDS", default=20)

EMAIL_BACKEND = env("EMAIL_BACKEND", default="django.core.mail.backends.smtp.EmailBackend")
EMAIL_HOST = env("EMAIL_HOST", default="")
EMAIL_PORT = env.int("EMAIL_PORT", default=587)
EMAIL_HOST_USER = env("EMAIL_HOST_USER", default="")
EMAIL_HOST_PASSWORD = env("EMAIL_HOST_PASSWORD", default="")
EMAIL_USE_TLS = env.bool("EMAIL_USE_TLS", default=True)
DEFAULT_FROM_EMAIL = env("DEFAULT_FROM_EMAIL", default="Zani <no-reply@zani.local>")

_argv = __import__("sys").argv
if "test" in _argv or any("pytest" in arg for arg in _argv):
    OPENAI_API_KEY = ""
    OPENROUTER_API_KEY = ""
    KIMI_API_KEY = ""
    AI_PROVIDER = "mock"
    CELERY_BROKER_URL = "memory://"
    CELERY_RESULT_BACKEND = "cache+memory://"
    CELERY_TASK_ALWAYS_EAGER = True
    CELERY_TASK_STORE_EAGER_RESULT = False
    TELEGRAM_ENABLED = False
    WHATSAPP_ENABLED = False
    INSTAGRAM_ENABLED = False
    EMAIL_BACKEND = "django.core.mail.backends.locmem.EmailBackend"

if SENTRY_DSN:
    import sentry_sdk

    sentry_sdk.init(
        dsn=SENTRY_DSN,
        environment=ENVIRONMENT,
        release=RELEASE,
        traces_sample_rate=SENTRY_TRACES_SAMPLE_RATE,
        send_default_pii=False,
    )

LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "console": {
            "format": "%(asctime)s %(levelname)s %(name)s %(message)s",
        },
    },
    "handlers": {
        "console": {
            "class": "logging.StreamHandler",
            "formatter": "console",
        },
    },
    "root": {
        "handlers": ["console"],
        "level": env("LOG_LEVEL"),
    },
    "loggers": {
        "django.server": {
            "handlers": ["console"],
            "level": env("LOG_LEVEL"),
            "propagate": False,
        },
    },
}
