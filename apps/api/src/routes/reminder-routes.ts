import { ReminderIdParamsSchema } from "@rsjt/shared";
import type { FastifyInstance } from "fastify";
import {
  ReminderNotFoundError,
  type ReminderServiceApi,
} from "../services/reminder-service.js";

export async function registerReminderRoutes(
  app: FastifyInstance,
  reminderService?: ReminderServiceApi,
) {
  function requireService() {
    if (!reminderService) {
      throw app.httpErrors.serviceUnavailable("Reminder service unavailable");
    }
    return reminderService;
  }

  app.get("/reminders", async (request) => {
    await app.requireRole(request, ["tech", "manager"]);
    return requireService().listReminders();
  });

  app.post("/reminders/generate", async (request) => {
    await app.requireRole(request, ["tech", "manager"]);
    return requireService().generateReminders();
  });

  app.post("/reminders/:reminderId/resolve", async (request) => {
    await app.requireRole(request, ["tech", "manager"]);
    const { reminderId } = ReminderIdParamsSchema.parse(request.params);
    try {
      return await requireService().resolveReminder(reminderId);
    } catch (error) {
      throw mapReminderError(app, error);
    }
  });

  app.get("/manager/reminders/stale", async (request) => {
    await app.requireRole(request, ["manager"]);
    return requireService().listStaleReminders();
  });
}

function mapReminderError(app: FastifyInstance, error: unknown) {
  if (error instanceof ReminderNotFoundError) {
    return app.httpErrors.notFound("Reminder not found");
  }
  return error;
}
