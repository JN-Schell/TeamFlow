import nodemailer, { type Transporter } from "nodemailer";
import type { EmailDelivery, Invitation, Notification, NotificationPreference, Prisma, User } from "@prisma/client";
import { prisma } from "../db";
import { env } from "../env";
import { logger } from "../lib/logger";

export type EmailMessage = {
  to: string;
  subject: string;
  text: string;
  html: string;
};

export interface EmailTransport {
  send(message: EmailMessage): Promise<{ messageId?: string }>;
}

type NotificationWithRecipient = Notification & {
  user: User & { notificationPreference: NotificationPreference | null };
};

const MAX_ERROR_LENGTH = 500;

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function paragraph(value: string): string {
  return `<p style="margin:0 0 14px;line-height:1.55;color:#334155">${escapeHtml(value)}</p>`;
}

function emailLayout(title: string, content: string): string {
  return `<!doctype html>
<html>
  <body style="margin:0;padding:24px;background:#f8fafc;font-family:Inter,Arial,sans-serif">
    <div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;padding:28px">
      <h1 style="margin:0 0 18px;font-size:20px;color:#0f172a">${escapeHtml(title)}</h1>
      ${content}
      <p style="margin:24px 0 0;font-size:12px;color:#64748b">TeamFlow notification</p>
    </div>
  </body>
</html>`;
}

function button(url: string, label: string): string {
  return `<a href="${escapeHtml(url)}" style="display:inline-block;margin-top:8px;padding:10px 16px;border-radius:8px;background:#4f46e5;color:#ffffff;text-decoration:none;font-weight:600">${escapeHtml(label)}</a>`;
}

export function buildInvitationEmail(input: {
  email: string;
  role: string;
  organizationName: string;
  invitedByName?: string | null;
  inviteUrl: string;
  expiresAt: Date;
}): EmailMessage {
  const inviter = input.invitedByName ? `${input.invitedByName} invited you` : "You were invited";
  const role = input.role.toLowerCase().replaceAll("_", " ");
  const text = `${inviter} to join ${input.organizationName} on TeamFlow as ${role}. Accept the invitation before ${input.expiresAt.toISOString()}: ${input.inviteUrl}`;
  const html = emailLayout(
    `Join ${input.organizationName} on TeamFlow`,
    `${paragraph(`${inviter} to join ${input.organizationName} as ${role}.`)}
     ${paragraph(`This invitation expires on ${input.expiresAt.toUTCString()}.`)}
     ${button(input.inviteUrl, "Accept invitation")}`,
  );

  return { to: input.email, subject: `TeamFlow invitation: ${input.organizationName}`, text, html };
}

function unsubscribeUrl(preferences: NotificationPreference): string {
  return `${env.publicApiUrl}/api/email/unsubscribe/${preferences.unsubscribeToken}`;
}

export function buildNotificationEmail(
  notification: Notification,
  user: User,
  preferences: NotificationPreference,
): EmailMessage {
  const body = notification.body ?? "Open TeamFlow to review the update.";
  const unsubscribe = unsubscribeUrl(preferences);
  const text = `${notification.title}\n\n${body}\n\nOpen TeamFlow: ${env.clientOrigins[0]}\nUnsubscribe: ${unsubscribe}`;
  const html = emailLayout(
    notification.title,
    `${paragraph(body)}
     ${button(env.clientOrigins[0] ?? "http://localhost:5173", "Open TeamFlow")}
     <p style="margin:18px 0 0;font-size:12px;color:#64748b">
       <a href="${escapeHtml(unsubscribe)}" style="color:#64748b">Unsubscribe from notification emails</a>
     </p>`,
  );

  return { to: user.email, subject: notification.title, text, html };
}

function createTransport(): EmailTransport {
  if (env.emailProvider === "smtp") {
    const transporter: Transporter = nodemailer.createTransport({
      host: env.smtpHost,
      port: env.smtpPort,
      secure: env.smtpSecure,
      auth: env.smtpUser ? { user: env.smtpUser, pass: env.smtpPass } : undefined,
    });
    return {
      async send(message) {
        const result = await transporter.sendMail({ from: env.emailFrom, ...message });
        return { messageId: result.messageId };
      },
    };
  }

  return {
    async send(message) {
      logger.info({ to: message.to, subject: message.subject }, "email delivery handled by log transport");
      return { messageId: "log-transport" };
    },
  };
}

let transport = createTransport();

export function setEmailTransportForTests(nextTransport: EmailTransport | null): void {
  transport = nextTransport ?? createTransport();
}

export async function ensureNotificationPreference(userId: string): Promise<NotificationPreference> {
  return prisma.notificationPreference.upsert({
    where: { userId },
    update: {},
    create: { userId },
  });
}

