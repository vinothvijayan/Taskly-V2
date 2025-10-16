package com.example.vinoth;

import android.os.Parcel;
import android.os.Parcelable;
import java.util.HashMap;
import java.util.Map;

/**
 * Represents a contact with a name, phone number, a complete history of all calls made,
 * and a counter for the total number of calls to this specific contact.
 * This class is designed to be saved to Firebase and passed between Android activities.
 */
public class Contact implements Parcelable {
    private String name;
    private String phoneNumber;
    private Map<String, CallRecord> callHistory = new HashMap<>();

    // NEW: Field to track the total number of calls made to this individual contact.
    private int callCount = 0;

    /**
     * A public, no-argument constructor is required by Firebase for deserialization.
     */
    public Contact() {
    }

    /**
     * Constructs a new Contact with a name and phone number.
     * @param name The name of the contact.
     * @param phoneNumber The contact's phone number.
     */
    public Contact(String name, String phoneNumber) {
        this.name = name;
        this.phoneNumber = phoneNumber;
    }

    // --- Getters and Setters ---

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getPhoneNumber() {
        return phoneNumber;
    }

    public void setPhoneNumber(String phoneNumber) {
        this.phoneNumber = phoneNumber;
    }

    public Map<String, CallRecord> getCallHistory() {
        return callHistory;
    }

    public void setCallHistory(Map<String, CallRecord> callHistory) {
        this.callHistory = callHistory;
    }

    // NEW: Getter for the individual call count.
    public int getCallCount() {
        return callCount;
    }

    // NEW: Setter for the individual call count.
    public void setCallCount(int callCount) {
        this.callCount = callCount;
    }


    // --- Parcelable Implementation (Updated to include callCount) ---

    protected Contact(Parcel in) {
        name = in.readString();
        phoneNumber = in.readString();
        // NEW: Read the call count from the Parcel.
        callCount = in.readInt();

        // Read the Map of CallRecords from the Parcel
        int size = in.readInt();
        this.callHistory = new HashMap<>(size);
        for (int i = 0; i < size; i++) {
            String key = in.readString();
            String feedback = in.readString();
            String message = in.readString();
            String timestamp = in.readString();
            long duration = in.readLong();
            String spokenToName = in.readString();
            CallRecord record = new CallRecord(feedback, message, timestamp, duration, spokenToName);
            this.callHistory.put(key, record);
        }
    }

    public static final Creator<Contact> CREATOR = new Creator<Contact>() {
        @Override
        public Contact createFromParcel(Parcel in) {
            return new Contact(in);
        }

        @Override
        public Contact[] newArray(int size) {
            return new Contact[size];
        }
    };

    @Override
    public int describeContents() {
        return 0;
    }

    @Override
    public void writeToParcel(Parcel dest, int flags) {
        dest.writeString(name);
        dest.writeString(phoneNumber);
        // NEW: Write the call count to the Parcel.
        dest.writeInt(callCount);

        // Write the Map of CallRecords to the Parcel
        dest.writeInt(callHistory.size());
        for (Map.Entry<String, CallRecord> entry : callHistory.entrySet()) {
            dest.writeString(entry.getKey());
            CallRecord record = entry.getValue();
            dest.writeString(record.getFeedback());
            dest.writeString(record.getMessage());
            dest.writeString(record.getTimestamp());
            dest.writeLong(record.getDuration());
            dest.writeString(record.getSpokenToName());
        }
    }
}