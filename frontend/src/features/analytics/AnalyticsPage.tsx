import { AlertTriangle, CalendarCheck, CheckCircle2, Download, Flame, ShieldAlert, TrendingDown, TrendingUp, Users } from "lucide-react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";

import { analyticsApi } from "../../api/analytics";
import { asArray, getApiErrorMessage } from "../../api/client";
import { Card, CardBody } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { PageHeader } from "../../components/ui/PageHeader";
import { ErrorState, LoadingState } from "../../components/ui/StateViews";
import { StatusBadge } from "../../components/ui/StatusBadge";
import { useActiveBusiness } from "../../hooks/useBusiness";
import { useEntityData } from "../../hooks/useEntityData";
import { useI18n } from "../../lib/i18n";
import type { TeamPerformanceActionItem, TeamPerformanceMember, TeamPerformanceTeam } from "../../types";

function Stat({ label, value, hint, icon: Icon }: { label: string; value: number | string; hint?: string; icon: typeof Flame }) {
  return (
    <Card>
      <CardBody>
        <div className="mb-4 grid h-10 w-10 place-items-center rounded-2xl bg-slate-100 text-midnight">
          <Icon size={18} />
        </div>
        <p className="text-sm font-medium text-slate-500">{label}</p>
        <p className="mt-2 text-3xl font-semibold tracking-tight text-midnight">{value}</p>
        {hint ? <p className="mt-1 text-xs text-slate-400">{hint}</p> : null}
      </CardBody>
    </Card>
  );
}