function preferenceField(type: Notification["type"]): keyof NotificationPreference | null {
  switch (type) {
    case "TASK_ASSIGNED":
      return "taskAssigned";
    case "TASK_UPDATED":
      return "taskUpdated";
    case "TASK_COMMENTED":
      return "taskCommented";
    case "SPRINT_STARTED":
    case "SPRINT_COMPLETED":
      return "sprintEvents";
    case "MILESTONE_DUE":
      return "milestoneDue";
    case "ADDED_TO_PROJECT":
      return "projectEvents";
    case "INVITATION":
      return "invitationEvents";
    default:
      return null;
  }
}

async function queueDelivery(
  input: {
    organizationId?: string | null;
    notificationId?: string;
    invitationId?: string;
    recipientUserId?: string;
    template: string;
    message: EmailMessage;
  },
  tx: Prisma.TransactionClient | typeof prisma = prisma,
): Promise<void> {
  await tx.emailDelivery.create({
    data: {
      organizationId: input.organizationId ?? null,
      notificationId: input.notificationId ?? null,
      invitationId: input.invitationId ?? null,
      recipientUserId: input.recipientUserId ?? null,
      recipientEmail: input.message.to,
      template: input.template,
      subject: input.message.subject,
      text: input.message.text,
      html: input.message.html,
      maxAttempts: env.emailMaxAttempts,
    },
  });
}

export async function queueInvitationEmail(
  input: {
    invitation: Invitation;
    organizationName: string;
    invitedByName?: string | null;
    inviteUrl: string;
  },
  tx: Prisma.TransactionClient | typeof prisma = prisma,
): Promise<void> {
  const message = buildInvitationEmail({
    email: input.invitation.email,
    role: input.invitation.role,
    organizationName: input.organizationName,
    invitedByName: input.invitedByName,
    inviteUrl: input.inviteUrl,
    expiresAt: input.invitation.expiresAt,
  });
  await queueDelivery(
    {
      organizationId: input.invitation.organizationId,
      invitationId: input.invitation.id,
      template: "invitation",
      message,
    },
    tx,
  );
}

export async function queueNotificationEmails(notifications: Notification[]): Promise<void> {
  if (notifications.length === 0) return;

  const rows = await prisma.notification.findMany({
    where: { id: { in: notifications.map((notification) => notification.id) } },
    include: { user: { include: { notificationPreference: true } } },
  });

  for (const row of rows as NotificationWithRecipient[]) {
    const field = preferenceField(row.type);
    if (!field) continue;

    const preference =
      row.user.notificationPreference ?? (await ensureNotificationPreference(row.userId));
    if (!preference.emailEnabled || preference[field] !== true) continue;

    const message = buildNotificationEmail(row, row.user, preference);
    await queueDelivery({
      organizationId: row.organizationId,
      notificationId: row.id,
      recipientUserId: row.userId,
      template: `notification.${row.type.toLowerCase()}`,
      message,
    });
  }
}

async function processDelivery(delivery: EmailDelivery): Promise<void> {
  const claimed = await prisma.emailDelivery.updateMany({
    where: { id: delivery.id, status: "PENDING" },
    data: { status: "SENDING", attempts: { increment: 1 } },
  });
  if (claimed.count === 0) return;

  const attempt = delivery.attempts + 1;
  try {
    const result = await transport.send({
      to: delivery.recipientEmail,
      subject: delivery.subject,
      text: delivery.text,
      html: delivery.html,
    });
    await prisma.emailDelivery.update({
      where: { id: delivery.id },
      data: {
        status: "SENT",
        sentAt: new Date(),
        providerMessageId: result.messageId ?? null,
        lastError: null,
      },
    });
  } catch (error) {
    const exhausted = attempt >= delivery.maxAttempts;
    const retryDelayMs = env.emailRetryBaseMs * 2 ** Math.max(0, attempt - 1);
    await prisma.emailDelivery.update({
      where: { id: delivery.id },
      data: {
        status: exhausted ? "FAILED" : "PENDING",
        nextAttemptAt: new Date(Date.now() + retryDelayMs),
        lastError: (error instanceof Error ? error.message : String(error)).slice(0, MAX_ERROR_LENGTH),
      },
    });
    logger.warn(
      { deliveryId: delivery.id, attempt, exhausted },
      "email delivery failed",
    );
  }
}

export async function processEmailOutbox(limit = env.emailBatchSize): Promise<number> {
  const pending = await prisma.emailDelivery.findMany({
    where: { status: "PENDING", nextAttemptAt: { lte: new Date() } },
    orderBy: { nextAttemptAt: "asc" },
    take: limit,
  });

  for (const delivery of pending) {
    await processDelivery(delivery);
  }
  return pending.length;
}

let worker: NodeJS.Timeout | null = null;
let workerRunning = false;

export function startEmailWorker(): void {
  if (worker) return;
  worker = setInterval(() => {
    if (workerRunning) return;
    workerRunning = true;
    void processEmailOutbox()
      .catch((error) => logger.warn({ err: error }, "email outbox worker failed"))
      .finally(() => {
        workerRunning = false;
      });
  }, env.emailWorkerIntervalMs);
  worker.unref();
}

export function stopEmailWorker(): void {
  if (worker) clearInterval(worker);
  worker = null;
}
