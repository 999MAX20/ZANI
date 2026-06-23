import re


def normalize_phone(phone):
    digits = re.sub(r"\D+", "", phone or "")
    if len(digits) == 11 and digits.startswith("8"):
        digits = f"7{digits[1:]}"
    return digits


def normalize_email(email):
    return (email or "").strip().lower()


def normalize_client_identity(*, phone="", email=""):
    return {
        "normalized_phone": normalize_phone(phone),
        "normalized_email": normalize_email(email),
    }
