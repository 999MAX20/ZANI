from unittest.mock import MagicMock, patch

from django.test import SimpleTestCase, override_settings
from rest_framework.exceptions import APIException, Throttled, ValidationError
from rest_framework.test import APIRequestFactory
from rest_framework.views import APIView

from apps.core.exceptions import SAFE_INTERNAL_DETAIL, api_exception_handler


class UnknownFailureView(APIView):
    authentication_classes = ()
    permission_classes = ()

    def get(self, request):
        raise RuntimeError("database_password=merchant-secret")


class SafeApiExceptionContractTests(SimpleTestCase):
    def setUp(self):
        self.factory = APIRequestFactory()

    def test_unknown_exception_renders_canonical_json_without_technical_details(self):
        request = self.factory.get("/api/test/unknown-failure/")
        request.correlation_id = "unknown-error-42"

        with self.assertLogs("zani.api", level="ERROR") as captured:
            response = UnknownFailureView.as_view()(request)
            response.render()

        self.assertEqual(response.status_code, 500)
        self.assertEqual(response["Content-Type"], "application/json")
        self.assertEqual(
            response.data,
            {
                "code": "internal_error",
                "request_id": "unknown-error-42",
                "detail": SAFE_INTERNAL_DETAIL,
                "errors": {},
                "category": "internal",
                "retryable": False,
                "retry_after_seconds": None,
            },
        )
        self.assertNotIn("merchant-secret", response.content.decode())
        self.assertNotIn("RuntimeError", response.content.decode())
        self.assertEqual(captured.records[0].request_id, "unknown-error-42")
        self.assertEqual(captured.records[0].path, "/api/test/unknown-failure/")
        self.assertIn("merchant-secret", "\n".join(captured.output))

    def test_drf_500_is_normalized_in_debug_and_production_modes(self):
        class UnsafeServerError(APIException):
            status_code = 500

        request = self.factory.get("/api/test/drf-500/")
        request.correlation_id = "drf-error-42"

        for debug in (True, False):
            with self.subTest(debug=debug), override_settings(DEBUG=debug):
                with self.assertLogs("zani.api", level="ERROR"):
                    response = api_exception_handler(
                        UnsafeServerError("SQL SELECT secret_token FROM credentials"),
                        {"request": request},
                    )

                self.assertEqual(response.status_code, 500)
                self.assertEqual(response.data["code"], "internal_error")
                self.assertEqual(response.data["detail"], SAFE_INTERNAL_DETAIL)
                self.assertEqual(response.data["errors"], {})
                self.assertNotIn("secret_token", str(response.data))

    @override_settings(SENTRY_DSN="https://public@example.invalid/1")
    def test_configured_sentry_receives_exception_and_request_id(self):
        request = self.factory.get("/api/test/sentry-failure/")
        request.correlation_id = "sentry-error-42"
        exception = RuntimeError("provider response retained server-side")
        scope = MagicMock()
        scope_manager = MagicMock()
        scope_manager.__enter__.return_value = scope

        with (
            patch("sentry_sdk.new_scope", return_value=scope_manager),
            patch("sentry_sdk.capture_exception") as capture_exception,
            self.assertLogs("zani.api", level="ERROR"),
        ):
            response = api_exception_handler(exception, {"request": request})

        self.assertEqual(response.status_code, 500)
        capture_exception.assert_called_once_with(exception)
        scope.set_tag.assert_any_call("request_id", "sentry-error-42")
        scope.set_tag.assert_any_call("error_code", "internal_error")
        scope.set_context.assert_called_once_with(
            "zani_request",
            {
                "request_id": "sentry-error-42",
                "method": "GET",
                "path": "/api/test/sentry-failure/",
            },
        )

    def test_known_validation_error_keeps_existing_contract(self):
        request = self.factory.post("/api/test/validation/", {}, format="json")
        request.correlation_id = "validation-error-42"

        response = api_exception_handler(
            ValidationError({"name": ["This field is required."]}),
            {"request": request},
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data["code"], "validation_error")
        self.assertEqual(response.data["request_id"], "validation-error-42")
        self.assertEqual(response.data["detail"], "Validation failed.")
        self.assertEqual(response.data["errors"], {"name": ["This field is required."]})
        self.assertEqual(response.data["category"], "validation")
        self.assertFalse(response.data["retryable"])
        self.assertIsNone(response.data["retry_after_seconds"])

    def test_validation_errors_redact_credentials_without_losing_field_feedback(self):
        request = self.factory.post("/api/test/validation/", {}, format="json")
        request.correlation_id = "redaction-error-42"

        response = api_exception_handler(
            ValidationError(
                {
                    "email": ["Enter a valid email."],
                    "token": "raw-provider-token",
                    "notes": "Authorization: Bearer raw-bearer-token",
                }
            ),
            {"request": request},
        )

        self.assertEqual(response.data["errors"]["email"], ["Enter a valid email."])
        self.assertEqual(response.data["errors"]["token"], "[redacted]")
        self.assertNotIn("raw-bearer-token", str(response.data))

    def test_throttled_error_is_retryable_and_exposes_bounded_retry_delay(self):
        request = self.factory.get("/api/test/throttled/")
        request.correlation_id = "throttled-error-42"

        response = api_exception_handler(Throttled(wait=2.1), {"request": request})

        self.assertEqual(response.status_code, 429)
        self.assertEqual(response.data["code"], "rate_limited")
        self.assertEqual(response.data["category"], "rate_limit")
        self.assertTrue(response.data["retryable"])
        self.assertEqual(response.data["retry_after_seconds"], 3)

    def test_non_validation_api_error_drops_unapproved_payload_keys(self):
        class UnsafeClientError(APIException):
            status_code = 400
            default_detail = "Request failed."

        request = self.factory.get("/api/test/client-error/")
        request.correlation_id = "client-error-42"
        exception = UnsafeClientError()
        exception.detail = {
            "detail": "database_password=merchant-secret",
            "debug_context": "internal stack marker",
        }

        response = api_exception_handler(exception, {"request": request})

        self.assertEqual(response.data["detail"], "Request could not be processed.")
        self.assertEqual(response.data["errors"], {})
        self.assertNotIn("merchant-secret", str(response.data))
        self.assertNotIn("debug_context", response.data)
