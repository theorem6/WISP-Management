/**
 * Push Notification Cloud Functions
 * 
 * Sends push notifications to mobile app users when:
 * - Work order is assigned to them
 * - Work order status changes
 * - Work order is escalated
 *
 * Sends email when project-approved notifications are created (type === 'project_approved').
 */

import { onDocumentUpdated, onDocumentCreated } from 'firebase-functions/v2/firestore';
import * as admin from 'firebase-admin';

/**
 * Cloud Function: Send notification when work order is assigned
 */
export const onWorkOrderAssigned = onDocumentUpdated('work_orders/{workOrderId}', async (event) => {
    const change = event.data;
    if (!change) return;
    
    const before = change.before.data();
    const after = change.after.data();
    const workOrderId = event.params.workOrderId;
    
    // Check if assignedTo changed (new assignment)
    if (before.assignedTo !== after.assignedTo && after.assignedTo) {
      await sendWorkOrderNotification(
        after.assignedTo,
        after.tenantId,
        workOrderId,
        after.ticketNumber || workOrderId,
        after.title || after.type,
        after.priority,
        'assigned'
      );
    }
    
    // Check if status changed
    if (before.status !== after.status && after.assignedTo) {
      await sendWorkOrderNotification(
        after.assignedTo,
        after.tenantId,
        workOrderId,
        after.ticketNumber || workOrderId,
        after.title || after.type,
        after.priority,
        'status_changed',
        `Status changed to ${after.status}`
      );
    }
    
    // Check if priority escalated
    if (before.priority !== after.priority && after.assignedTo) {
      const priorityOrder: Record<string, number> = { low: 0, medium: 1, high: 2, critical: 3 };
      const beforePriority = priorityOrder[before.priority] || 0;
      const afterPriority = priorityOrder[after.priority] || 0;
      if (afterPriority > beforePriority) {
        await sendWorkOrderNotification(
          after.assignedTo,
          after.tenantId,
          workOrderId,
          after.ticketNumber || workOrderId,
          after.title || after.type,
          after.priority,
          'escalated',
          `Priority escalated to ${after.priority}`
        );
      }
    }
  });

/**
 * Send work order notification to user
 */
async function sendWorkOrderNotification(
  userId: string,
  tenantId: string,
  workOrderId: string,
  ticketNumber: string,
  workOrderTitle: string,
  priority: string,
  notificationType: string,
  customMessage?: string
) {
  try {
    // Get user's FCM tokens
    const userDoc = await admin.firestore()
      .collection('users')
      .doc(userId)
      .get();
    
    if (!userDoc.exists) {
      console.log(`User ${userId} not found`);
      return;
    }
    
    const userData = userDoc.data();
    const fcmTokens = userData?.fcmTokens || {};
    
    // Check if notifications enabled
    if (userData?.notifications?.workOrders === false) {
      console.log(`User ${userId} has work order notifications disabled`);
      return;
    }
    
    // Extract tokens
    const tokens = Object.values(fcmTokens)
      .map((device: any) => device.token)
      .filter(Boolean) as string[];
    
    if (tokens.length === 0) {
      console.log(`No FCM tokens for user ${userId}`);
      return;
    }
    
    // Build notification message
    let title = '';
    let body = '';
    
    switch (notificationType) {
      case 'assigned':
        title = `New Work Order: ${ticketNumber}`;
        body = `${workOrderTitle} - Priority: ${priority}`;
        break;
      case 'status_changed':
        title = `Work Order Updated: ${ticketNumber}`;
        body = customMessage || workOrderTitle;
        break;
      case 'escalated':
        title = `⚠️ Escalated: ${ticketNumber}`;
        body = customMessage || workOrderTitle;
        break;
      default:
        title = `Work Order: ${ticketNumber}`;
        body = workOrderTitle;
    }
    
    const message = {
      notification: {
        title,
        body,
        sound: 'default'
      },
      data: {
        type: `work_order_${notificationType}`,
        workOrderId,
        ticketNumber,
        tenantId,
        priority
      },
      android: {
        priority: 'high' as const,
        notification: {
          channelId: 'work_orders',
          priority: 'high' as const,
          sound: 'default'
        }
      },
      tokens
    };
    
    // Send to all user devices
    const response = await admin.messaging().sendEachForMulticast(message);
    
    console.log(`✅ Sent notification to ${response.successCount} devices`);
    console.log(`❌ Failed: ${response.failureCount}`);
    
    // Remove invalid tokens
    if (response.failureCount > 0) {
      await cleanupInvalidTokens(userId, fcmTokens, response.responses);
    }
    
    // Log notification
    await admin.firestore()
      .collection('work_order_notifications')
      .add({
        notificationId: `${workOrderId}_${Date.now()}`,
        tenantId,
        workOrderId,
        ticketNumber,
        recipientUserId: userId,
        type: notificationType,
        title,
        body,
        priority,
        sentAt: admin.firestore.FieldValue.serverTimestamp()
      });
    
  } catch (error) {
    console.error('Error sending notification:', error);
  }
}

