package com.example.vinoth;

import android.Manifest;
import android.annotation.SuppressLint;
import android.app.Activity;
import android.app.AlarmManager;
import android.app.DatePickerDialog;
import android.app.Dialog;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.TimePickerDialog;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.content.res.AssetManager;
import android.graphics.Color;
import android.graphics.drawable.ColorDrawable;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.CountDownTimer;
import android.os.Environment;
import android.os.Handler;
import android.os.Parcelable;
import android.os.SystemClock;
import android.provider.Settings;
import android.text.Html;
import android.util.Log;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.view.Window;
import android.widget.Button;
import android.widget.EditText;
import android.widget.FrameLayout;
import android.widget.ImageButton;
import android.widget.LinearLayout;
import android.widget.RadioButton;
import android.widget.RadioGroup;
import android.widget.TextView;
import android.widget.Toast;

import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.contract.ActivityResultContracts;
import androidx.annotation.NonNull;
import androidx.appcompat.app.AppCompatActivity;
import androidx.cardview.widget.CardView;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;

import com.android.volley.Request;
import com.android.volley.RequestQueue;
import com.android.volley.toolbox.JsonObjectRequest;
import com.android.volley.toolbox.Volley;
import com.google.android.material.floatingactionbutton.FloatingActionButton;
import com.google.firebase.auth.FirebaseAuth;
import com.google.firebase.auth.FirebaseUser;
import com.google.firebase.database.DataSnapshot;
import com.google.firebase.database.DatabaseError;
import com.google.firebase.database.DatabaseException;
import com.google.firebase.database.DatabaseReference;
import com.google.firebase.database.FirebaseDatabase;
import com.google.firebase.database.GenericTypeIndicator;
import com.google.firebase.database.ServerValue;
import com.google.firebase.database.ValueEventListener;

import org.json.JSONException;
import org.json.JSONObject;

import org.apache.poi.ss.usermodel.Cell;
import org.apache.poi.ss.usermodel.DataFormatter;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.ss.usermodel.Workbook;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;

import java.io.BufferedReader;
import java.io.File;
import java.io.FileOutputStream;
import java.io.FileReader;
import java.io.FileWriter;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.text.ParseException;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Calendar;
import java.util.Collections;
import java.util.Date;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Properties;
import java.util.Set;
import java.util.stream.Collectors;

import javax.mail.Authenticator;
import javax.mail.Message;
import javax.mail.MessagingException;
import javax.mail.PasswordAuthentication;
import javax.mail.Session;
import javax.mail.Transport;
import javax.mail.internet.InternetAddress;
import javax.mail.internet.MimeBodyPart;
import javax.mail.internet.MimeMessage;
import javax.mail.internet.MimeMultipart;

public class MainActivity extends AppCompatActivity {
    // Permission Request Codes
    public static final String EXTRA_CONTACT_PHONE = "contact_phone";
    public static final String ACTION_START_REMINDER_CALL = "com.example.vinoth.ACTION_START_REMINDER_CALL";
    private static final int REQUEST_CALL_PHONE_PERMISSION = 2;

    private static final int CALL_DELAY_MS = 5000;
    private static final String LOG_TAG_CSV = "CsvLogic";
    private static final String LOG_TAG_EMAIL = "EmailError";
    private static final String LOG_TAG_SHEET = "GoogleSheetUpdate";
    private static final String LOG_TAG_LIFECYCLE = "LifecycleState";
    private static final String LOG_TAG_NOTIFICATION = "NotificationLogic";
    private static final String LOG_TAG_FIREBASE = "Firebase";

    // CSV Seeding Configuration
    private static final String INITIAL_MASTER_DATA_ASSET_FILENAME = "initial_master_data.csv";
    private static final String CSV_FILENAME = "Calls Sheet - finalcheck.csv";

    // UI Elements
    private TextView currentNumberTextView;
    private Button startButton, uploadButton, finishedButton, submitFeedbackButton, btnSignIn;
    private RadioGroup feedbackRadioGroup;
    private EditText messageEditText, emailEditText, spokenToNameEditText;
    private CardView callingInfoCard;
    private Button viewHistoryButton;
    private LinearLayout reminderLayout;
    private Button setReminderButton;
    private TextView reminderSetTextView;
    private Button btnSyncCsvToFirebase;
    private FrameLayout loadingOverlay;

    // Data & State
    private List<Contact> dialingContactsList = new ArrayList<>();
    private Map<String, Contact> masterContactsData = new LinkedHashMap<>();
    private int currentContactIndex = 0;
    private boolean callInProgress = false;
    private boolean dialingStarted = false;
    private boolean isPaused = false;
    private long callStartTime;
    private Set<String> numbersCalledThisSession = new HashSet<>();
    private boolean allCallsCompleted = false;
    private Calendar reminderCalendar;
    private boolean manualCallInProgress = false;
    private Calendar fromDateCalendar;
    private Calendar toDateCalendar;

    // Timers & Handlers
    private CountDownTimer countDownTimer;
    private final Handler handler = new Handler();
    private long timeRemaining = CALL_DELAY_MS;

    // Networking (Volley)
    private RequestQueue requestQueue;
    private static final String GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyBjLkatZezaQRCfINZuYCfC6Bwz89lP6BXkW-87VY32u9ly5gfJXxc2Pi9Cx8r4YXJdQ/exec";

    // Email Credentials
    private static final String EMAIL_USERNAME = "support@thehypeloop.com";
    private static final String EMAIL_PASSWORD = "uaxu gqxz hpgi ajlw";
    private String callStartTimestamp;

    // Firebase
    private FirebaseAuth mAuth;
    private DatabaseReference mDatabase;
    private DatabaseReference dialerSessionRef;
    private ValueEventListener sessionListener;


    // Keys for saving instance state
    private static final String KEY_DIALING_CONTACTS_LIST = "dialingContactsList";
    private static final String KEY_CURRENT_CONTACT_INDEX = "currentContactIndex";
    private static final String KEY_CALL_IN_PROGRESS = "callInProgress";
    private static final String KEY_DIALING_STARTED = "dialingStarted";
    private static final String KEY_IS_PAUSED = "isPaused";
    private static final String KEY_CALL_START_TIME = "callStartTime";
    private static final String KEY_NUMBERS_CALLED_SESSION = "numbersCalledThisSession";
    private static final String KEY_ALL_CALLS_COMPLETED = "allCallsCompleted";
    private static final String KEY_TIME_REMAINING = "timeRemaining";
    private static final String KEY_CURRENT_NUMBER_TEXT = "currentNumberText";
    private static final String KEY_MESSAGE_EDIT_TEXT = "messageEditText";
    private static final String KEY_SPOKEN_TO_NAME_EDIT_TEXT = "spokenToNameEditText";
    private static final String KEY_EMAIL_EDIT_TEXT = "emailEditText";
    private static final String KEY_FEEDBACK_RADIO_ID = "feedbackRadioId";
    private static final String KEY_UPLOAD_BTN_VISIBLE = "uploadBtnVisible";
    private static final String KEY_START_BTN_ENABLED = "startBtnEnabled";
    private static final String KEY_START_BTN_TEXT = "startBtnText";
    private static final String KEY_FINISHED_BTN_VISIBLE = "finishedBtnVisible";
    private static final String KEY_EMAIL_FIELD_VISIBLE = "emailFieldVisible";

    private final ActivityResultLauncher<String> notificationPermissionLauncher = registerForActivityResult(
            new ActivityResultContracts.RequestPermission(),
            isGranted -> {
                if (!isGranted) {
                    Toast.makeText(this, "Notification permission denied. Reminders will not work.", Toast.LENGTH_SHORT).show();
                }
            }
    );

