import { describe, expect, it } from "vitest";
import { prisma } from "../src/db";
import {
  createDirectUser,
  createProject,
  createTask,
  registerOwner,
} from "./helpers";

describe("organization search", () => {
  it("returns ranked results with stable pagination metadata", async () => {
    const owner = await registerOwner("Search Ranking");
    const project = await createProject(owner, { name: "Roadmap Delivery" });
    const exact = await createTask(owner, project.id, { title: "Roadmap" });
    const prefix = await createTask(owner, project.id, { title: "Roadmap readiness" });
    const bodyMatch = await createTask(owner, project.id, {
      title: "Sprint notes",
      description: "Roadmap meeting notes",
    });

    const firstPage = await owner.agent
      .get(`/api/organizations/${owner.orgId}/search?q=roadmap&limit=2&offset=0`)
      .expect(200);
    expect(firstPage.body.tasks).toHaveLength(2);
    expect(firstPage.body.tasks[0].id).toBe(exact.id);
    expect(firstPage.body.tasks[1].id).toBe(prefix.id);
    expect(firstPage.body.pagination).toMatchObject({
      query: "roadmap",
      limit: 2,
      offset: 0,
      counts: { tasks: 3, projects: 1, people: 0 },
      hasMore: { tasks: true },
    });

    const secondPage = await owner.agent
      .get(`/api/organizations/${owner.orgId}/search?q=roadmap&limit=2&offset=2`)
      .expect(200);
    expect(secondPage.body.tasks).toHaveLength(1);
    expect(secondPage.body.tasks[0].id).toBe(bodyMatch.id);
    expect(secondPage.body.pagination.hasMore.tasks).toBe(false);
  });

  it("excludes archived projects and tasks while keeping tenant isolation", async () => {
    const alpha = await registerOwner("Search Alpha Archived");
    const beta = await registerOwner("Search Beta Archived");
    const alphaProject = await createProject(alpha, { name: "Archive Roadmap" });
    const betaProject = await createProject(beta, { name: "Archive Roadmap" });
    await createTask(alpha, alphaProject.id, { title: "Archive roadmap task" });
    await createTask(beta, betaProject.id, { title: "Archive roadmap task" });

    await prisma.project.update({
      where: { id: alphaProject.id },
      data: { archived: true, status: "ARCHIVED" },
    });

    const response = await alpha.agent
      .get(`/api/organizations/${alpha.orgId}/search?q=archive`)
      .expect(200);
    expect(response.body.projects).toHaveLength(0);
    expect(response.body.tasks).toHaveLength(0);
    expect(response.body.pagination.counts).toMatchObject({
      tasks: 0,
      projects: 0,
      people: 0,
    });
  });

  it("finds organization people and treats LIKE wildcards as literal input", async () => {
    const owner = await registerOwner("Search People");
    const direct = await createDirectUser(owner.orgId);

    const directSearch = await owner.agent
      .get(`/api/organizations/${owner.orgId}/search?q=direct`)
      .expect(200);
    expect(directSearch.body.people).toHaveLength(1);
    expect(directSearch.body.people[0].user.id).toBe(direct.user.id);
    expect(directSearch.body.pagination.counts.people).toBe(1);

    const wildcardSearch = await owner.agent
      .get(`/api/organizations/${owner.orgId}/search?q=d%25rect`)
      .expect(200);
    expect(wildcardSearch.body.people).toHaveLength(0);
  });
});
