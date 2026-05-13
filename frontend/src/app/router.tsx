import { Suspense, lazy } from "react";
import { Navigate, RouterProvider, createBrowserRouter } from "react-router-dom";

import { AppLayout } from "../components/layout/AppLayout";
import { PlatformLayout } from "../components/layout/PlatformLayout";
import { LoadingState } from "../components/ui/StateViews";
import { useAuth } from "../features/auth/AuthProvider";
import { LoginPage } from "../features/auth/LoginPage";
import { PlatformPlaceholderPage, platformPages } from "../features/platform/PlatformPlaceholderPage";
import { PublicLayout } from "../features/public/PublicLayout";
import { PublicBotsPage, PublicContactsPage, PublicCrmPage, PublicHomePage, PublicPricingPage } from "../features/public/PublicPages";
import { useI18n } from "../lib/i18n";

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
const AIAssistantPage = lazy(() => import("../features/assistant/AIAssistantPage").then((module) => ({ default: module.AIAssistantPage })));
const AIAgentsPage = lazy(() => import("../features/assistant/AIAgentsPage").then((module) => ({ default: module.AIAgentsPage })));
const AutomationsPage = lazy(() => import("../features/automations/AutomationsPage").then((module) => ({ default: module.AutomationsPage })));
const ResourcesPage = lazy(() => import("../features/resources/ResourcesPage").then((module) => ({ default: module.ResourcesPage })));
const ServicesPage = lazy(() => import("../features/services/ServicesPage").then((module) => ({ default: module.ServicesPage })));
const AnalyticsPage = lazy(() => import("../features/analytics/AnalyticsPage").then((module) => ({ default: module.AnalyticsPage })));
const SettingsPage = lazy(() => import("../features/settings/SettingsPage").then((module) => ({ default: module.SettingsPage })));
const WorkingHoursPage = lazy(() => import("../features/settings/WorkingHoursPage").then((module) => ({ default: module.WorkingHoursPage })));
const PlatformOverviewPage = lazy(() => import("../features/platform/PlatformOverviewPage").then((module) => ({ default: module.PlatformOverviewPage })));
const PlatformMerchantsPage = lazy(() => import("../features/platform/PlatformMerchantsPage").then((module) => ({ default: module.PlatformMerchantsPage })));

function MerchantRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading, isMerchantUser, isPlatformUser } = useAuth();
  if (isLoading) return <LoadingState label="Загружаем доступ..." />;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (!isMerchantUser && isPlatformUser) return <Navigate to="/platform" replace />;
  return isMerchantUser ? children : <Navigate to="/login" replace />;
}

function PlatformRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading, isPlatformUser } = useAuth();
  if (isLoading) return <LoadingState label="Загружаем доступ..." />;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return isPlatformUser ? children : <Navigate to="/dashboard" replace />;
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading, isPlatformUser } = useAuth();
  if (isLoading) return <LoadingState label="Загружаем доступ..." />;
  if (!isAuthenticated) return children;
  return <Navigate to={isPlatformUser ? "/platform" : "/dashboard"} replace />;
}

function PageLoader({ children }: { children: React.ReactNode }) {
  const { t } = useI18n();
  return <Suspense fallback={<LoadingState label={t("common.loadingWorkspace")} />}>{children}</Suspense>;
}

