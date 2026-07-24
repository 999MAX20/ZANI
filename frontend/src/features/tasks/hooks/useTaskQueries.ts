import { useMemo } from "react";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";

import { activityEventsApi } from "../../../api/activities";
import { teamApi } from "../../../api/team";
import { tasksApi, type TaskListParams } from "../../../api/tasks";
import type { Task } from "../../../types";

export function useTaskQueries({
  selectedTask,
  taskIdParam,
  taskListParams,
  taskSummaryParams,
  taskWorkloadParams,
  taskOrdering,
  businessId,
  includeTeamData,
  includeTemplates,
}: {
  selectedTask: Task | null;
  taskIdParam: number;
  taskListParams: TaskListParams;
  taskSummaryParams: TaskListParams;
  taskWorkloadParams: TaskListParams;
  taskOrdering: string;
  businessId: number;
  includeTeamData: boolean;
  includeTemplates: boolean;
}) {
  const selectedTaskQuery = useQuery({
    queryKey: ["task", taskIdParam],
    queryFn: () => tasksApi.get(taskIdParam),
    enabled: Boolean(taskIdParam),
  });

  const taskComments = useQuery({
    queryKey: ["task-comments", selectedTask?.id],
    queryFn: () => tasksApi.comments(selectedTask!.id),
    enabled: Boolean(selectedTask?.id),
  });

  const taskActivity = useQuery({
    queryKey: ["task-activity", selectedTask?.id],
    queryFn: () => activityEventsApi.listForEntity({ entity_type: "Task", entity_id: selectedTask!.id }),
    enabled: Boolean(selectedTask?.id),
  });

  const tasksQuery = useInfiniteQuery({
    queryKey: ["tasks", { ...taskListParams, ordering: taskOrdering }],
    initialPageParam: 1,
    queryFn: ({ pageParam }) => tasksApi.listPage({ ...taskListParams, page: Number(pageParam) }),
    getNextPageParam: (lastPage, allPages) => (lastPage.next ? allPages.length + 1 : undefined),
    enabled: true,
  });

  const taskSummary = useQuery({
    queryKey: ["tasks-summary", taskSummaryParams],
    queryFn: () => tasksApi.summary(taskSummaryParams),
  });

  const taskWorkload = useQuery({
    queryKey: ["tasks-workload", businessId, taskWorkloadParams],
    queryFn: () => tasksApi.workload({ ...taskWorkloadParams, business: businessId }),
    enabled: Boolean(businessId && includeTeamData),
  });

  const teamMembers = useQuery({
    queryKey: ["team-members"],
    queryFn: teamApi.members,
    enabled: includeTeamData,
  });

  const taskTemplates = useQuery({
    queryKey: ["task-templates", businessId],
    queryFn: () => tasksApi.templates({ business: businessId }),
    enabled: Boolean(businessId && includeTemplates),
  });

  const loadedTasks = useMemo(() => tasksQuery.data?.pages.flatMap((page) => page.results) || [], [tasksQuery.data]);

  return {
    selectedTaskQuery,
    taskComments,
    taskActivity,
    tasksQuery,
    taskSummary,
    taskWorkload,
    teamMembers,
    taskTemplates,
    loadedTasks,
  };
}
