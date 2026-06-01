import { Suspense, lazy } from "react";
import { Navigate, RouterProvider, createBrowserRouter } from "react-router-dom";

import { AppLayout } from "../components/layout/AppLayout";
import { PlatformLayout } from "../components/layout/PlatformLayout";
import { PermissionGate } from "../components/auth/PermissionGate";
import { RouteErrorBoundary } from "../components/ui/RouteErrorBoundary";
import { ForbiddenState, LoadingState } from "../components/ui/StateViews";
import { useAuth } from "../features/auth/AuthProvider";
import { LoginPage } from "../features/auth/LoginPage";
import { PlatformPlaceholderPage, platformPages } from "../features/platform/PlatformPlaceholderPage";
import { NotFoundPage } from "../features/pilot/NotFoundPage";
import { PublicLayout } from "../features/public/PublicLayout";
import { PublicBotsPage, PublicContactsPage, PublicCrmPage, PublicHomePage, PublicPricingPage } from "../features/public/PublicPages";
import { useActiveBusiness } from "../hooks/useBusiness";
import { useI18n } from "../lib/i18n";
import { permissionForbiddenMessage } from "../lib/permissions";

const InviteAcceptPage = lazy(() => import("../features/auth/InviteAcceptPage").then((module) => ({ default: module.InviteAcceptPage })));
const SignupPage = lazy(() => import("../features/auth/SignupPage").then((module) => ({ default: module.SignupPage })));
const ForgotPasswordPage = lazy(() => import("../features/auth/ForgotPasswordPage").then((module) => ({ default: module.ForgotPasswordPage })));
const ResetPasswordPage = lazy(() => import("../features/auth/ResetPasswordPage").then((module) => ({ default: module.ResetPasswordPage })));
const DashboardPage = lazy(() => import("../features/dashboard/DashboardPage").then((module) => ({ default: module.DashboardPage })));
const LeadsPage = lazy(() => import("../features/leads/LeadsPage").then((module) => ({ default: module.LeadsPage })));
const DealsPage = lazy(() => import("../features/deals/DealsPage").then((module) => ({ default: module.DealsPage })));
const ClientsPage = lazy(() => import("../features/clients/ClientsPage").then((module) => ({ default: module.ClientsPage })));
const TasksPage = lazy(() => import("../features/tasks/TasksPage").then((module) => ({ default: module.TasksPage })));
const AppointmentsPage = lazy(() => import("../features/appointments/AppointmentsPage").then((module) => ({ default: module.AppointmentsPage })));
const CalendarPage = lazy(() => import("../features/calendar/CalendarPage").then((module) => ({ default: module.CalendarPage })));
const ConversationsPage = lazy(() => import("../features/conversations/ConversationsPage").then((module) => ({ default: module.ConversationsPage })));
const TimelinePage = lazy(() => import("../features/timeline/TimelinePage").then((module) => ({ default: module.TimelinePage })));
const BotsPage = lazy(() => import("../features/bots/BotsPage").then((module) => ({ default: module.BotsPage })));
const BotDetailPage = lazy(() => import("../features/bots/BotDetailPage").then((module) => ({ default: module.BotDetailPage })));
const IntegrationsPage = lazy(() => import("../features/integrations/IntegrationsPage").then((module) => ({ default: module.IntegrationsPage })));
const PricingPage = lazy(() => import("../features/pricing/PricingPage").then((module) => ({ default: module.PricingPage })));
const AIAssistantPage = lazy(() => import("../features/assistant/AIAssistantPage").then((module) => ({ default: module.AIAssistantPage })));
const AIAgentsPage = lazy(() => import("../features/assistant/AIAgentsPage").then((module) => ({ default: module.AIAgentsPage })));
const AutomationsPage = lazy(() => import("../features/automations/AutomationsPage").then((module) => ({ default: module.AutomationsPage })));
const OutreachPage = lazy(() => import("../features/outreach/OutreachPage").then((module) => ({ default: module.OutreachPage })));
const ResourcesPage = lazy(() => import("../features/resources/ResourcesPage").then((module) => ({ default: module.ResourcesPage })));
const ServicesPage = lazy(() => import("../features/services/ServicesPage").then((module) => ({ default: module.ServicesPage })));
const AnalyticsPage = lazy(() => import("../features/analytics/AnalyticsPage").then((module) => ({ default: module.AnalyticsPage })));
const SettingsPage = lazy(() => import("../features/settings/SettingsPage").then((module) => ({ default: module.SettingsPage })));
const WorkingHoursPage = lazy(() => import("../features/settings/WorkingHoursPage").then((module) => ({ default: module.WorkingHoursPage })));
const OnboardingPage = lazy(() => import("../features/onboarding/OnboardingPage").then((module) => ({ default: module.OnboardingPage })));
const PilotReadinessPage = lazy(() => import("../features/pilot/PilotReadinessPage").then((module) => ({ default: module.PilotReadinessPage })));
const PlatformOverviewPage = lazy(() => import("../features/platform/PlatformOverviewPage").then((module) => ({ default: module.PlatformOverviewPage })));
const PlatformOperationsPage = lazy(() => import("../features/platform/PlatformOperationsPage").then((module) => ({ default: module.PlatformOperationsPage })));
const PlatformMerchantsPage = lazy(() => import("../features/platform/PlatformMerchantsPage").then((module) => ({ default: module.PlatformMerchantsPage })));
const PlatformMerchantDetailPage = lazy(() => import("../features/platform/PlatformMerchantDetailPage").then((module) => ({ default: module.PlatformMerchantDetailPage })));

function MerchantRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading, isMerchantUser, isPlatformUser } = useAuth();
  const { t } = useI18n();
  if (isLoading) return <LoadingState label={t("common.loadingAccess")} />;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (!isMerchantUser && isPlatformUser) return <Navigate to="/platform" replace />;
  return isMerchantUser ? children : <Navigate to="/login" replace />;
}

function PlatformRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading, isPlatformUser } = useAuth();
  const { t } = useI18n();
  if (isLoading) return <LoadingState label={t("common.loadingAccess")} />;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return isPlatformUser ? children : <Navigate to="/dashboard" replace />;
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading, isPlatformUser } = useAuth();
  const { t } = useI18n();
  if (isLoading) return <LoadingState label={t("common.loadingAccess")} />;
  if (!isAuthenticated) return children;
  return <Navigate to={isPlatformUser ? "/platform" : "/dashboard"} replace />;
}

function PageLoader({ children }: { children: React.ReactNode }) {
  const { t } = useI18n();
  return <Suspense fallback={<LoadingState label={t("common.loadingWorkspace")} />}>{children}</Suspense>;
}

function PermissionRoute({
  resource,
  action = "view",
  children,
}: {
  resource?: string;
  action?: string;
  children: React.ReactNode;
}) {
  const { user } = useAuth();
  const { t } = useI18n();
  const { business, isLoading } = useActiveBusiness();
  if (!resource) return children;
  if (isLoading) return <LoadingState label={t("common.checkingAccess")} />;
  if (!user || !business?.id) return <ForbiddenState message={permissionForbiddenMessage(resource, action, t)} />;
  return (
    <PermissionGate resource={resource} action={action} mode="forbidden">
      {children}
    </PermissionGate>
  );
}

