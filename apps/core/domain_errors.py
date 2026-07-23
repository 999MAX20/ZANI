from rest_framework.exceptions import APIException


class DomainAPIException(APIException):
    error_code = "request_failed"
    default_code = "request_failed"

    def __init__(self, detail=None, *, errors=None):
        super().__init__(detail=detail, code=self.error_code)
        self.errors = errors or {}


class InvalidTransition(DomainAPIException):
    status_code = 409
    error_code = "invalid_transition"
    default_code = error_code
    default_detail = "This action is not available in the current state."


class ScheduleConflict(DomainAPIException):
    status_code = 409
    error_code = "schedule_conflict"
    default_code = error_code
    default_detail = "The requested appointment time is not available."


class AssigneeUnavailable(DomainAPIException):
    status_code = 409
    error_code = "assignee_unavailable"
    default_code = error_code
    default_detail = "The selected assignee is currently unavailable."


class ModuleDisabled(DomainAPIException):
    status_code = 403
    error_code = "module_disabled"
    default_code = error_code
    default_detail = "This module is disabled for the business."


class IdempotencyConflict(DomainAPIException):
    status_code = 409
    error_code = "idempotency_conflict"
    default_code = error_code
    default_detail = "This command is already being processed."


class ProviderUnavailable(DomainAPIException):
    status_code = 503
    error_code = "provider_unavailable"
    default_code = error_code
    default_detail = "The external provider is currently unavailable."


class TemporaryServiceFailure(DomainAPIException):
    status_code = 503
    error_code = "temporary_service_failure"
    default_code = error_code
    default_detail = "The service is temporarily unavailable. Please try again."
