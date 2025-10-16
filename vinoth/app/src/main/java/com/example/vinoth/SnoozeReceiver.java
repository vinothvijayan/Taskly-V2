package com.example.vinoth;

import android.app.AlarmManager;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.util.Log;

import java.util.Calendar;
import java.util.Date;

public class SnoozeReceiver extends BroadcastReceiver {
    private static final long SNOOZE_DURATION_MS = 15 * 60 * 1000; // 15 minutes

    @Override
    public void onReceive(Context context, Intent intent) {
        // Cancel the original notification that was tapped
        int notificationId = intent.getIntExtra(NotificationReceiver.EXTRA_NOTIFICATION_ID, 0);
        if (notificationId != 0) {
            NotificationManager notificationManager = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
            notificationManager.cancel(notificationId);
        }

        // Reschedule the alarm for 15 minutes in the future
        String contactName = intent.getStringExtra(NotificationReceiver.EXTRA_CONTACT_NAME);
        String contactPhone = intent.getStringExtra(NotificationReceiver.EXTRA_CONTACT_PHONE);

        Calendar calendar = Calendar.getInstance();
        calendar.add(Calendar.MILLISECOND, (int) SNOOZE_DURATION_MS);
        long snoozeTimeInMillis = calendar.getTimeInMillis();

        AlarmManager alarmManager = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        if (alarmManager == null) return;

        Intent newAlarmIntent = new Intent(context, NotificationReceiver.class);
        newAlarmIntent.putExtra(NotificationReceiver.EXTRA_CONTACT_NAME, contactName);
        newAlarmIntent.putExtra(NotificationReceiver.EXTRA_CONTACT_PHONE, contactPhone);
        newAlarmIntent.putExtra(NotificationReceiver.EXTRA_NOTIFICATION_ID, notificationId);

        PendingIntent pendingIntent = PendingIntent.getBroadcast(context, notificationId, newAlarmIntent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        if (alarmManager.canScheduleExactAlarms()) {
            alarmManager.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, snoozeTimeInMillis, pendingIntent);
            Log.d("SnoozeReceiver", "Notification snoozed for " + contactName + ". New time: " + new Date(snoozeTimeInMillis));
        }
    }
}