const merchantChildren = [
  { index: true, element: <PageLoader><DashboardPage /></PageLoader> },
  { path: "leads", element: <PageLoader><LeadsPage /></PageLoader> },
  { path: "deals", element: <PageLoader><DealsPage /></PageLoader> },
  { path: "clients", element: <PageLoader><ClientsPage /></PageLoader> },
  { path: "tasks", element: <PageLoader><TasksPage /></PageLoader> },
  { path: "appointments", element: <PageLoader><AppointmentsPage /></PageLoader> },
  { path: "calendar", element: <PageLoader><CalendarPage /></PageLoader> },
  { path: "conversations", element: <PageLoader><ConversationsPage /></PageLoader> },
  { path: "timeline", element: <PageLoader><TimelinePage /></PageLoader> },
  { path: "bots", element: <PageLoader><BotsPage /></PageLoader> },
  { path: "bots/:id", element: <PageLoader><BotDetailPage /></PageLoader> },
  { path: "ai-assistant", element: <PageLoader><AIAssistantPage /></PageLoader> },
  { path: "ai-agents", element: <PageLoader><AIAgentsPage /></PageLoader> },
  { path: "automations", element: <PageLoader><AutomationsPage /></PageLoader> },
  { path: "services", element: <PageLoader><ServicesPage /></PageLoader> },
  { path: "resources", element: <PageLoader><ResourcesPage /></PageLoader> },
  { path: "working-hours", element: <PageLoader><WorkingHoursPage /></PageLoader> },
  { path: "analytics", element: <PageLoader><AnalyticsPage /></PageLoader> },
  { path: "settings", element: <PageLoader><SettingsPage /></PageLoader> },
];

const legacyMerchantRoutes = [
  { path: "/leads", element: <PageLoader><LeadsPage /></PageLoader> },
  { path: "/deals", element: <PageLoader><DealsPage /></PageLoader> },
  { path: "/clients", element: <PageLoader><ClientsPage /></PageLoader> },
  { path: "/tasks", element: <PageLoader><TasksPage /></PageLoader> },
  { path: "/appointments", element: <PageLoader><AppointmentsPage /></PageLoader> },
  { path: "/calendar", element: <PageLoader><CalendarPage /></PageLoader> },
  { path: "/conversations", element: <PageLoader><ConversationsPage /></PageLoader> },
  { path: "/timeline", element: <PageLoader><TimelinePage /></PageLoader> },
  { path: "/crm-bots", element: <PageLoader><BotsPage /></PageLoader> },
  { path: "/ai-assistant", element: <PageLoader><AIAssistantPage /></PageLoader> },
  { path: "/ai-agents", element: <PageLoader><AIAgentsPage /></PageLoader> },
  { path: "/automations", element: <PageLoader><AutomationsPage /></PageLoader> },
  { path: "/services", element: <PageLoader><ServicesPage /></PageLoader> },
  { path: "/resources", element: <PageLoader><ResourcesPage /></PageLoader> },
  { path: "/working-hours", element: <PageLoader><WorkingHoursPage /></PageLoader> },
  { path: "/analytics", element: <PageLoader><AnalyticsPage /></PageLoader> },
  { path: "/settings", element: <PageLoader><SettingsPage /></PageLoader> },
];

const router = createBrowserRouter([
  {
    path: "/",
    element: <PublicLayout />,
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
    element: (
      <PublicRoute>
        <LoginPage />
      </PublicRoute>
    ),
  },
  {
    path: "/platform",
    element: (
      <PlatformRoute>
        <PlatformLayout />
      </PlatformRoute>
    ),
    children: [
      { index: true, element: <PageLoader><PlatformOverviewPage /></PageLoader> },
      { path: "merchants", element: <PageLoader><PlatformMerchantsPage /></PageLoader> },
      { path: "prospects", element: <PlatformPlaceholderPage {...platformPages.prospects} /> },
      { path: "billing", element: <PlatformPlaceholderPage {...platformPages.billing} /> },
      { path: "analytics", element: <PlatformPlaceholderPage {...platformPages.analytics} /> },
      { path: "settings", element: <PlatformPlaceholderPage {...platformPages.settings} /> },
    ],
  },
  {
    path: "/dashboard",
    element: (
      <MerchantRoute>
        <AppLayout />
      </MerchantRoute>
    ),
    children: merchantChildren,
  },
  ...legacyMerchantRoutes.map((route) => ({
    path: route.path,
    element: (
      <MerchantRoute>
        <AppLayout />
      </MerchantRoute>
    ),
    children: [{ index: true, element: route.element }],
  })),
]);

export function AppRouter() {
  return <RouterProvider router={router} />;
}
