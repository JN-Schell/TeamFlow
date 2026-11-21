import { Prisma, type Priority, type ProjectStatus } from "@prisma/client";
import { prisma } from "../db";

const LIKE_ESCAPE = /[\\%_]/g;

type CountedRow = { total: number };

type TaskSearchRow = CountedRow & {
  id: string;
  number: number;
  title: string;
  priority: Priority;
  project: {
    id: string;
    name: string;
    key: string;
    color: string;
  };
  column: {
    name: string;
    isDone: boolean;
  };
};

type ProjectSearchRow = CountedRow & {
  id: string;
  name: string;
  key: string;
  color: string;
  status: ProjectStatus;
};

type PersonSearchRow = CountedRow & {
  role: string;
  title: string | null;
  user: {
    id: string;
    name: string;
    email: string;
    avatarColor: string;
  };
};

export type OrganizationSearchResult = {
  tasks: Omit<TaskSearchRow, "total">[];
  projects: Omit<ProjectSearchRow, "total">[];
  people: Omit<PersonSearchRow, "total">[];
  pagination: {
    query: string;
    limit: number;
    offset: number;
    counts: {
      tasks: number;
      projects: number;
      people: number;
    };
    hasMore: {
      tasks: boolean;
      projects: boolean;
      people: boolean;
    };
  };
};

function removeTotal<T extends CountedRow>(row: T): Omit<T, "total"> {
  const { total: _total, ...result } = row;
  return result;
}

export async function searchOrganization(
  organizationId: string,
  query: string,
  limit: number,
  offset: number,
): Promise<OrganizationSearchResult> {
  const term = query.trim();
  const escapedTerm = term.replace(LIKE_ESCAPE, "\\$&");
  const likeTerm = `%${escapedTerm}%`;

  const [taskRows, projectRows, personRows] = await Promise.all([
    prisma.$queryRaw<TaskSearchRow[]>(Prisma.sql`
      SELECT
        t."id",
        t."number",
        t."title",
        t."priority",
        json_build_object(
          'id', p."id",
          'name', p."name",
          'key', p."key",
          'color', p."color"
        ) AS "project",
        json_build_object(
          'name', c."name",
          'isDone', c."isDone"
        ) AS "column",
        COUNT(*) OVER()::integer AS "total"
      FROM "Task" t
      JOIN "Project" p ON p."id" = t."projectId"
      JOIN "WorkflowColumn" c ON c."id" = t."columnId"
      WHERE t."organizationId" = ${organizationId}
        AND t."archived" = false
        AND p."archived" = false
        AND (
          t."title" ILIKE ${likeTerm} ESCAPE '\\'
          OR COALESCE(t."description", '') ILIKE ${likeTerm} ESCAPE '\\'
        )
      ORDER BY
        (
          CASE WHEN lower(t."title") = lower(${term}) THEN 4 ELSE 0 END
          + CASE WHEN t."title" ILIKE ${escapedTerm} || '%' ESCAPE '\\' THEN 1 ELSE 0 END
          + similarity(t."title", ${term}) * 3
          + similarity(COALESCE(t."description", ''), ${term})
        ) DESC,
        t."updatedAt" DESC,
        t."id" ASC
      LIMIT ${limit}
      OFFSET ${offset}
    `),
    prisma.$queryRaw<ProjectSearchRow[]>(Prisma.sql`
      SELECT
        p."id",
        p."name",
        p."key",
        p."color",
        p."status",
        COUNT(*) OVER()::integer AS "total"
      FROM "Project" p
      WHERE p."organizationId" = ${organizationId}
        AND p."archived" = false
        AND (
          p."name" ILIKE ${likeTerm} ESCAPE '\\'
          OR p."key" ILIKE ${likeTerm} ESCAPE '\\'
          OR COALESCE(p."description", '') ILIKE ${likeTerm} ESCAPE '\\'
        )
      ORDER BY
        (
          CASE WHEN lower(p."name") = lower(${term}) OR lower(p."key") = lower(${term}) THEN 4 ELSE 0 END
          + CASE WHEN p."name" ILIKE ${escapedTerm} || '%' ESCAPE '\\' OR p."key" ILIKE ${escapedTerm} || '%' ESCAPE '\\' THEN 1 ELSE 0 END
          + similarity(p."name", ${term}) * 3
          + similarity(p."key", ${term}) * 2
          + similarity(COALESCE(p."description", ''), ${term})
        ) DESC,
        p."updatedAt" DESC,
        p."id" ASC
      LIMIT ${limit}
      OFFSET ${offset}
    `),
    prisma.$queryRaw<PersonSearchRow[]>(Prisma.sql`
      SELECT
        m."role"::text AS "role",
        m."title",
        json_build_object(
          'id', u."id",
          'name', u."name",
          'email', u."email",
          'avatarColor', u."avatarColor"
        ) AS "user",
        COUNT(*) OVER()::integer AS "total"
      FROM "Membership" m
      JOIN "User" u ON u."id" = m."userId"
      WHERE m."organizationId" = ${organizationId}
        AND (
          u."name" ILIKE ${likeTerm} ESCAPE '\\'
          OR u."email" ILIKE ${likeTerm} ESCAPE '\\'
        )
      ORDER BY
        (
          CASE WHEN lower(u."name") = lower(${term}) OR lower(u."email") = lower(${term}) THEN 4 ELSE 0 END
          + CASE WHEN u."name" ILIKE ${escapedTerm} || '%' ESCAPE '\\' THEN 1 ELSE 0 END
          + similarity(u."name", ${term}) * 3
          + similarity(u."email", ${term})
        ) DESC,
        u."name" ASC,
        u."id" ASC
      LIMIT ${limit}
      OFFSET ${offset}
    `),
  ]);

  const taskCount = taskRows[0]?.total ?? 0;
  const projectCount = projectRows[0]?.total ?? 0;
  const personCount = personRows[0]?.total ?? 0;

  return {
    tasks: taskRows.map(removeTotal),
    projects: projectRows.map(removeTotal),
    people: personRows.map(removeTotal),
    pagination: {
      query: term,
      limit,
      offset,
      counts: {
        tasks: taskCount,
        projects: projectCount,
        people: personCount,
      },
      hasMore: {
        tasks: offset + taskRows.length < taskCount,
        projects: offset + projectRows.length < projectCount,
        people: offset + personRows.length < personCount,
      },
    },
  };
}