const merchantChildren = [
  { index: true, element: <PageLoader><DashboardPage /></PageLoader> },
  { path: "leads", resource: "leads", element: <PageLoader><LeadsPage /></PageLoader> },
  { path: "deals", resource: "deals", element: <PageLoader><DealsPage /></PageLoader> },
  { path: "clients", resource: "clients", element: <PageLoader><ClientsPage /></PageLoader> },
  { path: "tasks", resource: "tasks", element: <PageLoader><TasksPage /></PageLoader> },
  { path: "appointments", resource: "appointments", element: <PageLoader><AppointmentsPage /></PageLoader> },
  { path: "calendar", resource: "appointments", element: <PageLoader><CalendarPage /></PageLoader> },
  { path: "conversations", resource: "conversations", element: <PageLoader><ConversationsPage /></PageLoader> },
  { path: "timeline", resource: "analytics", element: <PageLoader><TimelinePage /></PageLoader> },
  { path: "bots", resource: "integrations", element: <PageLoader><BotsPage /></PageLoader> },
  { path: "bots/:id", resource: "integrations", element: <PageLoader><BotDetailPage /></PageLoader> },
  { path: "integrations", resource: "integrations", element: <PageLoader><IntegrationsPage /></PageLoader> },
  { path: "pricing", resource: "integrations", element: <PageLoader><PricingPage /></PageLoader> },
  { path: "ai-assistant", resource: "ai_assistant", element: <PageLoader><AIAssistantPage /></PageLoader> },
  { path: "ai", resource: "ai_assistant", element: <Navigate to="/dashboard/ai-assistant" replace /> },
  { path: "assistant", resource: "ai_assistant", element: <PageLoader><AIAssistantPage /></PageLoader> },
  { path: "inbox", resource: "conversations", element: <PageLoader><ConversationsPage /></PageLoader> },
  { path: "ai-agents", resource: "ai_automation", element: <PageLoader><AIAgentsPage /></PageLoader> },
  { path: "ai-agents/:id", resource: "ai_automation", element: <PageLoader><AIAgentsPage /></PageLoader> },
  { path: "ai-agents/:id/:section", resource: "ai_automation", element: <PageLoader><AIAgentsPage /></PageLoader> },
  { path: "automations", resource: "automations", element: <PageLoader><AutomationsPage /></PageLoader> },
  { path: "outreach", resource: "notifications", element: <PageLoader><OutreachPage /></PageLoader> },
  { path: "services", resource: "settings", element: <PageLoader><ServicesPage /></PageLoader> },
  { path: "resources", resource: "settings", element: <PageLoader><ResourcesPage /></PageLoader> },
  { path: "working-hours", resource: "settings", element: <PageLoader><WorkingHoursPage /></PageLoader> },
  { path: "analytics", resource: "analytics", element: <PageLoader><AnalyticsPage /></PageLoader> },
  { path: "onboarding", resource: "settings", element: <PageLoader><OnboardingPage /></PageLoader> },
  { path: "pilot-readiness", resource: "settings", element: <PageLoader><PilotReadinessPage /></PageLoader> },
  { path: "settings", resource: "settings", element: <PageLoader><SettingsPage /></PageLoader> },
  { path: "billing", resource: "settings", element: <Navigate to="/dashboard/settings#billing" replace /> },
];

const legacyMerchantRoutes = [
  { path: "/leads", resource: "leads", element: <PageLoader><LeadsPage /></PageLoader> },
  { path: "/deals", resource: "deals", element: <PageLoader><DealsPage /></PageLoader> },
  { path: "/clients", resource: "clients", element: <PageLoader><ClientsPage /></PageLoader> },
  { path: "/tasks", resource: "tasks", element: <PageLoader><TasksPage /></PageLoader> },
  { path: "/appointments", resource: "appointments", element: <PageLoader><AppointmentsPage /></PageLoader> },
  { path: "/calendar", resource: "appointments", element: <PageLoader><CalendarPage /></PageLoader> },
  { path: "/conversations", resource: "conversations", element: <PageLoader><ConversationsPage /></PageLoader> },
  { path: "/timeline", resource: "analytics", element: <PageLoader><TimelinePage /></PageLoader> },
  { path: "/crm-bots", resource: "integrations", element: <PageLoader><BotsPage /></PageLoader> },
  { path: "/integrations", resource: "integrations", element: <PageLoader><IntegrationsPage /></PageLoader> },
  { path: "/ai-assistant", resource: "conversations", element: <PageLoader><AIAssistantPage /></PageLoader> },
  { path: "/ai", resource: "conversations", element: <Navigate to="/dashboard/ai-assistant" replace /> },
  { path: "/assistant", resource: "conversations", element: <PageLoader><AIAssistantPage /></PageLoader> },
  { path: "/inbox", resource: "conversations", element: <PageLoader><ConversationsPage /></PageLoader> },
  { path: "/ai-agents", resource: "integrations", element: <PageLoader><AIAgentsPage /></PageLoader> },
  { path: "/automations", resource: "automations", element: <PageLoader><AutomationsPage /></PageLoader> },
  { path: "/outreach", resource: "notifications", element: <PageLoader><OutreachPage /></PageLoader> },
  { path: "/services", resource: "settings", element: <PageLoader><ServicesPage /></PageLoader> },
  { path: "/resources", resource: "settings", element: <PageLoader><ResourcesPage /></PageLoader> },
  { path: "/working-hours", resource: "settings", element: <PageLoader><WorkingHoursPage /></PageLoader> },
  { path: "/analytics", resource: "analytics", element: <PageLoader><AnalyticsPage /></PageLoader> },
  { path: "/onboarding", resource: "settings", element: <PageLoader><OnboardingPage /></PageLoader> },
  { path: "/pilot-readiness", resource: "settings", element: <PageLoader><PilotReadinessPage /></PageLoader> },
  { path: "/settings", resource: "settings", element: <PageLoader><SettingsPage /></PageLoader> },
  { path: "/billing", resource: "settings", element: <Navigate to="/dashboard/settings#billing" replace /> },
];

