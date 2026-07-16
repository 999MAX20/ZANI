from uuid import uuid4


REQUEST_ID_HEADER = "X-Request-ID"


class RequestIdMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        request_id = _clean_request_id(request.headers.get(REQUEST_ID_HEADER)) or uuid4().hex
        request.request_id = request_id
        response = self.get_response(request)
        response[REQUEST_ID_HEADER] = request_id
        return response


def _clean_request_id(value):
    value = str(value or "").strip()
    if not value:
        return ""
    return value[:96]
