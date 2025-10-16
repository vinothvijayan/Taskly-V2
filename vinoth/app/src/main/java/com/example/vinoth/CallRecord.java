package com.example.vinoth;

// This is a new class to hold the details of a single call.
public class CallRecord {
    private String feedback;
    private String message;
    private String timestamp;
    private long duration;
    private String spokenToName;
    private String originalIndex; // This field will hold the unique Firebase key

    // Public no-argument constructor is required for Firebase
    public CallRecord() {
    }

    public CallRecord(String feedback, String message, String timestamp, long duration, String spokenToName) {
        this.feedback = feedback;
        this.message = message;
        this.timestamp = timestamp;
        this.duration = duration;
        this.spokenToName = spokenToName;
    }

    // Getters and Setters for all fields
    public String getFeedback() { return feedback; }
    public void setFeedback(String feedback) { this.feedback = feedback; }
    public String getMessage() { return message; }
    public void setMessage(String message) { this.message = message; }
    public String getTimestamp() { return timestamp; }
    public void setTimestamp(String timestamp) { this.timestamp = timestamp; }
    public long getDuration() { return duration; }
    public void setDuration(long duration) { this.duration = duration; }
    public String getSpokenToName() { return spokenToName; }
    public void setSpokenToName(String spokenToName) { this.spokenToName = spokenToName; }

    // Getter and Setter for the new originalIndex field
    public String getOriginalIndex() { return originalIndex; }
    public void setOriginalIndex(String originalIndex) { this.originalIndex = originalIndex; }
}