const router = createBrowserRouter([
  {
    path: "/",
    element: <PublicLayout />,
    errorElement: <RouteErrorBoundary />,
    children: [
      { index: true, element: <PublicHomePage /> },
      { path: "pricing", element: <PublicPricingPage /> },
      { path: "bots", element: <PublicBotsPage /> },
      { path: "crm", element: <PublicCrmPage /> },
      { path: "contacts", element: <PublicContactsPage /> },
    ],
  },
  {
    path: "/login",
    errorElement: <RouteErrorBoundary />,
    element: (
      <PublicRoute>
        <LoginPage />
      </PublicRoute>
    ),
  },
  {
    path: "/signup",
    errorElement: <RouteErrorBoundary />,
    element: (
      <PublicRoute>
        <PageLoader><SignupPage /></PageLoader>
      </PublicRoute>
    ),
  },
  {
    path: "/forgot-password",
    errorElement: <RouteErrorBoundary />,
    element: (
      <PublicRoute>
        <PageLoader><ForgotPasswordPage /></PageLoader>
      </PublicRoute>
    ),
  },
  {
    path: "/reset-password/:uid/:token",
    errorElement: <RouteErrorBoundary />,
    element: (
      <PublicRoute>
        <PageLoader><ResetPasswordPage /></PageLoader>
      </PublicRoute>
    ),
  },
  {
    path: "/invite/:token",
    errorElement: <RouteErrorBoundary />,
    element: (
      <PublicRoute>
        <PageLoader><InviteAcceptPage /></PageLoader>
      </PublicRoute>
    ),
  },
  {
    path: "/platform",
    errorElement: <RouteErrorBoundary />,
    element: (
      <PlatformRoute>
        <PlatformLayout />
      </PlatformRoute>
    ),
    children: [
      { index: true, element: <PageLoader><PlatformOverviewPage /></PageLoader> },
      { path: "operations", element: <PageLoader><PlatformOperationsPage /></PageLoader> },
      { path: "merchants", element: <PageLoader><PlatformMerchantsPage /></PageLoader> },
      { path: "merchants/:id", element: <PageLoader><PlatformMerchantDetailPage /></PageLoader> },
      { path: "prospects", element: <PlatformPlaceholderPage {...platformPages.prospects} /> },
      { path: "landings", element: <PlatformPlaceholderPage {...platformPages.landings} /> },
      { path: "outreach", element: <PlatformPlaceholderPage {...platformPages.outreach} /> },
      { path: "billing", element: <PlatformPlaceholderPage {...platformPages.billing} /> },
      { path: "analytics", element: <PlatformPlaceholderPage {...platformPages.analytics} /> },
      { path: "settings", element: <PlatformPlaceholderPage {...platformPages.settings} /> },
    ],
  },
  {
    path: "/dashboard",
    errorElement: <RouteErrorBoundary />,
    element: (
      <MerchantRoute>
        <AppLayout />
      </MerchantRoute>
    ),
    children: merchantChildren.map((route) => ({
      ...route,
      element: (
        <PermissionRoute resource={"resource" in route ? route.resource : undefined}>
          {route.element}
        </PermissionRoute>
      ),
    })),
  },
  ...legacyMerchantRoutes.map((route) => ({
    path: route.path,
    errorElement: <RouteErrorBoundary />,
    element: (
      <MerchantRoute>
        <AppLayout />
      </MerchantRoute>
    ),
    children: [
      {
        index: true,
        element: (
          <PermissionRoute resource={route.resource}>
            {route.element}
          </PermissionRoute>
        ),
      },
    ],
  })),
  { path: "*", element: <NotFoundPage />, errorElement: <RouteErrorBoundary /> },
]);

export function AppRouter() {
  return <RouterProvider router={router} />;
}
