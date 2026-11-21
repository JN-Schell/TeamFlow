-- PostgreSQL trigram search support for ranked organization search.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Tenant filters used together with the trigram indexes.
CREATE INDEX "Task_organizationId_archived_idx" ON "Task"("organizationId", "archived");
CREATE INDEX "Project_organizationId_archived_idx" ON "Project"("organizationId", "archived");

-- Trigram indexes supporting case-insensitive substring predicates and similarity ranking.
CREATE INDEX "Task_title_trgm_idx" ON "Task" USING GIN ("title" gin_trgm_ops);
CREATE INDEX "Task_description_trgm_idx" ON "Task" USING GIN (COALESCE("description", '') gin_trgm_ops);
CREATE INDEX "Project_name_trgm_idx" ON "Project" USING GIN ("name" gin_trgm_ops);
CREATE INDEX "Project_key_trgm_idx" ON "Project" USING GIN ("key" gin_trgm_ops);
CREATE INDEX "Project_description_trgm_idx" ON "Project" USING GIN (COALESCE("description", '') gin_trgm_ops);
CREATE INDEX "User_name_trgm_idx" ON "User" USING GIN ("name" gin_trgm_ops);
CREATE INDEX "User_email_trgm_idx" ON "User" USING GIN ("email" gin_trgm_ops);
