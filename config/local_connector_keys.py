import base64
import json
import os
import secrets
from pathlib import Path


LOCAL_KEY_ID = "local-machine-v1"


def load_or_create_local_connector_keyring():
    path = _local_key_path()
    if path.exists():
        return _read_keyring(path)

    path.parent.mkdir(parents=True, exist_ok=True)
    payload = {
        "key": base64.urlsafe_b64encode(secrets.token_bytes(32)).decode("ascii"),
        "key_id": LOCAL_KEY_ID,
    }
    serialized = json.dumps(payload, separators=(",", ":"))
    try:
        descriptor = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    except FileExistsError:
        return _read_keyring(path)
    with os.fdopen(descriptor, "w", encoding="utf-8", newline="\n") as target:
        target.write(serialized)
    try:
        path.chmod(0o600)
    except OSError:
        pass
    return {payload["key_id"]: payload["key"]}


def _read_keyring(path):
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
        key_id = str(payload["key_id"])
        key = str(payload["key"])
    except (OSError, KeyError, TypeError, ValueError):
        raise RuntimeError("The local connector credential key file is invalid.") from None
    return {key_id: key}


def _local_key_path():
    explicit_path = str(os.environ.get("CONNECTOR_CREDENTIAL_LOCAL_KEY_FILE", "") or "").strip()
    if explicit_path:
        return Path(explicit_path).expanduser().resolve()
    local_root = os.environ.get("LOCALAPPDATA")
    if local_root:
        return Path(local_root) / "Zani" / "connector-credential-key.json"
    return Path.home() / ".zani" / "connector-credential-key.json"
