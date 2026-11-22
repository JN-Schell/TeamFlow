import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  CalendarClock,
  Check,
  CheckSquare,
  GripVertical,
  Link2,
  MessageSquare,
  Paperclip,
  Plus,
} from "lucide-react";
import { useState, type KeyboardEvent } from "react";
import { api } from "../lib/api";
import type { Project, Task, WorkflowColumn } from "../lib/types";
import { cn, formatDate, isOverdue, PRIORITY_DOT } from "../lib/utils";
import { useToast } from "../providers/ToastProvider";
import { AvatarStack, Badge, Button, EmptyState } from "./ui";

function TaskCard({
  task,
  projectKey,
  overlay = false,
  canWrite,
  onClick,
  onMove,
}: {
  task: Task;
  projectKey: string;
  overlay?: boolean;
  canWrite: boolean;
  onClick?: () => void;
  onMove?: (taskId: string, direction: -1 | 1) => void;
}) {
  // `overlay` is retained for the static drag preview styling when needed.

  const {
    attributes,
    listeners,
    setActivatorNodeRef,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: task.id,
    data: { columnId: task.columnId },
  });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "group relative rounded-lg border border-slate-200 bg-white p-3 shadow-sm transition hover:border-indigo-300 hover:shadow dark:border-slate-800 dark:bg-ink-850 dark:hover:border-indigo-500/40",
        isDragging && "opacity-40",
        overlay && "rotate-1 shadow-float",
      )}
    >
      <button
        type="button"
        onClick={onClick}
        className="block w-full text-left"
        data-focus-return={`task-${task.id}`}
      >
        <div className="flex items-start justify-between gap-2">
          <span className="text-[10px] font-semibold text-slate-400">
            {projectKey}-{task.number}
          </span>
          <div className="flex items-center gap-1 pr-5">
            {task.dependencies && task.dependencies.length > 0 ? (
              <span title="Blocked by another task">
                <Link2 className="h-3 w-3 text-amber-500" />
              </span>
            ) : null}
            <span className={cn("h-2 w-2 rounded-full", PRIORITY_DOT[task.priority])} title={task.priority} />
          </div>
        </div>
        <p className="mt-1.5 line-clamp-2 text-[13px] font-medium leading-5 text-slate-800 dark:text-slate-100">
          {task.title}
        </p>
        {task.category ? (
          <span
            className="mt-1.5 inline-flex rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-slate-700 dark:text-slate-200"
            style={{ backgroundColor: `${task.category.color}24` }}
          >
            {task.category.name}
          </span>
        ) : null}
        <div className="mt-2.5 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-[10px] text-slate-400">
            {task.dueDate ? (
              <span className={cn("flex items-center gap-0.5", isOverdue(task.dueDate) && !task.column.isDone && "text-red-500")}>
                <CalendarClock className="h-3 w-3" />
                {formatDate(task.dueDate)}
              </span>
            ) : null}
            {task._count && task._count.comments > 0 ? (
              <span className="flex items-center gap-0.5">
                <MessageSquare className="h-3 w-3" /> {task._count.comments}
              </span>
            ) : null}
            {task._count && task._count.attachments > 0 ? (
              <span className="flex items-center gap-0.5">
                <Paperclip className="h-3 w-3" /> {task._count.attachments}
              </span>
            ) : null}
            {task.storyPoints ? <span>{task.storyPoints} pts</span> : null}
          </div>
          <AvatarStack users={task.assignments.map((assignment) => assignment.user)} size="xs" max={2} />
        </div>
      </button>
      {canWrite ? (
        <button
          ref={setActivatorNodeRef}
          type="button"
          {...attributes}
          {...listeners}
          aria-label={`Move ${projectKey}-${task.number}. Use Arrow Up or Arrow Down to reorder.`}
          onKeyDown={(event: KeyboardEvent<HTMLButtonElement>) => {
            if (event.key === "ArrowUp" || event.key === "ArrowDown") {
              event.preventDefault();
              onMove?.(task.id, event.key === "ArrowUp" ? -1 : 1);
              return;
            }
            listeners?.onKeyDown?.(event);
          }}
          className="absolute right-2 top-2 cursor-grab rounded p-0.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 active:cursor-grabbing dark:hover:bg-slate-800 dark:hover:text-slate-200"
        >
          <GripVertical className="h-3.5 w-3.5" />
        </button>
      ) : null}
    </div>
  );
}