/**
 * Firestore trigger: when a notification is created with type project_approved,
 * send email (SendGrid) and optional push (FCM) to the user.
 * Email requires SENDGRID_API_KEY. Push uses user FCM tokens if present.
 */
export const onNotificationCreated = onDocumentCreated('notifications/{notificationId}', async (event) => {
  const snapshot = event.data;
  if (!snapshot) return;

  const data = snapshot.data();
  if (data?.type !== 'project_approved') return;

  const userId = data.userId;
  const title = data.title || 'Project approved';
  const message = data.message || '';
  const projectName = (data.data as { projectName?: string })?.projectName || '';
  const projectId = (data.data as { projectId?: string })?.projectId || '';

  if (!userId) {
    console.warn('[onNotificationCreated] No userId in project_approved notification');
    return;
  }

  let email: string | undefined;
  let fcmTokens: string[] = [];
  try {
    const userRecord = await admin.auth().getUser(userId);
    email = userRecord.email || undefined;
    const userDoc = await admin.firestore().collection('users').doc(userId).get();
    const userData = userDoc.data();
    const tokens = (userData?.fcmTokens || {}) as Record<string, { token?: string }>;
    fcmTokens = Object.values(tokens)
      .map((device) => device?.token)
      .filter((t): t is string => Boolean(t));
  } catch {
    console.warn(`[onNotificationCreated] Could not get user ${userId}`);
    return;
  }

  const textBody = message || `Project "${projectName}" has been approved for deployment and is ready for field work.`;

  // Optional: send push notification to mobile app
  if (fcmTokens.length > 0) {
    try {
      await admin.messaging().sendEachForMulticast({
        notification: {
          title,
          body: textBody
        },
        data: {
          type: 'project_approved',
          projectId,
          projectName,
          tenantId: String(data.tenantId || '')
        },
        android: {
          priority: 'high' as const,
          notification: { channelId: 'project_approvals', priority: 'high' as const }
        },
        tokens: fcmTokens
      });
      console.log(`[onNotificationCreated] Push sent to ${fcmTokens.length} device(s) for project approval: ${projectName}`);
    } catch (pushErr) {
      console.warn('[onNotificationCreated] Push failed (non-blocking):', pushErr);
    }
  }

  // Optional: send email via SendGrid
  const apiKey = process.env.SENDGRID_API_KEY;
  if (!apiKey) {
    console.log('[onNotificationCreated] SENDGRID_API_KEY not set – skipping email (in-app + push still sent if tokens present)');
    return;
  }
  if (!email) {
    console.warn(`[onNotificationCreated] User ${userId} has no email – skipping email`);
    return;
  }

  try {
    const body = {
      personalizations: [{ to: [{ email }] }],
      from: { email: process.env.SENDGRID_FROM_EMAIL || 'noreply@wisptools.io', name: 'WISP Management' },
      subject: title,
      content: [{ type: 'text/plain', value: textBody }]
    };
    const res = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify(body)
    });
    if (!res.ok) {
      const text = await res.text();
      console.error('[onNotificationCreated] SendGrid error:', res.status, text);
      return;
    }
    console.log(`[onNotificationCreated] Email sent to ${email} for project approval: ${projectName}`);
  } catch (err) {
    console.error('[onNotificationCreated] Failed to send email:', err);
  }
});

/**
 * Cleanup invalid FCM tokens
 */
async function cleanupInvalidTokens(
  userId: string,
  fcmTokens: any,
  responses: admin.messaging.SendResponse[]
) {
  const tokensToRemove: string[] = [];
  const tokenEntries = Object.entries(fcmTokens);
  
  responses.forEach((resp, idx) => {
    if (!resp.success && tokenEntries[idx]) {
      const error = resp.error;
      if (
        error?.code === 'messaging/invalid-registration-token' ||
        error?.code === 'messaging/registration-token-not-registered'
      ) {
        tokensToRemove.push(tokenEntries[idx][0]); // device ID
      }
    }
  });
  
  if (tokensToRemove.length > 0) {
    const updates: any = {};
    tokensToRemove.forEach((deviceId) => {
      updates[`fcmTokens.${deviceId}`] = admin.firestore.FieldValue.delete();
    });
    
    await admin.firestore()
      .collection('users')
      .doc(userId)
      .update(updates);
    
    console.log(`🗑️ Removed ${tokensToRemove.length} invalid tokens`);
  }
}

