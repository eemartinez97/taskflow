import { z } from "zod";
import { NOTIFICATION_TYPES } from "../constants";
import { userSchema } from "./user";
import { idSchema } from "./common";

export const notificationTypeSchema = z.enum(NOTIFICATION_TYPES);

export const notificationActorSchema = userSchema.pick({
  id: true,
  name: true,
  image: true,
});

export const notificationSchema = z.object({
  id: idSchema,
  userId: idSchema,
  actorId: idSchema.nullable(),
  type: notificationTypeSchema,
  message: z.string().min(1).max(500),
  read: z.boolean(),
  entityId: idSchema.nullable(),
  entityType: z.string().max(50).nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
  actor: notificationActorSchema.nullable(),
});

export const createNotificationSchema = notificationSchema
  .pick({
    userId: true,
    type: true,
    message: true,
  })
  .extend({
    actorId: idSchema.optional(),
    entityId: idSchema.optional(),
    entityType: z.string().max(50).optional(),
  });

export const notificationListSchema = z.object({
  notifications: z.array(notificationSchema),
  unreadCount: z.number().int().min(0),
});

export const markNotificationsReadSchema = z.object({
  ids: z.array(idSchema).min(1),
});
