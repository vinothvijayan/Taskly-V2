package com.example.vinoth;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.util.Log;

import androidx.core.app.NotificationCompat;

public class NotificationReceiver extends BroadcastReceiver {

    public static final String NOTIFICATION_CHANNEL_ID = "call_reminder_channel";
    public static final String EXTRA_CONTACT_NAME = "contact_name";
    public static final String EXTRA_CONTACT_PHONE = "contact_phone";
    public static final String EXTRA_NOTIFICATION_ID = "notification_id";
    // We need the constants from MainActivity here
    public static final String ACTION_START_REMINDER_CALL = "com.example.vinoth.ACTION_START_REMINDER_CALL";

    @Override
    public void onReceive(Context context, Intent intent) {
        String contactName = intent.getStringExtra(EXTRA_CONTACT_NAME);
        String contactPhone = intent.getStringExtra(EXTRA_CONTACT_PHONE);
        int notificationId = intent.getIntExtra(EXTRA_NOTIFICATION_ID, 0);

        if (contactPhone == null || contactPhone.isEmpty()) {
            Log.e("NotificationReceiver", "Received intent with no phone number.");
            return;
        }

        NotificationManager notificationManager = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);

        // This part is fine, it creates the channel if it doesn't exist
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            CharSequence name = "Call Reminders";
            String description = "Channel for call reminder notifications";
            int importance = NotificationManager.IMPORTANCE_HIGH;
            NotificationChannel channel = new NotificationChannel(NOTIFICATION_CHANNEL_ID, name, importance);
            channel.setDescription(description);
            notificationManager.createNotificationChannel(channel);
        }

        // --- Action for tapping the notification BODY ---
        // This will just open the app.
        Intent mainActivityIntent = new Intent(context, MainActivity.class);
        mainActivityIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TASK);
        PendingIntent mainContentPendingIntent = PendingIntent.getActivity(context, notificationId, mainActivityIntent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);


        // --- NEW MODIFIED: Action for "Call Now" button ---
        // This intent now points to MainActivity with a special action
        Intent callFromAppIntent = new Intent(context, MainActivity.class);
        callFromAppIntent.setAction(ACTION_START_REMINDER_CALL); // Our custom action
        callFromAppIntent.putExtra(EXTRA_CONTACT_PHONE, contactPhone); // Pass the phone number
        callFromAppIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent callFromAppPendingIntent = PendingIntent.getActivity(
                context,
                notificationId + 1, // Use a unique request code
                callFromAppIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );


        // --- Action for "Snooze" button (This remains the same) ---
        Intent snoozeIntent = new Intent(context, SnoozeReceiver.class);
        snoozeIntent.putExtra(EXTRA_CONTACT_NAME, contactName);
        snoozeIntent.putExtra(EXTRA_CONTACT_PHONE, contactPhone);
        snoozeIntent.putExtra(EXTRA_NOTIFICATION_ID, notificationId);
        PendingIntent snoozePendingIntent = PendingIntent.getBroadcast(
                context,
                notificationId + 2, // Use a unique request code
                snoozeIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );


        NotificationCompat.Builder builder = new NotificationCompat.Builder(context, NOTIFICATION_CHANNEL_ID)
                .setSmallIcon(R.drawable.baseline_call_24)
                .setContentTitle("Call Reminder: " + contactName)
                .setContentText("Tap 'Call' to dial from the app.")
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setContentIntent(mainContentPendingIntent) // Tapping body opens app
                .setAutoCancel(true)
                .setDefaults(Notification.DEFAULT_ALL)
                // --- Add action buttons with the CORRECTED call intent ---
                .addAction(R.drawable.baseline_call_24, "Call", callFromAppPendingIntent)
                .addAction(R.drawable.baseline_access_time_24, "Snooze 15 Min", snoozePendingIntent);

        notificationManager.notify(notificationId, builder.build());
    }
}