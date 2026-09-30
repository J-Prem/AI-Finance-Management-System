import cron from 'cron';
import Bill from '../models/Bill.js';
import notificationService from '../services/notificationService.js';
import logger from '../utils/logger.js';

/**
 * Bill Reminder Cron Job
 * Runs daily at 9:00 AM to check upcoming bills and send reminders
 */
export const initializeBillReminderJob = (io) => {
  // Run every day at 9:00 AM
  const billReminderJob = cron.schedule('0 9 * * *', async () => {
    logger.info('Starting bill reminder job...');
    try {
      await processBillReminders(io);
      logger.info('Bill reminder job completed successfully');
    } catch (error) {
      logger.error('Error in bill reminder job:', error);
    }
  });

  return billReminderJob;
};

/**
 * Initialize overdue bill check job
 * Runs every 6 hours to check for overdue bills
 */
export const initializeOverdueBillJob = (io) => {
  const overdueBillJob = cron.schedule('0 */6 * * *', async () => {
    logger.info('Starting overdue bill check job...');
    try {
      await processOverdueBills(io);
      logger.info('Overdue bill check completed successfully');
    } catch (error) {
      logger.error('Error in overdue bill check job:', error);
    }
  });

  return overdueBillJob;
};

/**
 * Initialize subscription renewal reminder job
 * Runs daily at 8:00 AM
 */
export const initializeSubscriptionReminderJob = (io) => {
  const subscriptionReminderJob = cron.schedule('0 8 * * *', async () => {
    logger.info('Starting subscription renewal reminder job...');
    try {
      await processSubscriptionReminders(io);
      logger.info('Subscription reminder job completed successfully');
    } catch (error) {
      logger.error('Error in subscription reminder job:', error);
    }
  });

  return subscriptionReminderJob;
};

/**
 * Process bill reminders
 */
async function processBillReminders(io) {
  try {
    // Get upcoming bills for the next 30 days
    const now = new Date();
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 30);

    const upcomingBills = await Bill.find({
      isActive: true,
      nextDueDate: {
        $gte: now,
        $lte: futureDate,
      },
    });

    logger.info(`Found ${upcomingBills.length} upcoming bills to process`);

    for (const bill of upcomingBills) {
      const daysUntilDue = bill.daysUntilDue;

      // Check if reminder should be sent based on remindDaysBefore
      if (daysUntilDue <= bill.remindDaysBefore && daysUntilDue > 0) {
        // Check if alert already sent today
        if (!bill.hasAlertBeenSent('due_soon')) {
          logger.info(`Sending reminder for bill: ${bill.name} (${bill._id})`);

          await notificationService.sendBillReminder(
            bill.userId,
            bill,
            daysUntilDue,
            io
          );

          // Mark alert as sent
          bill.addAlert('due_soon');
          await bill.save();
        }
      }

      // Send urgent alert if due today
      if (daysUntilDue === 0 && !bill.hasAlertBeenSent('due_today')) {
        logger.info(`Sending urgent reminder for bill due today: ${bill.name}`);

        await notificationService.sendBillReminder(bill.userId, bill, 0, io);

        bill.addAlert('due_today');
        await bill.save();
      }
    }
  } catch (error) {
    logger.error('Error processing bill reminders:', error);
    throw error;
  }
}

/**
 * Process overdue bills
 */
async function processOverdueBills(io) {
  try {
    const overdueBills = await Bill.findOverdue(null); // Gets all overdue

    logger.info(`Found ${overdueBills.length} overdue bills`);

    for (const bill of overdueBills) {
      if (!bill.hasAlertBeenSent('overdue')) {
        logger.warn(`Bill overdue: ${bill.name} (user: ${bill.userId})`);

        // Send urgent notification
        await notificationService.sendBillReminder(
          bill.userId,
          bill,
          bill.daysUntilDue,
          io
        );

        bill.addAlert('overdue');
        await bill.save();
      }
    }
  } catch (error) {
    logger.error('Error processing overdue bills:', error);
    throw error;
  }
}

/**
 * Process subscription renewal reminders
 */
async function processSubscriptionReminders(io) {
  try {
    const Subscription = (await import('../models/Subscription.js')).default;

    // Get subscriptions renewing within 7 days
    const now = new Date();
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 7);

    const subscriptions = await Subscription.find({
      isActive: true,
      renewalDate: {
        $gte: now,
        $lte: futureDate,
      },
    });

    logger.info(`Found ${subscriptions.length} subscriptions renewing soon`);

    for (const subscription of subscriptions) {
      const daysUntilRenewal = Math.ceil(
        (subscription.renewalDate - now) / (1000 * 60 * 60 * 24)
      );

      logger.info(
        `Sending renewal reminder for subscription: ${subscription.name}`
      );

      await notificationService.sendSubscriptionReminder(
        subscription.userId,
        subscription,
        daysUntilRenewal,
        io
      );
    }
  } catch (error) {
    logger.error('Error processing subscription reminders:', error);
    // Don't throw - this is a secondary job
  }
}

/**
 * Stop all cron jobs
 */
export const stopAllJobs = (jobs) => {
  jobs.forEach((job) => {
    if (job) {
      job.stop();
      logger.info('Cron job stopped');
    }
  });
};

export default {
  initializeBillReminderJob,
  initializeOverdueBillJob,
  initializeSubscriptionReminderJob,
  stopAllJobs,
};
