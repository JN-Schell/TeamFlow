import request from "supertest";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Notification, NotificationPreference, User } from "@prisma/client";
import { app } from "../src/app";
import { prisma } from "../src/db";
import {
  buildNotificationEmail,
  processEmailOutbox,
  setEmailTransportForTests,
  type EmailMessage,
} from "../src/services/email";
import {
  addProjectMember,
  authedPatch,
  createProject,
  createTask,
  inviteMember,
  registerOwner,
} from "./helpers";

class FakeTransport {
  messages: EmailMessage[] = [];
  failures = 0;

  async send(message: EmailMessage) {
    if (this.failures > 0) {
      this.failures -= 1;
      throw new Error("provider unavailable");
    }
    this.messages.push(message);
    return { messageId: `fake-${this.messages.length}` };
  }
}

beforeEach(async () => {
  await prisma.emailDelivery.deleteMany();
});

afterEach(() => {
  setEmailTransportForTests(null);
});

describe("email notifications", () => {
  it("queues an expiring invitation email and sends it through the outbox", async () => {
    const owner = await registerOwner("Email <Org>");
    const invitedEmail = `invitee-${Date.now()}@teamflow.test`;

    const response = await owner.agent
      .post(`/api/organizations/${owner.orgId}/invitations`)
      .set("X-CSRF-Token", owner.csrf)
      .send({ email: invitedEmail, role: "DEVELOPER" })
      .expect(201);

    const invitation = response.body.invitation;
    const delivery = await prisma.emailDelivery.findFirstOrThrow({
      where: { invitationId: invitation.id, template: "invitation" },
    });
    expect(delivery.status).toBe("PENDING");
    expect(delivery.recipientEmail).toBe(invitedEmail);
    expect(delivery.text).toContain(`/invite/${invitation.token}`);
    expect(delivery.html).toContain("Email &lt;Org&gt;");
    expect(delivery.html).not.toContain("Email <Org>");

    const transport = new FakeTransport();
    setEmailTransportForTests(transport);
    expect(await processEmailOutbox()).toBe(1);

    expect(transport.messages).toHaveLength(1);
    expect(transport.messages[0].to).toBe(invitedEmail);
    expect(transport.messages[0].text).toContain(invitation.token);
    const sent = await prisma.emailDelivery.findUniqueOrThrow({ where: { id: delivery.id } });
    expect(sent.status).toBe("SENT");
    expect(sent.attempts).toBe(1);
    expect(sent.providerMessageId).toBe("fake-1");
  });

  it("retries failed deliveries and preserves the failed state until backoff expires", async () => {
    const owner = await registerOwner();
    const invitedEmail = `retry-${Date.now()}@teamflow.test`;
    const response = await owner.agent
      .post(`/api/organizations/${owner.orgId}/invitations`)
      .set("X-CSRF-Token", owner.csrf)
      .send({ email: invitedEmail, role: "VIEWER" })
      .expect(201);

    const transport = new FakeTransport();
    transport.failures = 1;
    setEmailTransportForTests(transport);

    expect(await processEmailOutbox()).toBe(1);
    const delivery = await prisma.emailDelivery.findFirstOrThrow({
      where: { invitationId: response.body.invitation.id },
    });
    expect(delivery.status).toBe("PENDING");
    expect(delivery.attempts).toBe(1);
    expect(delivery.lastError).toBe("provider unavailable");
    expect(delivery.nextAttemptAt.getTime()).toBeGreaterThan(Date.now());

    await prisma.emailDelivery.update({
      where: { id: delivery.id },
      data: { nextAttemptAt: new Date(Date.now() - 1000) },
    });
    expect(await processEmailOutbox()).toBe(1);
    const sent = await prisma.emailDelivery.findUniqueOrThrow({ where: { id: delivery.id } });
    expect(sent.status).toBe("SENT");
    expect(sent.attempts).toBe(2);
  });

  it("respects category preferences and unsubscribe tokens", async () => {
    const owner = await registerOwner();
    const member = await inviteMember(owner);
    const project = await createProject(owner);
    await addProjectMember(owner, project.id, member.user.id);
    await prisma.emailDelivery.deleteMany({ where: { organizationId: owner.orgId } });

    await authedPatch(member, "/api/notifications/preferences", { taskAssigned: false }).expect(200);
    await createTask(owner, project.id, { assigneeIds: [member.user.id] });
    expect(
      await prisma.emailDelivery.count({
        where: { recipientUserId: member.user.id, template: "notification.task_assigned" },
      }),
    ).toBe(0);

    await authedPatch(member, "/api/notifications/preferences", { taskAssigned: true }).expect(200);
    await createTask(owner, project.id, { assigneeIds: [member.user.id] });
    const delivery = await prisma.emailDelivery.findFirstOrThrow({
      where: { recipientUserId: member.user.id, template: "notification.task_assigned" },
    });
    expect(delivery.text).toContain("Unsubscribe:");

    const preference = await prisma.notificationPreference.findUniqueOrThrow({
      where: { userId: member.user.id },
    });
    await request(app)
      .get(`/api/email/unsubscribe/${preference.unsubscribeToken}`)
      .expect(200)
      .expect("Content-Type", /html/);
    await request(app)
      .post("/api/email/unsubscribe")
      .send({ token: preference.unsubscribeToken })
      .expect(302)
      .expect("Location", /\/settings\?emailUnsubscribed=1$/);

    const unsubscribed = await prisma.notificationPreference.findUniqueOrThrow({
      where: { userId: member.user.id },
    });
    expect(unsubscribed.emailEnabled).toBe(false);

    await createTask(owner, project.id, { assigneeIds: [member.user.id] });
    expect(
      await prisma.emailDelivery.count({
        where: { recipientUserId: member.user.id, template: "notification.task_assigned" },
      }),
    ).toBe(1);
  });

  it("escapes notification titles and bodies in HTML templates", () => {
    const notification = {
      title: "<img src=x onerror=alert(1)>",
      body: "<script>alert('x')</script>",
    } as Notification;
    const user = { email: "person@teamflow.test" } as User;
    const preference = {
      unsubscribeToken: "unsubscribe-token-for-template-test",
    } as NotificationPreference;

    const message = buildNotificationEmail(notification, user, preference);
    expect(message.html).toContain("&lt;img src=x onerror=alert(1)&gt;");
    expect(message.html).toContain("&lt;script&gt;");
    expect(message.html).not.toContain("<img src=x");
    expect(message.html).not.toContain("<script>alert");
    expect(message.text).toContain("unsubscribe-token-for-template-test");
  });
});