    private final ActivityResultLauncher<Intent> manageStoragePermissionLauncher = registerForActivityResult(
            new ActivityResultContracts.StartActivityForResult(),
            result -> {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                    if (Environment.isExternalStorageManager()) {
                        Log.d(LOG_TAG_LIFECYCLE, "MANAGE_EXTERNAL_STORAGE Permission Granted.");
                        // seedAndLoadMasterContacts(); // No longer loading from CSV on startup
                    } else {
                        Toast.makeText(this, "File access permission is required to load contacts.", Toast.LENGTH_LONG).show();
                    }
                }
            }
    );

    private final ActivityResultLauncher<Intent> filePickerLauncher = registerForActivityResult(
            new ActivityResultContracts.StartActivityForResult(),
            result -> {
                if (result.getResultCode() == Activity.RESULT_OK && result.getData() != null) {
                    Uri fileUri = result.getData().getData();
                    if (fileUri != null) {
                        parseExcelFile(fileUri);
                    }
                }
            }
    );

    private final ActivityResultLauncher<String> csvWritePermissionLauncher = registerForActivityResult(
            new ActivityResultContracts.RequestPermission(),
            isGranted -> {
                if (isGranted) {
                    Log.d(LOG_TAG_LIFECYCLE, "Legacy WRITE permission granted.");
                    // seedAndLoadMasterContacts(); // No longer loading from CSV on startup
                } else {
                    Toast.makeText(this, "Write Storage permission for CSV denied.", Toast.LENGTH_SHORT).show();
                }
            }
    );

    private void handleReminderIntent(Intent intent) {
        if (intent == null || intent.getAction() == null) {
            return;
        }

        if (ACTION_START_REMINDER_CALL.equals(intent.getAction())) {
            String phoneNumber = intent.getStringExtra(EXTRA_CONTACT_PHONE);
            Log.d(LOG_TAG_NOTIFICATION, "Handling reminder call for: " + phoneNumber);

            if (phoneNumber != null && !phoneNumber.isEmpty()) {
                Contact contactToCall = masterContactsData.get(normalizePhoneNumber(phoneNumber));
                String contactName = (contactToCall != null) ? contactToCall.getName() : phoneNumber;
                startManualCall(phoneNumber, "");
                intent.setAction(null);
            }
        }
    }
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);
        Log.d(LOG_TAG_LIFECYCLE, "onCreate");

        mAuth = FirebaseAuth.getInstance();
        mDatabase = FirebaseDatabase.getInstance().getReference();
        requestQueue = Volley.newRequestQueue(this);

        btnSignIn = findViewById(R.id.btnSignIn);
        uploadButton = findViewById(R.id.uploadButton);
        startButton = findViewById(R.id.startButton);
        feedbackRadioGroup = findViewById(R.id.feedbackRadioGroup);
        messageEditText = findViewById(R.id.messageEditText);
        submitFeedbackButton = findViewById(R.id.submitFeedbackButton);
        emailEditText = findViewById(R.id.emailEditText);
        finishedButton = findViewById(R.id.finishedButton);
        callingInfoCard = findViewById(R.id.callingInfoCard);
        currentNumberTextView = findViewById(R.id.currentNumberTextView);
        viewHistoryButton = findViewById(R.id.viewHistoryButton);
        reminderLayout = findViewById(R.id.reminderLayout);
        setReminderButton = findViewById(R.id.setReminderButton);
        reminderSetTextView = findViewById(R.id.reminderSetTextView);
        spokenToNameEditText = findViewById(R.id.spokenToNameEditText);
        btnSyncCsvToFirebase = findViewById(R.id.btnSyncCsvToFirebase);
        loadingOverlay = findViewById(R.id.loadingOverlay);

        if (savedInstanceState != null) {
            Log.d(LOG_TAG_LIFECYCLE, "Restoring from savedInstanceState");
            restoreState(savedInstanceState);
        }

        setupListeners();
        checkAndRequestPermissions();
        createNotificationChannel();
        loadContactsFromFirebase(); // Load data from Firebase on startup
        handleReminderIntent(getIntent());
    }

    @Override
    protected void onStart() {
        super.onStart();
        FirebaseUser currentUser = mAuth.getCurrentUser();
        updateUI(currentUser);
    }

    private void updateUI(FirebaseUser user) {
        if (user != null) {
            // User is signed in, hide sign-in button
            btnSignIn.setVisibility(View.GONE);
        } else {
            // No user is signed in, show sign-in button
            btnSignIn.setVisibility(View.VISIBLE);
        }
    }

    private void signInAnonymously() {
        setLoadingState(true);
        mAuth.signInAnonymously()
                .addOnCompleteListener(this, task -> {
                    if (task.isSuccessful()) {
                        Log.d(LOG_TAG_FIREBASE, "signInAnonymously:success");
                        FirebaseUser user = mAuth.getCurrentUser();
                        Toast.makeText(MainActivity.this, "Connected to Web Dashboard.", Toast.LENGTH_SHORT).show();
                        updateUI(user);
                    } else {
                        Log.w(LOG_TAG_FIREBASE, "signInAnonymously:failure", task.getException());
                        Toast.makeText(MainActivity.this, "Authentication failed.", Toast.LENGTH_SHORT).show();
                        updateUI(null);
                    }
                    setLoadingState(false);
                });
    }

    private void setLoadingState(boolean isLoading) {
        if (isLoading) {
            loadingOverlay.setVisibility(View.VISIBLE);
        } else {
            loadingOverlay.setVisibility(View.GONE);
        }
    }

    private void loadContactsFromFirebase() {
        setLoadingState(true);
        DatabaseReference contactsRef = mDatabase.child("contacts");

        contactsRef.addValueEventListener(new ValueEventListener() {
            @Override
            public void onDataChange(@NonNull DataSnapshot dataSnapshot) {
                masterContactsData.clear();
                for (DataSnapshot snapshot : dataSnapshot.getChildren()) {
                    try {
                        Contact contact = snapshot.getValue(Contact.class);
                        if (contact != null && contact.getPhoneNumber() != null) {
                            // The key is the phone number, so we can ensure it's set
                            if (contact.getPhoneNumber().isEmpty()) {
                                contact.setPhoneNumber(snapshot.getKey());
                            }
                            masterContactsData.put(contact.getPhoneNumber(), contact);
                        }
                    } catch (DatabaseException e) {
                        Log.e(LOG_TAG_FIREBASE, "Failed to parse contact", e);
                    }
                }
                Log.i(LOG_TAG_FIREBASE, "Loaded " + masterContactsData.size() + " contacts from Firebase.");
                Toast.makeText(MainActivity.this, "Loaded " + masterContactsData.size() + " contacts from Firebase.", Toast.LENGTH_SHORT).show();
                setLoadingState(false);
                updateUiAfterRestoreOrInit(); // This will re-evaluate button states etc.
            }

            @Override
            public void onCancelled(@NonNull DatabaseError databaseError) {
                Log.e(LOG_TAG_FIREBASE, "Failed to load contacts from Firebase.", databaseError.toException());
                Toast.makeText(MainActivity.this, "Failed to load contacts from Firebase.", Toast.LENGTH_LONG).show();
                setLoadingState(false);
            }
        });
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        Log.d(LOG_TAG_LIFECYCLE, "onNewIntent received");
        handleReminderIntent(intent);
    }

    private void checkAndEnableCallRecording() {
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED ||
                ContextCompat.checkSelfPermission(this, Manifest.permission.READ_PHONE_STATE) != PackageManager.PERMISSION_GRANTED) {

            ActivityCompat.requestPermissions(this,
                    new String[]{Manifest.permission.RECORD_AUDIO, Manifest.permission.READ_PHONE_STATE},
                    999);
            Toast.makeText(this, "Please grant permissions to record calls.", Toast.LENGTH_LONG).show();
            return;
        }

        if (!isAccessibilityServiceEnabled()) {
            Toast.makeText(this, "Please enable the Call Recording service in Accessibility settings.", Toast.LENGTH_LONG).show();
            Intent intent = new Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS);
            startActivity(intent);
        } else {
            Toast.makeText(this, "Call recording service is active.", Toast.LENGTH_SHORT).show();
        }
    }

    private boolean isAccessibilityServiceEnabled() {
        String serviceId = getPackageName() + "/" + CallRecordingService.class.getName();
        try {
            int accessibilityEnabled = Settings.Secure.getInt(
                    getContentResolver(),
                    Settings.Secure.ACCESSIBILITY_ENABLED);
            if (accessibilityEnabled == 1) {
                String settingValue = Settings.Secure.getString(
                        getContentResolver(),
                        Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES);
                if (settingValue != null) {
                    return settingValue.contains(serviceId);
                }
            }
        } catch (Settings.SettingNotFoundException e) {
            Log.e("MainActivity", "Error finding accessibility setting", e);
        }
        return false;
    }

    private void setupListeners() {
        btnSignIn.setOnClickListener(v -> signInAnonymously());

        feedbackRadioGroup.setOnCheckedChangeListener((group, checkedId) -> {
            RadioButton callbackRadio = findViewById(R.id.radioCallback);
            if (callbackRadio != null && checkedId == callbackRadio.getId()) {
                reminderLayout.setVisibility(View.VISIBLE);
            } else {
                reminderLayout.setVisibility(View.GONE);
                reminderCalendar = null;
                reminderSetTextView.setText("");
            }
        });

        setReminderButton.setOnClickListener(v -> showDateTimePicker());
        uploadButton.setOnClickListener(v -> openFilePicker());
        startButton.setOnClickListener(v -> {
            if (!dialingStarted || allCallsCompleted) {
                fetchQueueAndStartDialing();
            } else {
                togglePauseResume();
            }
        });
        submitFeedbackButton.setOnClickListener(v -> submitFeedback());
        finishedButton.setOnClickListener(v -> {
            String userEmail = emailEditText.getText().toString().trim();
            if (userEmail.isEmpty() || !android.util.Patterns.EMAIL_ADDRESS.matcher(userEmail).matches()) {
                Toast.makeText(this, "Please enter a valid email address", Toast.LENGTH_SHORT).show();
                return;
            }
            sendEmail(userEmail);
        });

        Button btnDialFiltered = findViewById(R.id.btnDialFiltered);
        btnDialFiltered.setOnClickListener(v -> {
            if (masterContactsData.isEmpty()) {
                Toast.makeText(this, "Master data is empty. Cannot create a list.", Toast.LENGTH_SHORT).show();
            } else {
                showFilterDialog();
            }
        });

        FloatingActionButton fabManualDial = findViewById(R.id.fabManualDial);
        fabManualDial.setOnClickListener(v -> {
            if (callInProgress || (countDownTimer != null)) {
                Toast.makeText(this, "Please wait for the current call to finish.", Toast.LENGTH_SHORT).show();
            } else {
                showManualDialDialog();
            }
        });
        Button btnEnableRecording = findViewById(R.id.btnEnableRecording);

        if (btnEnableRecording != null) {
            btnEnableRecording.setOnClickListener(v -> checkAndEnableCallRecording());
        }

        btnSyncCsvToFirebase.setOnClickListener(v -> {
            Toast.makeText(this, "Starting sync of historical CSV to Firebase...", Toast.LENGTH_SHORT).show();
            syncMasterDataToFirebase();
        });
    }

    private void checkAndRequestPermissions() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            if (!Environment.isExternalStorageManager()) {
                requestManageStoragePermission();
            }
        } else {
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.WRITE_EXTERNAL_STORAGE) != PackageManager.PERMISSION_GRANTED) {
                csvWritePermissionLauncher.launch(Manifest.permission.WRITE_EXTERNAL_STORAGE);
            }
        }

        if (!checkCallPermission()) {
            requestCallPermission();
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
                notificationPermissionLauncher.launch(Manifest.permission.POST_NOTIFICATIONS);
            }
        }
    }

    private void requestManageStoragePermission() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            try {
                Intent intent = new Intent(Settings.ACTION_MANAGE_APP_ALL_FILES_ACCESS_PERMISSION);
                intent.addCategory("android.intent.category.DEFAULT");
                intent.setData(Uri.parse(String.format("package:%s", getApplicationContext().getPackageName())));
                manageStoragePermissionLauncher.launch(intent);
            } catch (Exception e) {
                Intent intent = new Intent();
                intent.setAction(Settings.ACTION_MANAGE_ALL_FILES_ACCESS_PERMISSION);
                manageStoragePermissionLauncher.launch(intent);
            }
        }
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            CharSequence name = "Call Reminders";
            String description = "Channel for call reminder notifications";
            int importance = NotificationManager.IMPORTANCE_HIGH;
            NotificationChannel channel = new NotificationChannel(NotificationReceiver.NOTIFICATION_CHANNEL_ID, name, importance);
            channel.setDescription(description);
            NotificationManager notificationManager = getSystemService(NotificationManager.class);
            notificationManager.createNotificationChannel(channel);
        }
    }

    private void showDateTimePicker() {
        final Calendar currentDate = Calendar.getInstance();
        new DatePickerDialog(this, (view, year, month, dayOfMonth) -> {
            reminderCalendar = Calendar.getInstance();
            reminderCalendar.set(year, month, dayOfMonth);
            new TimePickerDialog(this, (view1, hourOfDay, minute) -> {
                reminderCalendar.set(Calendar.HOUR_OF_DAY, hourOfDay);
                reminderCalendar.set(Calendar.MINUTE, minute);
                reminderCalendar.set(Calendar.SECOND, 0);

                if (reminderCalendar.getTimeInMillis() <= System.currentTimeMillis()) {
                    Toast.makeText(this, "Please select a future time.", Toast.LENGTH_SHORT).show();
                    reminderCalendar = null;
                    reminderSetTextView.setText("");
                    return;
                }

                String formattedTime = new SimpleDateFormat("MMM d, yyyy 'at' h:mm a", Locale.getDefault()).format(reminderCalendar.getTime());
                reminderSetTextView.setText("Reminder for: " + formattedTime);
                Toast.makeText(this, "Reminder set!", Toast.LENGTH_SHORT).show();

            }, currentDate.get(Calendar.HOUR_OF_DAY), currentDate.get(Calendar.MINUTE), false).show();
        }, currentDate.get(Calendar.YEAR), currentDate.get(Calendar.MONTH), currentDate.get(Calendar.DATE)).show();
    }

    private void scheduleNotification(Contact contact, long timeInMillis) {
        AlarmManager alarmManager = (AlarmManager) getSystemService(Context.ALARM_SERVICE);
        if (alarmManager == null) {
            Toast.makeText(this, "Cannot access Alarm Service.", Toast.LENGTH_SHORT).show();
            return;
        }

        Intent intent = new Intent(this, NotificationReceiver.class);
        intent.putExtra(NotificationReceiver.EXTRA_CONTACT_NAME, contact.getName());
        intent.putExtra(NotificationReceiver.EXTRA_CONTACT_PHONE, contact.getPhoneNumber());
        int notificationId = contact.getPhoneNumber().hashCode();
        intent.putExtra(NotificationReceiver.EXTRA_NOTIFICATION_ID, notificationId);

        PendingIntent pendingIntent = PendingIntent.getBroadcast(this, notificationId, intent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S && !alarmManager.canScheduleExactAlarms()) {
            Toast.makeText(this, "Exact alarm permission not granted. Reminder may be delayed.", Toast.LENGTH_LONG).show();
        }

        alarmManager.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, timeInMillis, pendingIntent);
        Log.d(LOG_TAG_NOTIFICATION, "Reminder scheduled for " + contact.getName() + " at " + new Date(timeInMillis));
    }

    private void seedAndLoadMasterContacts() {
        File downloadsDir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS);
        if (downloadsDir == null) {
            Log.e(LOG_TAG_CSV, "Downloads directory is null.");
            Toast.makeText(this, "Error: Downloads directory not accessible.", Toast.LENGTH_LONG).show();
            if (masterContactsData == null) masterContactsData = new LinkedHashMap<>();
            return;
        }
        File masterCsvFile = new File(downloadsDir, CSV_FILENAME);

        Log.d(LOG_TAG_CSV, "Checking for master CSV at: " + masterCsvFile.getAbsolutePath());
        if (!masterCsvFile.exists()) {
            Log.i(LOG_TAG_CSV, CSV_FILENAME + " not found in Downloads. Attempting to seed from assets.");
            copyAssetToDownloads(INITIAL_MASTER_DATA_ASSET_FILENAME, CSV_FILENAME);
        } else {
            Log.i(LOG_TAG_CSV, CSV_FILENAME + " found in Downloads. Will load existing file.");
        }
        loadMasterContactsFromCsv();
    }

    private void copyAssetToDownloads(String assetFileName, String destinationFileNameInDownloads) {
        AssetManager assetManager = getAssets();
        File downloadsDir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS);

        if (downloadsDir == null || (!downloadsDir.exists() && !downloadsDir.mkdirs())) {
            Log.e(LOG_TAG_CSV, "Failed to create Downloads directory.");
            return;
        }
        File outFile = new File(downloadsDir, destinationFileNameInDownloads);
        try (InputStream in = assetManager.open(assetFileName);
             OutputStream out = new FileOutputStream(outFile)) {
            byte[] buffer = new byte[1024];
            int read;
            while ((read = in.read(buffer)) != -1) {
                out.write(buffer, 0, read);
            }
            Log.i(LOG_TAG_CSV, "Successfully copied asset '" + assetFileName + "' to '" + outFile.getAbsolutePath() + "'");
        } catch (IOException e) {
            Log.e(LOG_TAG_CSV, "Failed to copy asset '" + assetFileName + "' to Downloads.", e);
        }
    }

    private void loadMasterContactsFromCsv() {
        masterContactsData.clear();
        File file = new File(Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS), CSV_FILENAME);
        if (!file.exists() || !file.canRead()) {
            Log.e(LOG_TAG_CSV, "Historical master CSV not found: " + file.getAbsolutePath());
            Toast.makeText(this, "Historical master CSV not found.", Toast.LENGTH_LONG).show();
            updateUiAfterRestoreOrInit();
            return;
        }

        try (BufferedReader reader = new BufferedReader(new FileReader(file))) {
            String headerLine = reader.readLine(); // Skip the header row
            if (headerLine == null) {
                Toast.makeText(this, "Master file is empty.", Toast.LENGTH_SHORT).show();
                return;
            }

            String line;
            while ((line = reader.readLine()) != null) {
                if (line.trim().isEmpty()) continue;
                String[] parts = line.split(",(?=(?:[^\"]*\"[^\"]*\")*[^\"]*$)", -1);

                if (parts.length < 13) {
                    Log.w(LOG_TAG_CSV, "Skipping malformed row: " + line);
                    continue;
                }

                try {
                    String name = unescapeCsv(parts[1]);
                    String phone = normalizePhoneNumber(unescapeCsv(parts[2]));

                    if (phone.isEmpty() || name.isEmpty()) {
                        continue;
                    }

                    Contact contact = masterContactsData.getOrDefault(phone, new Contact(name, phone));
                    contact.setName(name);

                    // --- Process the Initial Call Record ---
                    String initialFeedback = unescapeCsv(parts[3]);
                    String initialTimestamp = convertCsvDate(unescapeCsv(parts[5]));
                    if (!initialFeedback.isEmpty() && !initialTimestamp.isEmpty()) {
                        String initialMessage = unescapeCsv(parts[4]);
                        long initialDuration = safeParseLong(parts[6]);
                        String initialSpokenTo = unescapeCsv(parts[7]);
                        CallRecord initialRecord = new CallRecord(initialFeedback, initialMessage, initialTimestamp, initialDuration, initialSpokenTo);
                        contact.getCallHistory().put(initialTimestamp, initialRecord);
                    }

                    // --- Process the Follow-up Call Record ---
                    String followupFeedback = unescapeCsv(parts[8]);
                    String followupTimestamp = convertCsvDate(unescapeCsv(parts[10]));
                    if (!followupFeedback.isEmpty() && !followupTimestamp.isEmpty()) {
                        String followupMessage = unescapeCsv(parts[9]);
                        long followupDuration = safeParseLong(parts[11]);
                        String followupSpokenTo = unescapeCsv(parts[12]);
                        CallRecord followupRecord = new CallRecord(followupFeedback, followupMessage, followupTimestamp, followupDuration, followupSpokenTo);
                        contact.getCallHistory().put(followupTimestamp, followupRecord);
                    }

                    contact.setCallCount(contact.getCallHistory().size());
                    masterContactsData.put(phone, contact);

                } catch (Exception e) {
                    Log.e(LOG_TAG_CSV, "CRITICAL PARSING ERROR on historical data line: " + line, e);
                }
            }
            Toast.makeText(this, "Loaded and processed " + masterContactsData.size() + " historical contacts.", Toast.LENGTH_LONG).show();
        } catch (IOException e) {
            Log.e(LOG_TAG_CSV, "Error reading historical " + CSV_FILENAME, e);
        }
        updateUiAfterRestoreOrInit();
    }

    private void syncMasterDataToFirebase() {
        if (masterContactsData.isEmpty()) {
            Toast.makeText(this, "Load CSV data first before syncing.", Toast.LENGTH_SHORT).show();
            Log.w(LOG_TAG_FIREBASE, "Sync attempted but masterContactsData is empty.");
            return;
        }

        Log.i(LOG_TAG_FIREBASE, "Starting sync of " + masterContactsData.size() + " contacts to Firebase.");
        DatabaseReference contactsRef = mDatabase.child("contacts");

        Map<String, Object> allContactsUpdate = new HashMap<>();
        for (Contact contact : masterContactsData.values()) {
            allContactsUpdate.put(contact.getPhoneNumber(), contact);
        }

        contactsRef.setValue(allContactsUpdate)
                .addOnSuccessListener(aVoid -> {
                    Toast.makeText(MainActivity.this, "Successfully synced all historical data to Firebase!", Toast.LENGTH_LONG).show();
                    Log.i(LOG_TAG_FIREBASE, "Firebase sync completed successfully.");
                })
                .addOnFailureListener(e -> {
                    Toast.makeText(MainActivity.this, "Firebase sync failed: " + e.getMessage(), Toast.LENGTH_LONG).show();
                    Log.e(LOG_TAG_FIREBASE, "Firebase sync failed.", e);
                });
    }

    private long safeParseLong(String value) {
        String cleaned = unescapeCsv(value);
        if (cleaned != null && !cleaned.isEmpty() && cleaned.matches("\\d+")) {
            return Long.parseLong(cleaned);
        }
        return 0;
    }

    /**
     * REWRITTEN FOR ROBUSTNESS: This method now attempts to parse a date string
     * using a list of common formats found in the historical CSV data.
     * It tries each format until one succeeds.
     *
     * @param csvDate The raw date string from the CSV file.
     * @return A standardized date string in "yyyy-MM-dd HH:mm:ss" format, or the original string if all parsing fails.
     */
    private String convertCsvDate(String csvDate) {
        if (csvDate == null || csvDate.isEmpty()) {
            return "";
        }

        List<SimpleDateFormat> knownFormats = new ArrayList<>();
        knownFormats.add(new SimpleDateFormat("yyyy-MM-dd HH:mm:ss", Locale.getDefault()));
        knownFormats.add(new SimpleDateFormat("dd-MM-yyyy HH:mm", Locale.getDefault()));
        knownFormats.add(new SimpleDateFormat("yyyy-MM-dd", Locale.getDefault()));
        knownFormats.add(new SimpleDateFormat("dd-MM-yyyy", Locale.getDefault()));

        SimpleDateFormat outputFormat = new SimpleDateFormat("yyyy-MM-dd HH:mm:ss", Locale.getDefault());

        for (SimpleDateFormat format : knownFormats) {
            try {
                Date date = format.parse(csvDate);
                if (date != null) {
                    return outputFormat.format(date);
                }
            } catch (ParseException e) {
                // Continue to the next format
            }
        }

        Log.w(LOG_TAG_CSV, "Could not parse date with any known format: " + csvDate);
        return csvDate;
    }

    private void saveMasterDataToCsv() {
        File downloadsDir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS);
        if (downloadsDir == null) { return; }
        File file = new File(downloadsDir, "CallFeedbackMaster_New.csv");
        Log.d(LOG_TAG_CSV, "Saving master CSV to: " + file.getAbsolutePath());

        StringBuilder csvData = new StringBuilder();
        csvData.append("\"Name\",\"Phone Number\",\"Last Feedback\",\"Last Message\",\"Last Timestamp\",\"Last Duration(s)\",\"Last Spoken To\"\n");

        for (Contact contact : masterContactsData.values()) {
            CallRecord latestRecord = getLatestCallRecord(contact);

            csvData.append(escapeCsv(contact.getName())).append(",")
                    .append(escapeCsv(contact.getPhoneNumber())).append(",");

            if (latestRecord != null) {
                csvData.append(escapeCsv(latestRecord.getFeedback())).append(",")
                        .append(escapeCsv(latestRecord.getMessage())).append(",")
                        .append(escapeCsv(latestRecord.getTimestamp())).append(",")
                        .append(escapeCsv(String.valueOf(latestRecord.getDuration()))).append(",")
                        .append(escapeCsv(latestRecord.getSpokenToName())).append("\n");
            } else {
                csvData.append(",,,,,\n");
            }
        }
        try (FileWriter writer = new FileWriter(file, false)) {
            writer.write(csvData.toString());
            Log.i(LOG_TAG_CSV, "Master CSV saved with " + masterContactsData.size() + " records.");
        } catch (IOException e) {
            Log.e(LOG_TAG_CSV, "Error writing master CSV", e);
        }
    }

    private String getCellValue(Cell cell) {
        if (cell == null) return "";
        DataFormatter formatter = new DataFormatter();
        try {
            return formatter.formatCellValue(cell).trim();
        } catch (Exception e) {
            Log.w("ExcelParse", "Error formatting cell. Falling back. " + e.getMessage());
            return cell.toString().trim();
        }
    }

    private void parseExcelFile(Uri fileUri) {
        List<Contact> contactsFromExcel = new ArrayList<>();
        try (InputStream inputStream = getContentResolver().openInputStream(fileUri)) {
            if (inputStream == null) { Toast.makeText(this, "Error opening Excel", Toast.LENGTH_SHORT).show(); return; }
            Workbook workbook = new XSSFWorkbook(inputStream);
            Sheet sheet = workbook.getSheetAt(0);
            int rows = sheet.getPhysicalNumberOfRows();
            if (rows <= 1) {
                Toast.makeText(this, "Excel file is empty or has no data rows.", Toast.LENGTH_LONG).show();
                workbook.close();
                return;
            }
            for (int i = 1; i < rows; i++) {
                Row row = sheet.getRow(i);
                if (row == null) continue;
                String name = getCellValue(row.getCell(0));
                String phoneNumber = getCellValue(row.getCell(1));
                String normalizedPhone = normalizePhoneNumber(phoneNumber);
                if (!name.isEmpty() && !normalizedPhone.isEmpty()) {
                    contactsFromExcel.add(new Contact(name, normalizedPhone));
                }
            }
            workbook.close();
        } catch (Exception e) { Log.e("ExcelParse", "Error parsing Excel: ", e); Toast.makeText(this, "Error parsing Excel", Toast.LENGTH_SHORT).show(); return; }

        if (contactsFromExcel.isEmpty()) {
            Toast.makeText(this, "No valid contacts found in the Excel file.", Toast.LENGTH_LONG).show();
            return;
        }

        dialingContactsList.clear();
        numbersCalledThisSession.clear();

        for (Contact excelContact : contactsFromExcel) {
            String phone = excelContact.getPhoneNumber();
            Contact contactToDial = masterContactsData.getOrDefault(phone, new Contact(excelContact.getName(), phone));
            contactToDial.setName(excelContact.getName());

            dialingContactsList.add(contactToDial);
            masterContactsData.put(phone, contactToDial);

            DatabaseReference contactRef = mDatabase.child("contacts").child(phone);
            Map<String, Object> updates = new HashMap<>();
            updates.put("name", contactToDial.getName());
            updates.put("phoneNumber", contactToDial.getPhoneNumber());
            contactRef.updateChildren(updates);
        }

        if (!dialingContactsList.isEmpty()) {
            Toast.makeText(this, dialingContactsList.size() + " contacts prepared for dialing.", Toast.LENGTH_SHORT).show();
            allCallsCompleted = false; currentContactIndex = 0; dialingStarted = false; isPaused = false;
            timeRemaining = CALL_DELAY_MS;
            if (countDownTimer != null) { countDownTimer.cancel(); }
            resetFeedbackUI();
        } else {
            Toast.makeText(this, "No contacts prepared after processing Excel.", Toast.LENGTH_LONG).show();
        }
        updateUiAfterRestoreOrInit();
    }

    private void fetchQueueAndStartDialing() {
        setLoadingState(true);
        Toast.makeText(this, "Checking for dialing list from web...", Toast.LENGTH_SHORT).show();

        DatabaseReference bridgeRef = mDatabase.child("dialerBridge").child("activeWebUser");
        bridgeRef.addListenerForSingleValueEvent(new ValueEventListener() {
            @Override
            public void onDataChange(@NonNull DataSnapshot bridgeSnapshot) {
                String webUserId = bridgeSnapshot.getValue(String.class);
                if (webUserId == null || webUserId.isEmpty()) {
                    Toast.makeText(MainActivity.this, "No dialing list found. Please create one on the web dashboard.", Toast.LENGTH_LONG).show();
                    setLoadingState(false);
                    return;
                }

                Log.d(LOG_TAG_FIREBASE, "Found web user ID in bridge: " + webUserId);
                DatabaseReference queueRef = mDatabase.child("dialingQueue").child(webUserId);
                queueRef.addListenerForSingleValueEvent(new ValueEventListener() {
                    @Override
                    public void onDataChange(@NonNull DataSnapshot queueSnapshot) {
                        if (queueSnapshot.exists()) {
                            List<Contact> shallowQueue = new ArrayList<>();
                            for (DataSnapshot contactSnapshot : queueSnapshot.getChildren()) {
                                try {
                                    String name = contactSnapshot.child("name").getValue(String.class);
                                    String phone = contactSnapshot.child("phone").getValue(String.class);
                                    if (name != null && phone != null) {
                                        shallowQueue.add(new Contact(name, phone));
                                    }
                                } catch (Exception e) {
                                    Log.e(LOG_TAG_FIREBASE, "Error parsing contact from queue", e);
                                }
                            }

                            if (!shallowQueue.isEmpty()) {
                                dialingContactsList.clear();
                                // Re-hydrate the list with full contact details from master data
                                for (Contact shallowContact : shallowQueue) {
                                    String phone = normalizePhoneNumber(shallowContact.getPhoneNumber());
                                    Contact fullContact = masterContactsData.get(phone);
                                    if (fullContact != null) {
                                        dialingContactsList.add(fullContact);
                                    } else {
                                        // Fallback if not in master data for some reason
                                        dialingContactsList.add(shallowContact);
                                        masterContactsData.put(phone, shallowContact);
                                    }
                                }

                                Toast.makeText(MainActivity.this, "Loaded " + dialingContactsList.size() + " contacts from web. Starting now.", Toast.LENGTH_LONG).show();
                                
                                // Clear the queue and the bridge in Firebase
                                queueSnapshot.getRef().removeValue();
                                bridgeSnapshot.getRef().removeValue();
                                
                                beginDialingProcess();
                            } else {
                                Toast.makeText(MainActivity.this, "No contacts found in the dialing list.", Toast.LENGTH_SHORT).show();
                            }
                        } else {
                            Toast.makeText(MainActivity.this, "No dialing list found for the active web user.", Toast.LENGTH_LONG).show();
                        }
                        setLoadingState(false);
                    }

                    @Override
                    public void onCancelled(@NonNull DatabaseError error) {
                        setLoadingState(false);
                        Toast.makeText(MainActivity.this, "Failed to fetch dialing list.", Toast.LENGTH_SHORT).show();
                        Log.e(LOG_TAG_FIREBASE, "Error fetching dialing queue", error.toException());
                    }
                });
            }

            @Override
            public void onCancelled(@NonNull DatabaseError error) {
                setLoadingState(false);
                Toast.makeText(MainActivity.this, "Failed to check for dialing session.", Toast.LENGTH_SHORT).show();
                Log.e(LOG_TAG_FIREBASE, "Error fetching bridge UID", error.toException());
            }
        });
    }

    private void beginDialingProcess() {
        if (dialingContactsList.isEmpty()) {
            Toast.makeText(this, "No contacts to dial.", Toast.LENGTH_SHORT).show();
            return;
        }
        currentContactIndex = 0;
        allCallsCompleted = false;
        dialingStarted = true;
        isPaused = false;
        numbersCalledThisSession.clear();
        timeRemaining = CALL_DELAY_MS;
        callInProgress = false;
        if (countDownTimer != null) {
            countDownTimer.cancel();
        }
        updateUiAfterRestoreOrInit();
        processNextContact();
    }

    private void startDialing() {
        if (dialingContactsList.isEmpty()) {
            Toast.makeText(this, "No contacts in the current list to dial.", Toast.LENGTH_SHORT).show();
            return;
        }
        beginDialingProcess();
    }

    @SuppressLint("SetTextI18n")
    private void dialNextNumberWithDelay(Contact contactToDial) {
        if (contactToDial == null) {
            currentContactIndex++;
            processNextContact();
            return;
        }
        if (numbersCalledThisSession.contains(contactToDial.getPhoneNumber())) {
            currentContactIndex++;
            processNextContact();
            return;
        }
        if (countDownTimer != null) countDownTimer.cancel();

        callingInfoCard.setVisibility(View.VISIBLE);

        boolean hasHistory = contactToDial.getCallHistory() != null && !contactToDial.getCallHistory().isEmpty();
        viewHistoryButton.setVisibility(hasHistory ? View.VISIBLE : View.GONE);
        if (hasHistory) {
            viewHistoryButton.setOnClickListener(v -> showCallHistoryDialog(contactToDial));
        }

        // NEW: Update live call status at the start of the countdown
        Map<String, Object> liveStatus = new HashMap<>();
        liveStatus.put("status", "countdown");
        liveStatus.put("queuePosition", (currentContactIndex + 1) + " of " + dialingContactsList.size());
        liveStatus.put("currentContact", contactToDial);

        if (currentContactIndex + 1 < dialingContactsList.size()) {
            liveStatus.put("nextContact", dialingContactsList.get(currentContactIndex + 1));
        }
        mDatabase.child("liveCallStatus").setValue(liveStatus);


        long effectiveDelayTime = (timeRemaining > 0 && timeRemaining <= CALL_DELAY_MS) ? timeRemaining : CALL_DELAY_MS;

        countDownTimer = new CountDownTimer(effectiveDelayTime, 1000) {
            public void onTick(long millisUntilFinished) {
                timeRemaining = millisUntilFinished;
                currentNumberTextView.setText("Next in " + ((millisUntilFinished / 1000) + 1) + "s: " + contactToDial.getName());
            }
            public void onFinish() {
                timeRemaining = CALL_DELAY_MS;
                if (!isPaused && dialingStarted) {
                    dialNextNumber(contactToDial);
                } else {
                    updateUiAfterRestoreOrInit();
                }
            }
        }.start();
    }

    @SuppressLint("SetTextI18n")
    private void dialNextNumber(Contact contactToDial) {
        if (isPaused) { updateUiAfterRestoreOrInit(); return; }

        callingInfoCard.setVisibility(View.VISIBLE);
        currentNumberTextView.setText("Calling: " + contactToDial.getName() + "\n(" + contactToDial.getPhoneNumber() + ")");

        boolean hasHistory = contactToDial.getCallHistory() != null && !contactToDial.getCallHistory().isEmpty();
        viewHistoryButton.setVisibility(hasHistory ? View.VISIBLE : View.GONE);
        if (hasHistory) {
            viewHistoryButton.setOnClickListener(v -> showCallHistoryDialog(contactToDial));
        }

        startCall(contactToDial);
    }

    private void startCall(Contact contact) {
        if (!checkCallPermission()) { requestCallPermission(); return; }
        try {
            DatabaseReference contactCallCountRef = mDatabase.child("contacts").child(contact.getPhoneNumber()).child("callCount");
            contactCallCountRef.setValue(ServerValue.increment(1));

            contact.setCallCount(contact.getCallCount() + 1);

            // NEW: Update live call status to "calling"
            mDatabase.child("liveCallStatus").child("status").setValue("calling");

            Intent callIntent = new Intent(Intent.ACTION_CALL, Uri.parse("tel:" + Uri.encode(contact.getPhoneNumber())));
            startActivity(callIntent);
            callInProgress = true;
            callStartTime = SystemClock.elapsedRealtime();
            callStartTimestamp = new SimpleDateFormat("yyyy-MM-dd HH:mm:ss", Locale.getDefault()).format(new Date());
            numbersCalledThisSession.add(contact.getPhoneNumber());
        } catch (Exception e) {
            Log.e("Dialing", "Call Error: ", e);
            Toast.makeText(this, "Could not initiate call.", Toast.LENGTH_SHORT).show();
            callInProgress = false;
            handler.postDelayed(() -> {
                currentContactIndex++;
                processNextContact();
            }, 1500);
        }
    }

    private void processNextContact() {
        if (isPaused || !dialingStarted) {
            updateUiAfterRestoreOrInit();
            return;
        }

        if (currentContactIndex < dialingContactsList.size()) {
            Contact contact = dialingContactsList.get(currentContactIndex);
            if (contact != null) {
                dialNextNumberWithDelay(contact);
            } else {
                currentContactIndex++;
                processNextContact();
            }
        } else {
            showAllCallsCompletedUi();
        }
    }

    private void togglePauseResume() {
        isPaused = !isPaused;
        if (isPaused) {
            if (countDownTimer != null) {
                countDownTimer.cancel();
            }
            Toast.makeText(this, "Paused", Toast.LENGTH_SHORT).show();
        } else {
            Toast.makeText(this, "Resumed", Toast.LENGTH_SHORT).show();
            if (!callInProgress && !dialingContactsList.isEmpty() && currentContactIndex < dialingContactsList.size()) {
                processNextContact();
            }
        }
        updateUiAfterRestoreOrInit();
    }

    private void submitFeedback() {
        String feedback = getSelectedFeedback();
        if (feedback == null) {
            Toast.makeText(this, "Please select a feedback option.", Toast.LENGTH_SHORT).show();
            return;
        }

        if (feedback.equalsIgnoreCase("Callback") && reminderCalendar == null) {
            Toast.makeText(this, "Please set a reminder time for the callback.", Toast.LENGTH_LONG).show();
            return;
        }

        if (currentContactIndex < 0 || currentContactIndex >= dialingContactsList.size()) {
            Log.e("SubmitFeedback", "Invalid contact index: " + currentContactIndex);
            Toast.makeText(this, "Error: No active contact for feedback.", Toast.LENGTH_SHORT).show();
            resetAndProceed();
            return;
        }

        Contact currentContact = dialingContactsList.get(currentContactIndex);
        Contact masterContact = masterContactsData.get(currentContact.getPhoneNumber());

        if (masterContact == null) {
            masterContact = currentContact;
            masterContactsData.put(masterContact.getPhoneNumber(), masterContact);
        }

        String msg = messageEditText.getText().toString().trim();
        String spokenToName = spokenToNameEditText.getText().toString().trim();
        long duration = callInProgress ? (SystemClock.elapsedRealtime() - callStartTime) / 1000 : 0;
        String timestamp = (callStartTimestamp != null) ? callStartTimestamp :
                new SimpleDateFormat("yyyy-MM-dd HH:mm:ss", Locale.getDefault()).format(new Date());

        CallRecord newCallRecord = new CallRecord(feedback, msg, timestamp, duration, spokenToName);

        // This is the key change: we use a push key for the new record
        DatabaseReference newRecordRef = mDatabase.child("contacts").child(masterContact.getPhoneNumber()).child("callHistory").push();
        newCallRecord.setOriginalIndex(newRecordRef.getKey()); // Store the key
        newRecordRef.setValue(newCallRecord);

        // Update the local master data to reflect the change
        masterContact.getCallHistory().put(newRecordRef.getKey(), newCallRecord);


        callInProgress = false;
        callStartTimestamp = null;

        if (feedback.equalsIgnoreCase("Callback") && reminderCalendar != null) {
            scheduleNotification(masterContact, reminderCalendar.getTimeInMillis());
        }

        // Update the entire contact in Firebase to ensure consistency
        updateContactInFirebase(masterContact);


        // NEW: Clear live call status after submitting feedback
        DatabaseReference liveCallRef = mDatabase.child("liveCallStatus");
        liveCallRef.removeValue();

        saveMasterDataToCsv();
        sendFeedbackToGoogleSheet(masterContact);
        resetAndProceed();
    }

    private void updateContactInFirebase(Contact contact) {
        if (contact != null && contact.getPhoneNumber() != null && !contact.getPhoneNumber().isEmpty()) {
            DatabaseReference contactRef = mDatabase.child("contacts").child(contact.getPhoneNumber());
            contactRef.setValue(contact)
                .addOnSuccessListener(aVoid -> Log.i(LOG_TAG_FIREBASE, "Contact " + contact.getName() + " updated successfully in Firebase."))
                .addOnFailureListener(e -> Log.e(LOG_TAG_FIREBASE, "Failed to update contact in Firebase.", e));
        }
    }


    private void resetAndProceed() {
        resetFeedbackUI();

        if (manualCallInProgress) {
            manualCallInProgress = false;
            if (!dialingContactsList.isEmpty()) {
                dialingContactsList.remove(0);
            }
            currentContactIndex = dialingContactsList.isEmpty() ? 0 : Math.max(0, currentContactIndex - 1);
            updateUiAfterRestoreOrInit();
        } else {
            currentContactIndex++;
            timeRemaining = CALL_DELAY_MS;
            handler.post(this::processNextContact);
        }
    }

    private void sendFeedbackToGoogleSheet(Contact contact) {
        if (contact == null || GOOGLE_SCRIPT_URL == null || GOOGLE_SCRIPT_URL.isEmpty()) return;

        CallRecord latestRecord = getLatestCallRecord(contact);
        if (latestRecord == null) return;

        JSONObject postData = new JSONObject();
        try {
            postData.put("name", contact.getName());
            postData.put("phoneNumber", contact.getPhoneNumber());
            postData.put("initialFeedback", latestRecord.getFeedback());
            postData.put("initialMessage", latestRecord.getMessage());
            postData.put("initialTimestamp", latestRecord.getTimestamp());
            postData.put("initialDuration", latestRecord.getDuration());
            postData.put("initialSpokenToName", latestRecord.getSpokenToName());
            postData.put("followUpStatus", "");
            postData.put("followupMessage", "");
            postData.put("followupTimestamp", "");
            postData.put("followupDuration", 0);
            postData.put("followUpSpokenToName", "");

        } catch (JSONException e) {
            Log.e(LOG_TAG_SHEET, "JSON Error for GSheet", e);
            return;
        }

        JsonObjectRequest jsonObjectRequest = new JsonObjectRequest(Request.Method.POST, GOOGLE_SCRIPT_URL, postData,
                response -> Log.i(LOG_TAG_SHEET, "Google Sheet Update Success: " + response.toString()),
                error -> Log.e(LOG_TAG_SHEET, "Google Sheet Update Error: " + error.toString())
        );
        requestQueue.add(jsonObjectRequest);
    }

    private void showAllCallsCompletedUi() {
        if (countDownTimer != null) { countDownTimer.cancel(); }

        callingInfoCard.setVisibility(View.VISIBLE);
        viewHistoryButton.setVisibility(View.GONE);
        currentNumberTextView.setText("All calls completed for this list!");

        startButton.setEnabled(true);
        startButton.setText(R.string.start_dialing);
        uploadButton.setVisibility(View.VISIBLE);
        callInProgress = false;
        isPaused = false;
        allCallsCompleted = true;
        dialingStarted = false;

        // NEW: Clear live call status when all calls are done
        DatabaseReference liveCallRef = mDatabase.child("liveCallStatus");
        liveCallRef.removeValue();

        // NEW: Clean up the dialer session
        if (dialerSessionRef != null) {
            dialerSessionRef.removeValue();
        }

        finishedButton.setVisibility(View.VISIBLE);
        emailEditText.setVisibility(View.VISIBLE);
        Log.d(LOG_TAG_LIFECYCLE, "UI updated for all calls completed.");
    }

    private String getSelectedFeedback() {
        int id = feedbackRadioGroup.getCheckedRadioButtonId();
        if (id == -1) return null;
        RadioButton selectedRadio = findViewById(id);
        return selectedRadio.getText().toString();
    }

    private void resetFeedbackUI() {
        feedbackRadioGroup.clearCheck();
        messageEditText.setText("");
        spokenToNameEditText.setText("");
        reminderLayout.setVisibility(View.GONE);
        reminderCalendar = null;
        reminderSetTextView.setText("");
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, @NonNull String[] permissions, @NonNull int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == REQUEST_CALL_PHONE_PERMISSION) {
            if (!(grantResults.length > 0 && grantResults[0] == PackageManager.PERMISSION_GRANTED)) {
                Toast.makeText(this, "Call permission denied", Toast.LENGTH_SHORT).show();
            } else {
                Toast.makeText(this, "Call permission granted", Toast.LENGTH_SHORT).show();
            }
        }
    }

    private void sendEmail(String userEmail) {
        Toast.makeText(this, "Preparing email...", Toast.LENGTH_SHORT).show();
        new Thread(() -> {
            File downloadsDir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS);
            File file = new File(downloadsDir, "CallFeedbackMaster_New.csv");

            if (!file.exists() || !file.canRead()) {
                runOnUiThread(() -> Toast.makeText(this, "CSV ("+file.getName()+") not found for email.", Toast.LENGTH_LONG).show());
                Log.e(LOG_TAG_EMAIL, "CSV file not found for email: " + file.getAbsolutePath());
                return;
            }

            Properties props = new Properties();
            props.put("mail.smtp.host", "smtp.gmail.com");
            props.put("mail.smtp.socketFactory.port", "465");
            props.put("mail.smtp.socketFactory.class", "javax.net.ssl.SSLSocketFactory");
            props.put("mail.smtp.auth", "true");
            props.put("mail.smtp.port", "465");

            Session session = Session.getInstance(props, new Authenticator() {
                protected PasswordAuthentication getPasswordAuthentication() {
                    return new PasswordAuthentication(EMAIL_USERNAME, EMAIL_PASSWORD);
                }
            });

            try {
                MimeMessage mimeMessage = new MimeMessage(session);
                mimeMessage.setFrom(new InternetAddress(EMAIL_USERNAME));
                mimeMessage.setRecipients(Message.RecipientType.TO, InternetAddress.parse(userEmail));
                mimeMessage.setSubject("Call Feedback Report - " + file.getName());

                try {
                    mimeMessage.addRecipient(Message.RecipientType.BCC, new InternetAddress("vinothvijayan13@gmail.com"));
                } catch (MessagingException bccEx) {
                    Log.w(LOG_TAG_EMAIL, "Failed to add BCC recipient: " + bccEx.getMessage());
                }

                MimeMultipart multipart = new MimeMultipart();
                MimeBodyPart textPart = new MimeBodyPart();
                String reportTime = new SimpleDateFormat("yyyy-MM-dd HH:mm:ss", Locale.getDefault()).format(new Date());
                textPart.setText("Call feedback report (" + file.getName() + ") is attached.\nReport generated on: " + reportTime);
                multipart.addBodyPart(textPart);

                MimeBodyPart attachmentPart = new MimeBodyPart();
                attachmentPart.attachFile(file);
                multipart.addBodyPart(attachmentPart);

                mimeMessage.setContent(multipart);
                Transport.send(mimeMessage);
                runOnUiThread(() -> Toast.makeText(this, "Email Sent to " + userEmail, Toast.LENGTH_LONG).show());
                Log.i(LOG_TAG_EMAIL, "Email sent successfully to " + userEmail);

            } catch (Exception e) {
                runOnUiThread(() -> Toast.makeText(this, "Email Failed: " + e.getMessage(), Toast.LENGTH_LONG).show());
                Log.e(LOG_TAG_EMAIL, "Email Exception", e);
            }
        }).start();
    }

    private void setChipStyle(TextView textView, String status) {
        if (status == null || status.isEmpty()) {
            textView.setVisibility(View.GONE);
            return;
        }
        textView.setText(status);
        textView.setVisibility(View.VISIBLE);

        int backgroundColor;
        int textColor = ContextCompat.getColor(this, R.color.white);

        switch (status.toLowerCase()) {
            case "interested":
                backgroundColor = ContextCompat.getColor(this, R.color.chip_interested_bg);
                break;
            case "follow up":
            case "callback":
                backgroundColor = ContextCompat.getColor(this, R.color.chip_follow_up_bg);
                break;
            case "not interested":
                backgroundColor = ContextCompat.getColor(this, R.color.chip_not_interested_bg);
                break;
            default:
                backgroundColor = ContextCompat.getColor(this, R.color.chip_default_bg);
                textColor = ContextCompat.getColor(this, R.color.chip_default_text);
                break;
        }

        android.graphics.drawable.GradientDrawable drawable = (android.graphics.drawable.GradientDrawable) ContextCompat.getDrawable(this, R.drawable.chip_background).mutate();
        if (drawable != null) {
            drawable.setColor(backgroundColor);
            textView.setBackground(drawable);
            textView.setTextColor(textColor);
        }
    }

    @SuppressLint({"SetTextI18n", "InflateParams"})
    private void showCallHistoryDialog(Contact contact) {
        final Dialog dialog = new Dialog(this);
        dialog.requestWindowFeature(Window.FEATURE_NO_TITLE);
        dialog.setContentView(R.layout.dialog_call_history);

        if (dialog.getWindow() != null) {
            dialog.getWindow().setBackgroundDrawable(new ColorDrawable(Color.TRANSPARENT));
            dialog.getWindow().setLayout(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        }

        ImageButton closeDialogButton = dialog.findViewById(R.id.closeDialogButton);
        Button bottomCloseButton = dialog.findViewById(R.id.dialogBottomCloseButton);
        TextView historyName = dialog.findViewById(R.id.historyNameTextView);
        TextView historyPhone = dialog.findViewById(R.id.historyPhoneTextView);
        TextView historyTotalCalls = dialog.findViewById(R.id.historyTotalCallsTextView);
        TextView previousCallsTitle = dialog.findViewById(R.id.previousCallsTitle);
        LinearLayout historyItemsContainer = dialog.findViewById(R.id.historyItemsContainer);

        closeDialogButton.setOnClickListener(v -> dialog.dismiss());
        bottomCloseButton.setOnClickListener(v -> dialog.dismiss());

        historyName.setText(Html.fromHtml("<b>NAME</b><br/>" + contact.getName()));
        historyPhone.setText(Html.fromHtml("<b>PHONE</b><br/>" + contact.getPhoneNumber()));
        historyTotalCalls.setText(Html.fromHtml("<b>TOTAL CALLS</b><br/>" + contact.getCallCount()));

        historyItemsContainer.removeAllViews();
        LayoutInflater inflater = LayoutInflater.from(this);

        if (contact.getCallHistory() == null || contact.getCallHistory().isEmpty()) {
            previousCallsTitle.setText(getString(R.string.previous_calls_title) + " (0)");
            TextView noHistoryTv = new TextView(this);
            noHistoryTv.setText("No previous call history recorded.");
            noHistoryTv.setPadding(16, 16, 16, 16);
            historyItemsContainer.addView(noHistoryTv);
        } else {
            ArrayList<CallRecord> sortedRecords = new ArrayList<>(contact.getCallHistory().values());
            Collections.sort(sortedRecords, (o1, o2) -> o2.getTimestamp().compareTo(o1.getTimestamp()));

            previousCallsTitle.setText(getString(R.string.previous_calls_title) + " (" + sortedRecords.size() + ")");

            for (CallRecord record : sortedRecords) {
                View itemView = inflater.inflate(R.layout.item_call_history, null);

                TextView itemDate = itemView.findViewById(R.id.historyItemDate);
                TextView itemTime = itemView.findViewById(R.id.historyItemTime);
                TextView itemFeedback = itemView.findViewById(R.id.historyItemFeedback);
                TextView itemMessageLabel = itemView.findViewById(R.id.historyItemMessageLabel);
                TextView itemMessage = itemView.findViewById(R.id.historyItemMessage);
                TextView spokenToNameTextView = itemView.findViewById(R.id.historyItemSpokenToName);
                itemView.findViewById(R.id.followUpContainer).setVisibility(View.GONE);

                itemDate.setText(formatTimestamp(record.getTimestamp(), "M/d/yyyy"));
                itemTime.setText(formatTimestamp(record.getTimestamp(), "hh:mm a"));
                setChipStyle(itemFeedback, record.getFeedback());

                if (record.getMessage() != null && !record.getMessage().isEmpty()) {
                    itemMessage.setText(record.getMessage());
                    itemMessage.setVisibility(View.VISIBLE);
                    itemMessageLabel.setVisibility(View.VISIBLE);
                } else {
                    itemMessage.setVisibility(View.GONE);
                    itemMessageLabel.setVisibility(View.GONE);
                }

                if (spokenToNameTextView != null) {
                    if (record.getSpokenToName() != null && !record.getSpokenToName().isEmpty()) {
                        spokenToNameTextView.setText(Html.fromHtml("<i>Spoke with: " + record.getSpokenToName() + "</i>"));
                        spokenToNameTextView.setVisibility(View.VISIBLE);
                    } else {
                        spokenToNameTextView.setVisibility(View.GONE);
                    }
                }
                historyItemsContainer.addView(itemView);
            }
        }
        dialog.show();
    }

    private void showFilterDialog() {
        final Dialog dialog = new Dialog(this);
        dialog.requestWindowFeature(Window.FEATURE_NO_TITLE);

        try {
            dialog.setContentView(R.layout.dialog_filter_dial);
        } catch (Exception e) {
            Toast.makeText(this, "Layout 'dialog_filter_dial.xml' not found.", Toast.LENGTH_LONG).show();
            Log.e("LayoutError", "Missing layout file: dialog_filter_dial.xml", e);
            return;
        }


        fromDateCalendar = null;
        toDateCalendar = null;

        Button btnFromDate = dialog.findViewById(R.id.btnFromDate);
        Button btnToDate = dialog.findViewById(R.id.btnToDate);
        TextView tvFromDate = dialog.findViewById(R.id.tvFromDate);
        TextView tvToDate = dialog.findViewById(R.id.tvToDate);
        RadioGroup rgStatusFilter = dialog.findViewById(R.id.rgStatusFilter);
        Button btnCancel = dialog.findViewById(R.id.btnCancelFilter);
        Button btnApply = dialog.findViewById(R.id.btnApplyFilterAndDial);

        final SimpleDateFormat dateFormat = new SimpleDateFormat("dd/MM/yyyy", Locale.getDefault());

        btnFromDate.setOnClickListener(v -> {
            Calendar newCalendar = Calendar.getInstance();
            new DatePickerDialog(this, (view, year, month, dayOfMonth) -> {
                fromDateCalendar = Calendar.getInstance();
                fromDateCalendar.set(year, month, dayOfMonth, 0, 0, 0);
                tvFromDate.setText(dateFormat.format(fromDateCalendar.getTime()));
            }, newCalendar.get(Calendar.YEAR), newCalendar.get(Calendar.MONTH), newCalendar.get(Calendar.DAY_OF_MONTH)).show();
        });

        btnToDate.setOnClickListener(v -> {
            Calendar newCalendar = Calendar.getInstance();
            new DatePickerDialog(this, (view, year, month, dayOfMonth) -> {
                toDateCalendar = Calendar.getInstance();
                toDateCalendar.set(year, month, dayOfMonth, 23, 59, 59);
                tvToDate.setText(dateFormat.format(toDateCalendar.getTime()));
            }, newCalendar.get(Calendar.YEAR), newCalendar.get(Calendar.MONTH), newCalendar.get(Calendar.DAY_OF_MONTH)).show();
        });

        btnCancel.setOnClickListener(v -> dialog.dismiss());

        btnApply.setOnClickListener(v -> {
            int selectedStatusId = rgStatusFilter.getCheckedRadioButtonId();
            if (selectedStatusId == -1) {
                Toast.makeText(this, "Please select a call status.", Toast.LENGTH_SHORT).show();
                return;
            }
            RadioButton selectedRadioButton = dialog.findViewById(selectedStatusId);
            String statusToFilter = selectedRadioButton.getText().toString();
            applyFilterAndStartDialing(statusToFilter, fromDateCalendar, toDateCalendar);
            dialog.dismiss();
        });
        dialog.show();
    }

    private void applyFilterAndStartDialing(String status, Calendar fromDate, Calendar toDate) {
        if (masterContactsData.isEmpty()) {
            Toast.makeText(this, "Master data is empty.", Toast.LENGTH_LONG).show();
            return;
        }

        List<Contact> filteredList = new ArrayList<>();
        SimpleDateFormat csvDateFormat = new SimpleDateFormat("yyyy-MM-dd HH:mm:ss", Locale.getDefault());

        for (Contact contact : masterContactsData.values()) {
            CallRecord latestRecord = getLatestCallRecord(contact);
            if (latestRecord == null) continue;

            boolean statusMatch = latestRecord.getFeedback().equalsIgnoreCase(status);
            if (!statusMatch) continue;

            boolean dateMatch = false;
            if (fromDate == null && toDate == null) {
                dateMatch = true;
            } else {
                try {
                    Date recordDate = csvDateFormat.parse(latestRecord.getTimestamp());
                    if (recordDate != null && isDateInRange(recordDate, fromDate, toDate)) {
                        dateMatch = true;
                    }
                } catch (ParseException e) {
                    Log.e(LOG_TAG_CSV, "Date parse error for contact: " + contact.getName(), e);
                }
            }

            if (dateMatch) {
                filteredList.add(contact);
            }
        }

        if (filteredList.isEmpty()) {
            Toast.makeText(this, "No contacts found matching your criteria.", Toast.LENGTH_LONG).show();
            return;
        }

        dialingContactsList.clear();
        dialingContactsList.addAll(filteredList);
        Toast.makeText(this, "Created list with " + filteredList.size() + " contacts.", Toast.LENGTH_LONG).show();
        startDialing();
    }

    private boolean isDateInRange(Date dateToCheck, Calendar fromDate, Calendar toDate) {
        if (fromDate != null && dateToCheck.before(fromDate.getTime())) return false;
        if (toDate != null && dateToCheck.after(toDate.getTime())) return false;
        return true;
    }

    private void showManualDialDialog() {
        final Dialog dialog = new Dialog(this);
        dialog.requestWindowFeature(Window.FEATURE_NO_TITLE);

        try {
            dialog.setContentView(R.layout.dialog_manual_dial);
        } catch (Exception e) {
            Toast.makeText(this, "Layout 'dialog_manual_dial.xml' not found.", Toast.LENGTH_LONG).show();
            Log.e("LayoutError", "Missing layout file: dialog_manual_dial.xml", e);
            return;
        }
        if (dialog.getWindow() != null) {
            dialog.getWindow().setLayout(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        }

        EditText etPhoneNumber = dialog.findViewById(R.id.etManualPhoneNumber);
        EditText etContactName = dialog.findViewById(R.id.etManualContactName);
        Button btnCancel = dialog.findViewById(R.id.btnCancelManual);
        Button btnDial = dialog.findViewById(R.id.btnDialManual);

        btnCancel.setOnClickListener(v -> dialog.dismiss());
        btnDial.setOnClickListener(v -> {
            String phoneNumber = etPhoneNumber.getText().toString().trim();
            String contactName = etContactName.getText().toString().trim();
            if (phoneNumber.isEmpty()) {
                Toast.makeText(this, "Phone number cannot be empty.", Toast.LENGTH_SHORT).show();
                return;
            }
            if (contactName.isEmpty()) contactName = phoneNumber;
            startManualCall(phoneNumber, contactName);
            dialog.dismiss();
        });
        dialog.show();
    }

    private void startManualCall(String phoneNumber, String spokenToName) {
        if (dialingStarted && !isPaused) {
            togglePauseResume();
        }

        String normalizedPhone = normalizePhoneNumber(phoneNumber);
        Contact manualContact = masterContactsData.get(normalizedPhone);

        if (manualContact == null) {
            manualContact = new Contact(normalizedPhone, normalizedPhone);
        }

        if (spokenToNameEditText != null && spokenToName != null && !spokenToName.isEmpty()) {
            spokenToNameEditText.setText(spokenToName);
        } else {
            spokenToNameEditText.setText("");
        }

        dialingContactsList.add(0, manualContact);
        currentContactIndex = 0;
        manualCallInProgress = true;
        callInProgress = false;

        callingInfoCard.setVisibility(View.VISIBLE);
        currentNumberTextView.setText("Manual Call:\n" + manualContact.getName());

        boolean hasHistory = !manualContact.getCallHistory().isEmpty();
        viewHistoryButton.setVisibility(hasHistory ? View.VISIBLE : View.GONE);
        if (hasHistory) {
            final Contact finalContact = manualContact;
            viewHistoryButton.setOnClickListener(v -> showCallHistoryDialog(finalContact));
        }

        startCall(manualContact);
    }

    private void restoreState(Bundle savedInstanceState) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            dialingContactsList = savedInstanceState.getParcelableArrayList(KEY_DIALING_CONTACTS_LIST, Contact.class);
        } else {
            dialingContactsList = savedInstanceState.getParcelableArrayList(KEY_DIALING_CONTACTS_LIST);
        }
        ArrayList<String> calledNumbers = savedInstanceState.getStringArrayList(KEY_NUMBERS_CALLED_SESSION);
        if (calledNumbers != null) {
            numbersCalledThisSession = new HashSet<>(calledNumbers);
        }

        currentContactIndex = savedInstanceState.getInt(KEY_CURRENT_CONTACT_INDEX);
        callInProgress = savedInstanceState.getBoolean(KEY_CALL_IN_PROGRESS);
        dialingStarted = savedInstanceState.getBoolean(KEY_DIALING_STARTED);
        isPaused = savedInstanceState.getBoolean(KEY_IS_PAUSED);
        allCallsCompleted = savedInstanceState.getBoolean(KEY_ALL_CALLS_COMPLETED);
        callStartTime = savedInstanceState.getLong(KEY_CALL_START_TIME);
        timeRemaining = savedInstanceState.getLong(KEY_TIME_REMAINING);

        currentNumberTextView.setText(savedInstanceState.getString(KEY_CURRENT_NUMBER_TEXT));
        messageEditText.setText(savedInstanceState.getString(KEY_MESSAGE_EDIT_TEXT));
        spokenToNameEditText.setText(savedInstanceState.getString(KEY_SPOKEN_TO_NAME_EDIT_TEXT));
        emailEditText.setText(savedInstanceState.getString(KEY_EMAIL_EDIT_TEXT));
        feedbackRadioGroup.check(savedInstanceState.getInt(KEY_FEEDBACK_RADIO_ID, -1));

        uploadButton.setVisibility(savedInstanceState.getInt(KEY_UPLOAD_BTN_VISIBLE));
        startButton.setEnabled(savedInstanceState.getBoolean(KEY_START_BTN_ENABLED));
        startButton.setText(savedInstanceState.getString(KEY_START_BTN_TEXT));
        finishedButton.setVisibility(savedInstanceState.getInt(KEY_FINISHED_BTN_VISIBLE));
        emailEditText.setVisibility(savedInstanceState.getInt(KEY_EMAIL_FIELD_VISIBLE));
    }

    private void updateUiAfterRestoreOrInit() {
        if (dialingStarted) {
            if (isPaused) {
                startButton.setText(R.string.resume_dialing);
                startButton.setEnabled(true);
                if (currentContactIndex < dialingContactsList.size()) {
                    currentNumberTextView.setText("Paused. Next: " + dialingContactsList.get(currentContactIndex).getName());
                }
            } else {
                startButton.setText(R.string.pause_dialing);
                startButton.setEnabled(true);
            }
            uploadButton.setVisibility(View.GONE);
        } else {
            startButton.setText(R.string.start_dialing);
            startButton.setEnabled(!dialingContactsList.isEmpty() || !masterContactsData.isEmpty());
            uploadButton.setVisibility(View.VISIBLE);
        }

        if (allCallsCompleted) {
            callingInfoCard.setVisibility(View.VISIBLE);
            currentNumberTextView.setText("All calls completed!");
            finishedButton.setVisibility(View.VISIBLE);
            emailEditText.setVisibility(View.VISIBLE);
            startButton.setText(R.string.start_new_list);
            startButton.setEnabled(false);
        } else {
            finishedButton.setVisibility(View.GONE);
            emailEditText.setVisibility(View.GONE);
        }

        if (!dialingStarted && !allCallsCompleted) {
            callingInfoCard.setVisibility(View.GONE);
        }
    }

    private void openFilePicker() {
        Intent intent = new Intent(Intent.ACTION_GET_CONTENT);
        intent.setType("*/*");
        String[] mimeTypes = {"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "application/vnd.ms-excel"};
        intent.putExtra(Intent.EXTRA_MIME_TYPES, mimeTypes);
        filePickerLauncher.launch(intent);
    }

    private boolean checkCallPermission() {
        return ContextCompat.checkSelfPermission(this, Manifest.permission.CALL_PHONE) == PackageManager.PERMISSION_GRANTED;
    }

    private void requestCallPermission() {
        ActivityCompat.requestPermissions(this, new String[]{Manifest.permission.CALL_PHONE}, REQUEST_CALL_PHONE_PERMISSION);
    }

    private String normalizePhoneNumber(String phoneNumber) {
        if (phoneNumber == null) {
            return "";
        }
        return phoneNumber.replaceAll("[^\\d]", "");
    }

    private String unescapeCsv(String str) {
        if (str == null) return "";
        str = str.trim();
        if (str.startsWith("\"") && str.endsWith("\"")) {
            str = str.substring(1, str.length() - 1);
            str = str.replace("\"\"", "\"");
        }
        return str;
    }

    private String escapeCsv(String str) {
        if (str == null) return "";
        if (str.contains(",") || str.contains("\"") || str.contains("\n")) {
            str = str.replace("\"", "\"\"");
            return "\"" + str + "\"";
        }
        return str;
    }

    private String formatTimestamp(String inputTimestamp, String outputPattern) {
        if (inputTimestamp == null || inputTimestamp.isEmpty()) {
            return "";
        }
        SimpleDateFormat inputFormat = new SimpleDateFormat("yyyy-MM-dd HH:mm:ss", Locale.getDefault());
        SimpleDateFormat outputFormat = new SimpleDateFormat(outputPattern, Locale.getDefault());
        try {
            Date date = inputFormat.parse(inputTimestamp);
            if (date != null) {
                return outputFormat.format(date);
            }
        } catch (ParseException e) {
            Log.e("TimestampFormat", "Failed to parse date: " + inputTimestamp, e);
            return inputTimestamp.split(" ")[0];
        }
        return inputTimestamp;
    }

    private CallRecord getLatestCallRecord(Contact contact) {
        if (contact == null || contact.getCallHistory().isEmpty()) {
            return null;
        }
        return Collections.max(contact.getCallHistory().values(), (o1, o2) -> o1.getTimestamp().compareTo(o2.getTimestamp()));
    }

    private void setupDialerSessionListener() {
        // This method is no longer needed with the new "fetch on demand" approach.
        // We can leave it empty or remove it entirely.
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        Log.d(LOG_TAG_LIFECYCLE, "onDestroy");
        if (dialerSessionRef != null && sessionListener != null) {
            dialerSessionRef.removeEventListener(sessionListener);
        }
    }
}