export function AnalyticsPage() {
  const { t } = useI18n();
  const { business } = useActiveBusiness();
  const { appointments, services } = useEntityData();
  const metrics = useQuery({
    queryKey: ["owner-dashboard", business?.id],
    queryFn: () => analyticsApi.ownerDashboard(business?.id),
    enabled: Boolean(business),
  });
  const teamPerformance = useQuery({
    queryKey: ["team-performance", business?.id],
    queryFn: () => analyticsApi.teamPerformance(business?.id),
    enabled: Boolean(business),
    retry: false,
  });
  const reportSummary = useQuery({
    queryKey: ["analytics-report-summary", business?.id],
    queryFn: () => analyticsApi.reportSummary(business?.id),
    enabled: Boolean(business),
  });
  const scheduledReports = useQuery({
    queryKey: ["scheduled-reports"],
    queryFn: analyticsApi.scheduledReports.list,
    enabled: Boolean(business),
  });
  const exportMutation = useMutation({
    mutationFn: analyticsApi.exportReport,
  });

  if (!business) return <ErrorState message={t("analytics.noBusiness")} />;
  if (appointments.isLoading || services.isLoading || metrics.isLoading) return <LoadingState />;
  if (metrics.error) return <ErrorState message={t("analytics.loadError")} />;

  const appointmentList = appointments.data || [];
  const dashboard = metrics.data;
  const completed = dashboard?.appointments_completed || 0;
  const noShow = dashboard?.no_show_count || 0;
  const conversion = dashboard?.conversion_lead_to_appointment || 0;
  const sourceRows = dashboard?.leads_by_source || [];
  const report = reportSummary.data;
  const teamPerformanceMembers = asArray<TeamPerformanceMember>(teamPerformance.data?.members);
  const teamPerformanceActions = asArray<TeamPerformanceActionItem>(teamPerformance.data?.action_items);
  const teamPerformanceTeams = asArray<TeamPerformanceTeam>(teamPerformance.data?.teams);

  return (
    <>
      <PageHeader title={t("analytics.title")} description={t("analytics.description")} />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <Stat label={t("dashboard.newLeads")} value={dashboard?.new_leads || 0} hint={t("analytics.needProcessing")} icon={Flame} />
        <Stat label={t("common.today")} value={dashboard?.appointments_today || 0} hint={t("analytics.bookingsForDay")} icon={CalendarCheck} />
        <Stat label={t("dashboard.conversion")} value={`${conversion}%`} hint={t("dashboard.leadToBooking")} icon={TrendingUp} />
        <Stat label={t("analytics.noShow")} value={noShow} hint={t("analytics.noShowHint")} icon={TrendingDown} />
        <Stat label={t("analytics.completed")} value={completed} hint={t("analytics.servedClients")} icon={CheckCircle2} />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1fr_1fr]">
        <Card>
          <CardBody>
            <h2 className="text-lg font-semibold text-midnight">{t("analytics.leadSources")}</h2>
            <div className="mt-4 divide-y divide-slate-100">
              {(sourceRows.length ? sourceRows : [{ source: t("analytics.noData"), count: 0 }]).map(({ source, count }) => (
                <div key={source} className="flex items-center justify-between py-3">
                  <span className="font-medium text-slate-700">{source}</span>
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-600">{count}</span>
                </div>
              ))}
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            <h2 className="text-lg font-semibold text-midnight">{t("dashboard.attention")}</h2>
            <div className="mt-4 divide-y divide-slate-100">
              {[
                [t("dashboard.newLeads"), dashboard?.new_leads || 0],
                [t("dashboard.openTasks"), dashboard?.open_tasks || 0],
                [t("analytics.overdueTasks"), dashboard?.overdue_tasks || 0],
                [t("analytics.noShow"), dashboard?.no_show_count || 0],
              ].map(([label, count]) => (
                <div key={label} className="flex items-center justify-between py-3">
                  <div>
                    <p className="font-medium text-slate-700">{label}</p>
                    <p className="text-xs text-slate-400">{t("analytics.openSectionHint")}</p>
                  </div>
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-600">{count}</span>
                </div>
              ))}
            </div>
          </CardBody>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <CardBody>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-midnight">{t("analytics.operationalReports")}</h2>
                <p className="mt-1 text-sm leading-6 text-slate-500">{t("analytics.operationalReportsText")}</p>
              </div>
              <Button
                variant="secondary"
                className="rounded-full"
                onClick={() => exportMutation.mutate({ business: business.id, report: "source_roi" })}
                isLoading={exportMutation.isPending}
              >
                <Download size={16} />
                CSV
              </Button>
            </div>
            {reportSummary.isLoading ? <div className="mt-4"><LoadingState label={t("analytics.loadingReports")} /></div> : null}
            {reportSummary.error ? <div className="mt-4"><ErrorState message={getApiErrorMessage(reportSummary.error)} /></div> : null}
            {report ? (
              <div className="mt-5 grid gap-4 lg:grid-cols-3">
                <div className="rounded-3xl border border-slate-100 bg-slate-50 p-4">
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">{t("analytics.repeatRate")}</p>
                  <p className="mt-2 text-3xl font-black text-midnight">{report.retention_ltv.repeat_rate}%</p>
                  <p className="mt-1 text-sm text-slate-500">{t("analytics.repeatClientsCount", { count: report.retention_ltv.repeat_clients })}</p>
                </div>
                <div className="rounded-3xl border border-slate-100 bg-slate-50 p-4">
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">{t("analytics.ltvEstimate")}</p>
                  <p className="mt-2 text-3xl font-black text-midnight">{report.retention_ltv.ltv_estimate}</p>
                  <p className="mt-1 text-sm text-slate-500">{report.retention_ltv.data_quality}</p>
                </div>
                <div className="rounded-3xl border border-slate-100 bg-slate-50 p-4">
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">{t("analytics.openDeals")}</p>
                  <p className="mt-2 text-3xl font-black text-midnight">{report.funnel_velocity.open_deals}</p>
                  <p className="mt-1 text-sm text-slate-500">{t("analytics.wonLost")}: {report.funnel_velocity.won_deals}/{report.funnel_velocity.lost_deals}</p>
                </div>
              </div>
            ) : null}
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            <h2 className="text-lg font-semibold text-midnight">{t("analytics.scheduledReports")}</h2>
            <p className="mt-1 text-sm leading-6 text-slate-500">{t("analytics.scheduledReportsText")}</p>
            <div className="mt-4 space-y-3">
              {(scheduledReports.data || []).map((item) => (
                <div key={item.id} className="rounded-2xl border border-slate-100 bg-slate-50 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-bold text-midnight">{item.name}</p>
                    <StatusBadge status={item.frequency} />
                  </div>
                  <p className="mt-1 text-xs text-slate-500">{item.recipients_json.join(", ") || t("analytics.noRecipients")}</p>
                </div>
              ))}
              {!scheduledReports.data?.length ? (
                <div className="rounded-2xl bg-slate-50 p-3 text-sm font-semibold text-slate-500">{t("analytics.noSchedules")}</div>
              ) : null}
            </div>
          </CardBody>
        </Card>
      </div>

      <div className="mt-6">
        <Card>
          <CardBody>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="text-lg font-semibold text-midnight">{t("analytics.sourceRoi")}</h2>
              <Button
                variant="ghost"
                className="rounded-full"
                onClick={() => exportMutation.mutate({ business: business.id, report: "manager_performance" })}
                isLoading={exportMutation.isPending}
              >
                <Download size={16} />
                {t("analytics.teamCsv")}
              </Button>
            </div>
            <div className="mt-4 divide-y divide-slate-100">
              {(report?.source_roi?.length ? report.source_roi : []).map((row) => (
                <div key={row.source} className="grid gap-3 py-3 md:grid-cols-[1fr_repeat(4,120px)] md:items-center">
                  <div>
                    <p className="font-medium text-slate-700">{row.source}</p>
                    <p className="text-xs text-slate-400">{row.roi_status}</p>
                  </div>
                  <MiniMetric label={t("nav.leads")} value={row.leads} />
                  <MiniMetric label={t("nav.appointments")} value={row.appointments} />
                  <MiniMetric label={t("dashboard.conversion")} value={`${row.conversion_rate}%`} />
                  <MiniMetric label={t("dashboard.revenue")} value={row.revenue_estimate} />
                </div>
              ))}
              {!report?.source_roi?.length ? <p className="py-3 text-sm text-slate-500">{t("analytics.sourcesEmpty")}</p> : null}
            </div>
          </CardBody>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <Card>
          <CardBody>
            <h2 className="text-lg font-semibold text-midnight">{t("analytics.dealFunnel")}</h2>
            <div className="mt-4 space-y-3">
              {(report?.funnel_velocity.deal_stages || []).map((stage) => (
                <div key={stage.stage} className="rounded-2xl border border-slate-100 bg-slate-50 p-3">
                  <div className="flex items-center justify-between">
                    <p className="font-semibold text-midnight">{stage.stage}</p>
                    <span className="rounded-full bg-white px-2.5 py-1 text-xs font-bold text-slate-600">{stage.count}</span>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">{t("analytics.probability")} {stage.avg_probability}% · {t("analytics.avgDays")} {stage.avg_days_in_stage ?? "-"}</p>
                </div>
              ))}
              {!report?.funnel_velocity.deal_stages.length ? <p className="text-sm text-slate-500">{t("analytics.dealsEmpty")}</p> : null}
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            <h2 className="text-lg font-semibold text-midnight">{t("analytics.servicesByBookings")}</h2>
            <div className="mt-4 divide-y divide-slate-100">
              {(services.data || []).map((service) => (
                <div key={service.id} className="flex items-center justify-between py-3">
                  <div>
                    <p className="font-medium text-slate-700">{service.name}</p>
                    <p className="text-xs text-slate-400">{service.duration_minutes} {t("appointment.minutes")}</p>
                  </div>
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-600">
                    {appointmentList.filter((appointment) => appointment.service === service.id).length}
                  </span>
                </div>
              ))}
              {!services.data?.length ? <p className="py-3 text-sm text-slate-500">{t("services.emptyTitle")}</p> : null}
            </div>
          </CardBody>
        </Card>
      </div>

      <div className="mt-6">
        <div className="mb-4 flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-2xl bg-brand-50 text-brand-700">
            <Users size={20} />
          </div>
          <div>
            <h2 className="text-xl font-bold text-midnight">{t("analytics.teamPerformance")}</h2>
            <p className="text-sm text-slate-500">{t("analytics.teamPerformanceText")}</p>
          </div>
        </div>
        {teamPerformance.isLoading ? <LoadingState label={t("analytics.loadingTeam")} /> : null}
        {teamPerformance.error ? (
          <Card>
            <CardBody className="flex items-start gap-3">
              <ShieldAlert className="mt-1 text-amber-600" size={22} />
              <div>
                <h3 className="font-bold text-midnight">{t("analytics.teamHidden")}</h3>
                <p className="mt-1 text-sm leading-6 text-slate-500">
                  {getApiErrorMessage(teamPerformance.error) || t("analytics.teamHiddenText")}
                </p>
              </div>
            </CardBody>
          </Card>
        ) : null}
        {teamPerformance.data ? (
          <div className="space-y-5">
            <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-6">
              <Stat label={t("analytics.assignedLeads")} value={teamPerformance.data.totals.assigned_leads} icon={Users} />
              <Stat label={t("dashboard.conversion")} value={`${teamPerformance.data.totals.appointment_conversion_rate}%`} icon={TrendingUp} />
              <Stat label={t("analytics.lostLeads")} value={teamPerformance.data.totals.lost_leads} icon={TrendingDown} />
              <Stat label={t("analytics.overdueHandoffs")} value={teamPerformance.data.totals.overdue_handoffs} icon={AlertTriangle} />
              <Stat label={t("analytics.slaOverdue")} value={teamPerformance.data.totals.sla_overdue_deals} icon={Flame} />
              <Stat label={t("analytics.overdueTasks")} value={teamPerformance.data.totals.tasks_overdue} icon={Flame} />
            </div>

            <div className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
              <Card>
                <CardBody>
                  <div className="mb-4 flex items-center justify-between">
                    <h3 className="font-bold text-midnight">{t("analytics.employees")}</h3>
                    <StatusBadge status={teamPerformance.data.scope} />
                  </div>
                  <div className="space-y-3">
                    {teamPerformanceMembers.map((member) => (
                      <div key={member.user.id} className="rounded-3xl border border-slate-100 bg-slate-50 p-4">
                        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                          <div>
                            <p className="font-bold text-midnight">{member.user.full_name || member.user.email}</p>
                            <p className="mt-1 text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">{member.role}</p>
                            <div className="mt-2 flex flex-wrap gap-2">
                              {asArray<{ id: string | number; name: string; is_lead: boolean }>(member.teams).map((team) => (
                                <span key={team.id} className="rounded-full bg-white px-2.5 py-1 text-xs font-bold text-slate-500">
                                  {team.name}{team.is_lead ? ` · ${t("analytics.teamLead")}` : ""}
                                </span>
                              ))}
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-2 text-sm md:grid-cols-4">
                            <MiniMetric label={t("nav.leads")} value={member.assigned_leads} />
                            <MiniMetric label={t("analytics.contact")} value={member.contacted_leads} />
                            <MiniMetric label={t("dashboard.conversion")} value={`${member.appointment_conversion_rate}%`} />
                            <MiniMetric label={t("analytics.lost")} value={member.lost_leads} danger={member.lost_leads > 0} />
                            <MiniMetric label={t("nav.tasks")} value={member.tasks_overdue} danger={member.tasks_overdue > 0} />
                          </div>
                        </div>
                        <div className="mt-3 grid gap-2 text-xs font-semibold text-slate-500 md:grid-cols-4">
                          <span>{t("analytics.avgResponse")}: {member.avg_response_time_minutes ?? "-"} {t("analytics.minutesShort")}</span>
                          <span>{t("analytics.handoffOverdue")}: {member.overdue_handoffs}</span>
                          <span>{t("analytics.missedChats")}: {member.missed_chat_handoffs}</span>
                          <span>{t("analytics.slaOverdueShort")}: {member.sla_overdue_deals}</span>
                          <span>{t("analytics.wonLost")}: {member.deals_won}/{member.deals_lost}</span>
                          <span>{t("analytics.noShow")}: {member.no_show_appointments}</span>
                          <span>{t("analytics.closedLeads")}: {member.closed_leads}</span>
                          <span>{t("nav.appointments")}: {member.appointments_created}</span>
                        </div>
                      </div>
                    ))}
                    {!teamPerformanceMembers.length ? <p className="text-sm text-slate-500">{t("analytics.noEmployees")}</p> : null}
                  </div>
                </CardBody>
              </Card>

              <Card>
                <CardBody>
                  <h3 className="font-bold text-midnight">{t("analytics.actionList")}</h3>
                  <div className="mt-4 space-y-3">
                    {teamPerformanceActions.map((action) => (
                      <Link
                        key={`${action.user_id}-${action.type}`}
                        to={action.route}
                        className={action.severity === "critical" ? "block rounded-2xl border border-red-100 bg-red-50 p-3 transition hover:-translate-y-0.5 hover:shadow-soft" : "block rounded-2xl border border-amber-100 bg-amber-50 p-3 transition hover:-translate-y-0.5 hover:shadow-soft"}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className={action.severity === "critical" ? "font-semibold text-red-900" : "font-semibold text-amber-900"}>{action.title}</p>
                            <p className="mt-1 text-xs leading-5 text-slate-600">{action.description}</p>
                          </div>
                          <span className={action.severity === "critical" ? "rounded-full bg-white px-2.5 py-1 text-xs font-bold text-red-700" : "rounded-full bg-white px-2.5 py-1 text-xs font-bold text-amber-700"}>{action.count}</span>
                        </div>
                      </Link>
                    ))}
                    {!teamPerformanceActions.length ? (
                      <div className="rounded-2xl bg-emerald-50 p-3 text-sm font-semibold text-emerald-800">{t("analytics.noTeamActions")}</div>
                    ) : null}
                  </div>

                  <h3 className="mt-6 font-bold text-midnight">{t("analytics.teamTab")}</h3>
                  <div className="mt-4 space-y-3">
                    {teamPerformanceTeams.map((team) => (
                      <div key={team.id} className="rounded-2xl border border-slate-100 bg-slate-50 p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-semibold text-midnight">{team.name}</p>
                            <p className="mt-1 text-xs text-slate-500">{t("analytics.membersCount", { count: team.members_count })} · {t("analytics.lostRate")} {team.lost_rate}%</p>
                          </div>
                          <span className="rounded-full bg-white px-2.5 py-1 text-xs font-bold text-slate-600">{t("analytics.leadsCount", { count: team.assigned_leads })}</span>
                        </div>
                        <div className="mt-3 grid grid-cols-2 gap-2 text-xs font-semibold text-slate-500">
                          <span>SLA: {team.sla_overdue_deals}</span>
                          <span>{t("analytics.handoff")}: {team.overdue_handoffs}</span>
                          <span>{t("nav.tasks")}: {team.tasks_overdue}</span>
                          <span>{t("analytics.noShow")}: {team.no_show_appointments}</span>
                        </div>
                      </div>
                    ))}
                    {!teamPerformanceTeams.length ? (
                      <div className="rounded-2xl bg-slate-50 p-3 text-sm font-semibold text-slate-500">{t("analytics.noTeams")}</div>
                    ) : null}
                  </div>
                </CardBody>
              </Card>
            </div>
          </div>
        ) : null}
      </div>
    </>
  );
}

function MiniMetric({ label, value, danger }: { label: string; value: number | string; danger?: boolean }) {
  return (
    <div className={danger ? "rounded-2xl bg-red-50 px-3 py-2 text-red-700" : "rounded-2xl bg-white px-3 py-2 text-slate-600"}>
      <p className="text-[11px] font-bold uppercase tracking-[0.12em] opacity-70">{label}</p>
      <p className="mt-1 text-lg font-black">{value}</p>
    </div>
  );
}
