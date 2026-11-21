import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db";
import { env } from "../env";
import { asyncHandler, notFound } from "../lib/errors";

export const emailRouter = Router();

const tokenSchema = z.string().trim().min(20).max(120);

emailRouter.get(
  "/unsubscribe/:token",
  asyncHandler(async (req, res) => {
    const token = tokenSchema.parse(req.params.token);
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
