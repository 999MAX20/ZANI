from django.conf import settings
from django.core.mail import send_mail


def email_is_configured():
    backend = settings.EMAIL_BACKEND
    if backend.endswith(".locmem.EmailBackend") or backend.endswith(".console.EmailBackend"):
        return True
    return bool(settings.EMAIL_HOST and settings.DEFAULT_FROM_EMAIL)


def send_email_smoke(to_email):
    return send_mail(
        subject=f"ZANI email smoke: {settings.ENVIRONMENT}/{settings.RELEASE}",
        message="This is a safe ZANI transactional email smoke message. It contains no merchant or customer data.",
        from_email=settings.DEFAULT_FROM_EMAIL,
        recipient_list=[to_email],
        fail_silently=False,
    )
