package com.example.vinoth;

import android.accessibilityservice.AccessibilityService;
import android.content.Context;
import android.content.Intent;
import android.media.MediaRecorder;
import android.os.Environment;
import android.telephony.PhoneStateListener;
import android.telephony.TelephonyManager;
import android.util.Log;
import android.view.accessibility.AccessibilityEvent;

import java.io.File;
import java.io.IOException;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;

public class CallRecordingService extends AccessibilityService {

    private static final String TAG = "CallRecordingService";
    private MediaRecorder mediaRecorder;
    private boolean isRecording = false;
    private TelephonyManager telephonyManager;
    private PhoneStateListener phoneStateListener;

    @Override
    protected void onServiceConnected() {
        super.onServiceConnected();
        Log.d(TAG, "Accessibility Service connected.");

        telephonyManager = (TelephonyManager) getSystemService(Context.TELEPHONY_SERVICE);
        phoneStateListener = new PhoneStateListener() {
            @Override
            public void onCallStateChanged(int state, String phoneNumber) {
                super.onCallStateChanged(state, phoneNumber);
                switch (state) {
                    case TelephonyManager.CALL_STATE_OFFHOOK: // Call is active
                        if (!isRecording) {
                            Log.d(TAG, "Call is active. Starting recording.");
                            startRecording();
                        }
                        break;
                    case TelephonyManager.CALL_STATE_IDLE: // Call has ended
                        if (isRecording) {
                            Log.d(TAG, "Call is idle. Stopping recording.");
                            stopRecording();
                        }
                        break;
                    case TelephonyManager.CALL_STATE_RINGING:
                        // Could log ringing state if needed
                        break;
                }
            }
        };

        telephonyManager.listen(phoneStateListener, PhoneStateListener.LISTEN_CALL_STATE);
    }

    private void startRecording() {
        // IMPORTANT: On modern Android, VOICE_CALL is blocked. We use the microphone.
        // This is a workaround and may have limitations.
        // VOICE_RECOGNITION can sometimes provide better results than MIC.
        mediaRecorder = new MediaRecorder();
        mediaRecorder.setAudioSource(MediaRecorder.AudioSource.VOICE_RECOGNITION);
        mediaRecorder.setOutputFormat(MediaRecorder.OutputFormat.AMR_NB);
        mediaRecorder.setAudioEncoder(MediaRecorder.AudioEncoder.AMR_NB);

        File outputFile = createOutputFile();
        if (outputFile == null) {
            Log.e(TAG, "Could not create output file for recording.");
            return;
        }
        mediaRecorder.setOutputFile(outputFile.getAbsolutePath());

        try {
            mediaRecorder.prepare();
            mediaRecorder.start();
            isRecording = true;
            Log.i(TAG, "Recording started successfully. File: " + outputFile.getAbsolutePath());
        } catch (IOException e) {
            Log.e(TAG, "MediaRecorder prepare() failed", e);
            isRecording = false;
            mediaRecorder = null;
        }
    }

    private void stopRecording() {
        if (mediaRecorder != null) {
            try {
                mediaRecorder.stop();
                mediaRecorder.release();
            } catch (Exception e) {
                Log.e(TAG, "Error stopping MediaRecorder", e);
            }
        }
        mediaRecorder = null;
        isRecording = false;
        Log.i(TAG, "Recording stopped.");
    }

    private File createOutputFile() {
        File recordingsDir = new File(getExternalFilesDir(null), "CallRecordings");
        if (!recordingsDir.exists()) {
            if (!recordingsDir.mkdirs()) {
                Log.e(TAG, "Failed to create recordings directory.");
                return null;
            }
        }
        String timestamp = new SimpleDateFormat("yyyyMMdd_HHmmss", Locale.getDefault()).format(new Date());
        return new File(recordingsDir, "REC_" + timestamp + ".amr");
    }

    @Override
    public void onAccessibilityEvent(AccessibilityEvent event) {
        // We don't need to handle any specific events for this purpose.
    }

    @Override
    public void onInterrupt() {
        // This service does not need to be interrupted.
    }

    @Override
    public boolean onUnbind(Intent intent) {
        Log.d(TAG, "Accessibility Service unbound.");
        if (phoneStateListener != null) {
            telephonyManager.listen(phoneStateListener, PhoneStateListener.LISTEN_NONE);
        }
        stopRecording();
        return super.onUnbind(intent);
    }
}