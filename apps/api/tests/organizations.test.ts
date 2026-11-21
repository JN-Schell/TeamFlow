import request from "supertest";
import { describe, expect, it } from "vitest";
import { app } from "../src/app";
import { prisma } from "../src/db";
import {
  authedDelete,
  authedPatch,
  authedPost,
  createProject,
  createTask,
  inviteMember,
  registerOwner,
} from "./helpers";

const from = new Date("2026-01-01T00:00:00.000Z");
const to = new Date("2026-01-31T23:59:59.999Z");

describe("organization routes", () => {
  it("returns dashboard shape, applies workload filters, and completes category lifecycle", async () => {
    const owner = await registerOwner("Organization Routes");
    const other = await registerOwner("Organization Other Tenant");
    const developer = await inviteMember(owner, "DEVELOPER");
    const project = await createProject(owner, { name: "Route Coverage" });
    const otherProject = await createProject(other, { name: "Other Route Coverage" });
    const team = await prisma.team.create({
      data: {
        organizationId: owner.orgId,
        name: "Route Coverage Team",
        members: { create: { userId: owner.user.id } },
      },
    });
    const otherTeam = await prisma.team.create({
      data: { organizationId: other.orgId, name: "Other Route Team" },
    });
    await createTask(owner, project.id, {
      title: "Filtered workload task",
      assigneeIds: [owner.user.id],
      estimateHours: 6,
      priority: "HIGH",
    });

    const dashboard = await owner.agent
      .get(`/api/organizations/${owner.orgId}/dashboard`)
      .expect(200);
    expect(dashboard.body).toMatchObject({
      kpis: expect.any(Object),
      completionTrend: expect.any(Array),
      workload: expect.any(Object),
      projects: expect.arrayContaining([
        expect.objectContaining({ id: project.id, completedTasks: 0, progress: 0 }),
      ]),
    });

    const workload = await owner.agent
      .get(`/api/organizations/${owner.orgId}/workload?projectId=${project.id}`)
      .expect(200);
    expect(workload.body.totals).toMatchObject({ openTasks: 1, estimatedHours: 6 });
    expect(workload.body.members[0]).toMatchObject({
      userId: owner.user.id,
      openTasks: 1,
      urgentTasks: 1,
      estimatedHours: 6,
    });

    const teamWorkload = await owner.agent
      .get(`/api/organizations/${owner.orgId}/workload?teamId=${team.id}`)
      .expect(200);
    expect(teamWorkload.body.totals).toMatchObject({ members: 1, openTasks: 1 });
    await owner.agent
      .get(`/api/organizations/${owner.orgId}/workload?projectId=${otherProject.id}`)
      .expect(404);
    await owner.agent
      .get(`/api/organizations/${owner.orgId}/workload?teamId=${otherTeam.id}`)
      .expect(404);

    const activity = await owner.agent
      .get(`/api/organizations/${owner.orgId}/activity?projectId=${project.id}&limit=10`)
      .expect(200);
    expect(activity.body.activity.length).toBeGreaterThan(0);
    expect(
      activity.body.activity.every(
        (entry: { projectId: string | null }) => entry.projectId === project.id,
      ),
    ).toBe(true);
    await owner.agent
      .get(`/api/organizations/${owner.orgId}/activity?projectId=${otherProject.id}`)
      .expect(404);

    const categories = await owner.agent
      .get(`/api/organizations/${owner.orgId}/categories`)
      .expect(200);
    expect(categories.body.categories.length).toBeGreaterThan(0);

    await authedPost(developer, `/api/organizations/${owner.orgId}/categories`, {
      name: "Denied Category",
    }).expect(403);
    const created = await authedPost(owner, `/api/organizations/${owner.orgId}/categories`, {
      name: "Coverage QA",
      color: "#123456",
    }).expect(201);
    await authedDelete(
      owner,
      `/api/organizations/${owner.orgId}/categories/${created.body.category.id}`,
    ).expect(204);

    await authedPatch(owner, `/api/organizations/${owner.orgId}`, { name: "Routes Updated" })
      .expect(200);
    await authedPatch(owner, `/api/organizations/${owner.orgId}`, { name: "Routes Updated Again" })
      .expect(200);
    const audit = await owner.agent
      .get(`/api/organizations/${owner.orgId}/audit-logs?page=2&limit=1`)
      .expect(200);
    expect(audit.body).toMatchObject({ page: 2, limit: 1 });
    expect(audit.body.total).toBeGreaterThanOrEqual(2);
    expect(audit.body.logs).toHaveLength(1);
    await developer.agent
      .get(`/api/organizations/${owner.orgId}/audit-logs`)
      .expect(403);

    for (const path of [
      "dashboard",
      "workload",
      "activity",
      "calendar",
      "audit-logs",
      "categories",
      "search?q=roadmap",
    ]) {
      await other.agent.get(`/api/organizations/${owner.orgId}/${path}`).expect(404);
    }
  });

  it("normalizes calendar events, applies project filters, and rejects bad ranges", async () => {
    const owner = await registerOwner("Calendar Routes");
    const other = await registerOwner("Calendar Other Tenant");
    const projectA = await createProject(owner, { name: "Calendar A" });
    const projectB = await createProject(owner, { name: "Calendar B" });
    const archivedProject = await createProject(owner, { name: "Calendar Archived" });
    const otherProject = await createProject(other, { name: "Other Calendar" });
    const archivedTask = await createTask(owner, archivedProject.id, {
      title: "Archived calendar task",
      dueDate: "2026-01-12T12:00:00.000Z",
    });
    await prisma.project.update({
      where: { id: archivedProject.id },
      data: { archived: true, status: "ARCHIVED" },
    });
    await prisma.task.update({
      where: { id: archivedTask.id },
      data: { archived: true },
    });
    const taskA = await createTask(owner, projectA.id, {
      title: "Calendar task A",
      dueDate: "2026-01-10T12:00:00.000Z",
      assigneeIds: [owner.user.id],
    });
    const taskB = await createTask(owner, projectB.id, {
      title: "Calendar task B",
      dueDate: "2026-01-11T12:00:00.000Z",
    });
    const milestone = await authedPost(owner, `/api/projects/${projectA.id}/milestones`, {
      name: "Calendar milestone",
      dueDate: "2026-01-15T12:00:00.000Z",
    }).expect(201);
    const sprint = await authedPost(owner, `/api/projects/${projectA.id}/sprints`, {
      name: "Calendar sprint",
      startDate: "2026-01-05T00:00:00.000Z",
      endDate: "2026-01-20T00:00:00.000Z",
    }).expect(201);

    const invalid = await owner.agent
      .get(`/api/organizations/${owner.orgId}/calendar?from=${to.toISOString()}&to=${from.toISOString()}`)
      .expect(400);
    expect(invalid.body.error.code).toBe("BAD_REQUEST");
    await owner.agent
      .get(`/api/organizations/${owner.orgId}/calendar?from=2026-01-01&to=2027-01-03`)
      .expect(400);
    await other.agent
      .get(`/api/organizations/${owner.orgId}/calendar?from=${from.toISOString()}&to=${to.toISOString()}`)
      .expect(404);
    await owner.agent
      .get(`/api/organizations/${owner.orgId}/calendar?from=${from.toISOString()}&to=${to.toISOString()}&projectId=${otherProject.id}`)
      .expect(404);

    const unfiltered = await owner.agent
      .get(`/api/organizations/${owner.orgId}/calendar?from=${from.toISOString()}&to=${to.toISOString()}`)
      .expect(200);
    expect(
      unfiltered.body.events.some(
        (event: { entityId: string }) => event.entityId === archivedTask.id,
      ),
    ).toBe(false);
    expect(
      unfiltered.body.events.some(
        (event: { project: { id: string } }) => event.project.id === archivedProject.id,
      ),
    ).toBe(false);
    const eventDates = unfiltered.body.events.map((event: { date: string }) => event.date);
    expect(eventDates).toEqual([...eventDates].sort());

    const filtered = await owner.agent
      .get(`/api/organizations/${owner.orgId}/calendar?from=${from.toISOString()}&to=${to.toISOString()}&projectId=${projectA.id}`)
      .expect(200);
    const eventTypes = new Map(filtered.body.events.map((event: { type: string }) => [event.type, event]));
    expect(filtered.body.events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: `task-${taskA.id}`,
          type: "task",
          title: `${projectA.key}-${taskA.number} Calendar task A`,
          date: "2026-01-10T12:00:00.000Z",
          assignees: [expect.objectContaining({ id: owner.user.id })],
        }),
        expect.objectContaining({
          id: `milestone-${milestone.body.milestone.id}`,
          type: "milestone",
          date: "2026-01-15T12:00:00.000Z",
        }),
        expect.objectContaining({
          id: `sprint-${sprint.body.sprint.id}`,
          type: "sprint",
          endDate: "2026-01-20T00:00:00.000Z",
          taskCount: 0,
        }),
      ]),
    );
    expect(eventTypes.get("task")).toBeTruthy();
    expect(filtered.body.events.some((event: { entityId: string }) => event.entityId === taskB.id)).toBe(false);
  });

  it("exports JSON and safely escaped CSV reports with audit evidence", async () => {
    const owner = await registerOwner("Report Routes");
    const other = await registerOwner("Report Other Tenant");
    const project = await createProject(owner, { name: "Report Project" });
    const task = await createTask(owner, project.id, {
      title: "=1+1",
      assigneeIds: [owner.user.id],
      storyPoints: 3,
    });
    const formattedTask = await createTask(owner, project.id, {
      title: 'Comma, "quoted"\nline',
    });

    const json = await owner.agent.get(`/api/projects/${project.id}/report?format=json`).expect(200);
    expect(json.body).toMatchObject({
      generatedAt: expect.any(String),
      project: expect.objectContaining({ id: project.id }),
      summary: expect.objectContaining({ totalTasks: 2, completedTasks: 0, totalStoryPoints: 3 }),
      tasks: expect.arrayContaining([
        expect.objectContaining({ id: task.id }),
        expect.objectContaining({ id: formattedTask.id }),
      ]),
      milestones: [],
      sprints: [],
    });

    const audit = await prisma.auditLog.findFirstOrThrow({
      where: {
        organizationId: owner.orgId,
        action: "report.exported",
        entityId: project.id,
      },
    });
    expect(audit.metadata).toMatchObject({ format: "json" });

    const csv = await owner.agent
      .get(`/api/projects/${project.id}/report?format=csv`)
      .expect(200)
      .expect("Content-Type", /text\/csv/);
    expect(csv.headers["content-disposition"]).toContain("attachment;");
    expect(csv.text.startsWith("\uFEFF")).toBe(true);
    expect(csv.text).toContain("Key,Title,Status,Priority");
    expect(csv.text).toContain(`${project.key}-${task.number},'=1+1,`);
    expect(csv.text).not.toContain(`${project.key}-${task.number},=1+1,`);
    expect(csv.text).toContain(
      `"${formattedTask.title.replace(/"/g, '""')}"`,
    );

    await owner.agent.get(`/api/projects/${project.id}/report?format=xml`).expect(400);
    await request(app).get(`/api/projects/${project.id}/report`).expect(401);
    await other.agent.get(`/api/projects/${project.id}/report`).expect(404);
  });
});
