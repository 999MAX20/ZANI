from django.core.cache import cache
from django.test import TestCase
from rest_framework.test import APIClient

from apps.accounts.auth_views import ThrottledTokenObtainPairView, ThrottledTokenRefreshView
from apps.accounts.models import User


class AuthSecurityBaselineTests(TestCase):
    def setUp(self):
        cache.clear()
        self.api = APIClient()
        self.user = User.objects.create_user(
            username="auth-user",
            email="auth-user@example.com",
            password="StrongPass123",
            role=User.Roles.BUSINESS_OWNER,
        )

    def tearDown(self):
        cache.clear()

    def test_auth_views_have_scoped_throttles(self):
        self.assertEqual(ThrottledTokenObtainPairView.throttle_scope, "auth_login")
        self.assertEqual(ThrottledTokenRefreshView.throttle_scope, "auth_refresh")

    def test_login_and_rotating_refresh_flow_works(self):
        login_response = self.api.post(
            "/api/auth/token/",
            {"email": self.user.email, "password": "StrongPass123"},
            format="json",
        )

        self.assertEqual(login_response.status_code, 200)
        self.assertIn("access", login_response.data)
        self.assertIn("refresh", login_response.data)

        old_refresh = login_response.data["refresh"]
        refresh_response = self.api.post(
            "/api/auth/token/refresh/",
            {"refresh": old_refresh},
            format="json",
        )

        self.assertEqual(refresh_response.status_code, 200)
        self.assertIn("access", refresh_response.data)
        self.assertIn("refresh", refresh_response.data)
        self.assertNotEqual(refresh_response.data["refresh"], old_refresh)

        reused_refresh_response = self.api.post(
            "/api/auth/token/refresh/",
            {"refresh": old_refresh},
            format="json",
        )

        self.assertEqual(reused_refresh_response.status_code, 401)

    def test_login_endpoint_is_throttled(self):
        for _ in range(10):
            response = self.api.post(
                "/api/auth/token/",
                {"email": self.user.email, "password": "wrong"},
                format="json",
            )
            self.assertEqual(response.status_code, 401)

        throttled_response = self.api.post(
            "/api/auth/token/",
            {"email": self.user.email, "password": "wrong"},
            format="json",
        )

        self.assertEqual(throttled_response.status_code, 429)