function BoardColumn({
  column,
  tasks,
  projectKey,
  canWrite,
  onAddTask,
  onOpenTask,
  onMoveTask,
}: {
  column: WorkflowColumn;
  tasks: Task[];
  projectKey: string;
  canWrite: boolean;
  onAddTask: () => void;
  onOpenTask: (taskId: string) => void;
  onMoveTask: (taskId: string, direction: -1 | 1) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `column:${column.id}` });
  const overLimit = column.wipLimit !== null && column.wipLimit !== undefined && tasks.length > column.wipLimit;

  return (
    <div
      data-column-name={column.name}
      className={cn(
        "flex w-[284px] shrink-0 flex-col rounded-xl border bg-slate-100/60 dark:bg-ink-900/40",
        isOver ? "border-indigo-400 bg-indigo-50/60 dark:border-indigo-500/50 dark:bg-indigo-500/5" : "border-slate-200/80 dark:border-slate-800/80",
      )}
    >
      <div className="flex items-center justify-between gap-2 px-3 py-2.5">
        <div className="flex min-w-0 items-center gap-1.5">
          <span className={cn("h-2 w-2 rounded-full", column.isDone ? "bg-emerald-500" : "bg-slate-400")} />
          <span className="truncate text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">
            {column.name}
          </span>
          <span className="rounded-full bg-white px-1.5 py-0.5 text-[10px] font-semibold text-slate-400 dark:bg-slate-800">
            {tasks.length}
            {column.wipLimit ? `/${column.wipLimit}` : ""}
          </span>
          {overLimit ? <Badge tone="amber">WIP</Badge> : null}
        </div>
        {canWrite ? (
          <button
            type="button"
            onClick={onAddTask}
            className="rounded p-1 text-slate-400 transition hover:bg-white hover:text-indigo-600 dark:hover:bg-slate-800"
            aria-label={`Add task to ${column.name}`}
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        ) : null}
      </div>

      <div ref={setNodeRef} className="flex min-h-[140px] flex-1 flex-col gap-2 px-2 pb-2">
        <SortableContext items={tasks.map((task) => task.id)} strategy={verticalListSortingStrategy}>
          {tasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              projectKey={projectKey}
              canWrite={canWrite}
              onClick={() => onOpenTask(task.id)}
              onMove={onMoveTask}
            />
          ))}
        </SortableContext>
        {tasks.length === 0 ? (
          <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed border-slate-300/80 py-7 text-[11px] text-slate-400 dark:border-slate-700/70">
            Drop tasks here
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function KanbanBoard({
  project,
  tasks,
  canWrite,
  onOpenTask,
  onAddTask,
}: {
  project: Project;
  tasks: Task[];
  canWrite: boolean;
  onOpenTask: (taskId: string) => void;
  onAddTask: (columnId: string) => void;
}) {
  const queryClient = useQueryClient();
  const { push } = useToast();
  const [moveAnnouncement, setMoveAnnouncement] = useState("");
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const moveMutation = useMutation({
    mutationFn: (input: { taskId: string; columnId: string; position: number }) =>
      api(`/tasks/${input.taskId}/move`, {
        method: "PATCH",
        body: { columnId: input.columnId, position: input.position },
      }),
    onMutate: (input) => {
      queryClient.setQueriesData<{ tasks: Task[] }>(
        { queryKey: ["tasks", project.id] },
        (current) =>
          current
            ? {
                ...current,
                tasks: current.tasks.map((task) =>
                  task.id === input.taskId
                    ? { ...task, columnId: input.columnId, position: input.position }
                    : task,
                ),
              }
            : current,
      );
    },
    onError: (caught) => {
      push("Could not move task", {
        message: caught instanceof Error ? caught.message : undefined,
        tone: "error",
      });
      void queryClient.invalidateQueries({ queryKey: ["tasks", project.id] });
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ["tasks", project.id] });
      void queryClient.invalidateQueries({ queryKey: ["task"] });
      void queryClient.invalidateQueries({ queryKey: ["project", project.id] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      void queryClient.invalidateQueries({ queryKey: ["sprints", project.id] });
    },
  });

  const columns = project.columns ?? [];
  const grouped = new Map<string, Task[]>();
  for (const column of columns) grouped.set(column.id, []);
  for (const task of tasks) {
    const list = grouped.get(task.columnId);
    if (list) list.push(task);
  }
  for (const list of grouped.values()) {
    list.sort((a, b) => a.position - b.position);
  }

  function onMoveTask(taskId: string, direction: -1 | 1) {
    const task = tasks.find((candidate) => candidate.id === taskId);
    if (!task) return;

    const columnTasks = grouped.get(task.columnId) ?? [];
    const currentIndex = columnTasks.findIndex((candidate) => candidate.id === taskId);
    const targetIndex = currentIndex + direction;
    const neighbor = columnTasks[targetIndex];
    if (!neighbor) return;

    const before = direction === -1 ? columnTasks[targetIndex - 1] : neighbor;
    const after = direction === -1 ? neighbor : columnTasks[targetIndex + 1];
    const position =
      before && after
        ? (before.position + after.position) / 2
        : direction === -1
          ? neighbor.position - 1000
          : neighbor.position + 1000;

    setMoveAnnouncement(
      direction === -1
        ? `Moved ${project.key}-${task.number} before ${project.key}-${neighbor.number}.`
        : `Moved ${project.key}-${task.number} after ${project.key}-${neighbor.number}.`,
    );
    moveMutation.mutate({ taskId, columnId: task.columnId, position });
  }

  function onDragEnd(event: DragEndEvent) {
    const activeId = String(event.active.id);
    const overId = event.over ? String(event.over.id) : null;
    if (!overId || activeId === overId) return;

    const dragged = tasks.find((task) => task.id === activeId);
    if (!dragged) return;

    const overTask = tasks.find((task) => task.id === overId);
    const targetColumnId = overId.startsWith("column:")
      ? overId.slice("column:".length)
      : overTask?.columnId;
    if (!targetColumnId) return;

    const targetTasks = tasks
      .filter((task) => task.columnId === targetColumnId && task.id !== activeId)
      .sort((a, b) => a.position - b.position);

    let position: number;
    if (overTask && overTask.id !== activeId) {
      const index = targetTasks.findIndex((task) => task.id === overTask.id);
      const next = targetTasks[index];
      const previous = targetTasks[index - 1];
      if (next && previous) position = (previous.position + next.position) / 2;
      else if (next) position = next.position - 1000;
      else position = (previous?.position ?? 0) + 1000;
    } else {
      position =
        targetTasks.length === 0
          ? 1000
          : Math.max(...targetTasks.map((task) => task.position)) + 1000;
    }

    if (dragged.columnId === targetColumnId && Math.abs(dragged.position - position) < 0.001) return;
    moveMutation.mutate({ taskId: activeId, columnId: targetColumnId, position });
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCorners} onDragEnd={onDragEnd}>
      <p role="status" className="sr-only">{moveAnnouncement}</p>
      <div className="flex gap-3 overflow-x-auto pb-3">
        {columns.map((column) => (
          <BoardColumn
            key={column.id}
            column={column}
            tasks={grouped.get(column.id) ?? []}
            projectKey={project.key}
            canWrite={canWrite}
            onAddTask={() => onAddTask(column.id)}
            onOpenTask={onOpenTask}
            onMoveTask={onMoveTask}
          />
        ))}
      </div>
      {columns.length === 0 ? (
        <EmptyState
          icon={<CheckSquare className="h-5 w-5" />}
          title="No workflow columns"
          description="Add workflow columns in project settings."
        />
      ) : null}
    </DndContext>
  );
}
