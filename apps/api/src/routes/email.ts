import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db";
import { env } from "../env";
import { setCsrfCookie } from "../lib/cookies";
import { asyncHandler, notFound } from "../lib/errors";

export const emailRouter = Router();

const tokenSchema = z.string().regex(/^[A-Za-z0-9_-]{20,120}$/);

function unsubscribePage(token: string, csrfToken: string): string {
  return `<!doctype html>
<html>
  <body style="font-family:system-ui,sans-serif;background:#f8fafc;padding:40px">
    <form method="post" action="/api/email/unsubscribe" style="max-width:420px;margin:auto;background:white;border:1px solid #e2e8f0;border-radius:12px;padding:24px">
      <h1>Unsubscribe from TeamFlow emails</h1>
      <p>This will disable notification emails for this account.</p>
      <input type="hidden" name="token" value="${token}" />
      <input type="hidden" name="_csrf" value="${csrfToken}" />
      <button type="submit" style="padding:10px 16px;border:0;border-radius:8px;background:#4f46e5;color:white;font-weight:600">Unsubscribe</button>
    </form>
  </body>
</html>`;
}

emailRouter.get(
  "/unsubscribe/:token",
  asyncHandler(async (req, res) => {
    const token = tokenSchema.parse(req.params.token);
    const csrfToken = setCsrfCookie(res);
    res.type("html").send(unsubscribePage(token, csrfToken));
  }),
);

emailRouter.post(
  "/unsubscribe",
  asyncHandler(async (req, res) => {
    const token = tokenSchema.parse(req.body?.token);
    const preference = await prisma.notificationPreference.findUnique({
      where: { unsubscribeToken: token },
      select: { userId: true },
    });
    if (!preference) throw notFound("Unsubscribe link not found");

    await prisma.notificationPreference.update({
      where: { userId: preference.userId },
      data: { emailEnabled: false },
    });

    res.redirect(`${env.clientOrigins[0] ?? "http://localhost:5173"}/settings?emailUnsubscribed=1`);
  }),
);
