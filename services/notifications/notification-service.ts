/**
 * Notification architecture placeholder for v0.4's NAVER Cloud SENS
 * integration. No real send path exists yet — SENS needs credentials, a
 * registered sender number and approved templates that only the project
 * owner can provision, so nothing here fabricates or hardcodes any of that.
 *
 * `NotificationService` is the seam a future `SensNotificationService`
 * plugs into without touching any call site below. `noopNotificationService`
 * is wired in today: every event fires, gets recorded to the console for
 * visibility during development, and does nothing else.
 */

export type NotificationEvent =
  | { type: "new_service_request"; transactionId: string; installerId: string }
  | { type: "new_message"; transactionId: string; roomId: string; recipientId: string; preview: string }
  | { type: "stage_confirmed"; transactionId: string; stage: "시공예약"; recipientId: string }
  | { type: "inbound_today"; transactionId: string; recipientId: string };

export interface NotificationService {
  notify(event: NotificationEvent): Promise<void>;
}

export class NoopNotificationService implements NotificationService {
  async notify(event: NotificationEvent) {
    if (process.env.NODE_ENV !== "production") console.info("[notification:noop]", event);
  }
}

export const notificationService: NotificationService = new NoopNotificationService();
