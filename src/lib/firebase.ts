// lib/firebase.ts
import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, RecaptchaVerifier, signInWithPhoneNumber } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getDatabase } from "firebase/database";
import { getStorage } from "firebase/storage";
import { getAnalytics } from "firebase/analytics";
import { getMessaging } from "firebase/messaging";
// --- 1. ADD THIS IMPORT ---
import { getFunctions } from "firebase/functions";

// Your web app's Firebase configuration
// IMPORTANT: In a production app, use environment variables for this config
const firebaseConfig = {
  apiKey: "AIzaSyCmioywtCMDFJjDvq8bF0_NBZJC5nyVPYo",
  authDomain: "huddlely.firebaseapp.com",
  projectId: "huddlely",
  storageBucket: "huddlely.firebasestorage.app",
  messagingSenderId: "788189911710",
  appId: "1:788189911710:web:3fd75fade0c56164d5b98f",
  measurementId: "G-8ZE8GCXPRX"
};

// Initialize Firebase
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

export const auth = getAuth(app);
export const db = getFirestore(app);
export const rtdb = getDatabase(app);
export const storage = getStorage(app);
export const analytics = getAnalytics(app);
export const googleProvider = new GoogleAuthProvider();
// --- 2. ADD THIS INITIALIZATION ---
// Specify the region to match your deployed functions for best performance
export const functions = getFunctions(app, 'us-central1');

// Initialize messaging for web notifications
let messaging: any = null;
if (typeof window !== 'undefined') {
  try {
    messaging = getMessaging(app);
  } catch (error) {
    console.log('Messaging not available:', error);
  }
}
// --- 3. ADD `app` to this export for consistency ---
export { messaging, app };

// Configure Google provider
googleProvider.addScope('https://www.googleapis.com/auth/calendar');
googleProvider.addScope('https://www.googleapis.com/auth/userinfo.profile');
googleProvider.addScope('https://www.googleapis.com/auth/userinfo.email');

// --- Your Phone Auth utilities remain unchanged ---
export const setupRecaptcha = (containerId: string): RecaptchaVerifier => {
  return new RecaptchaVerifier(auth, containerId, {
    size: 'normal',
    callback: () => {
      console.log('reCAPTCHA solved');
    },
    'expired-callback': () => {
      console.log('reCAPTCHA expired');
    }
  });
};

export const sendOTP = async (phoneNumber: string, recaptchaVerifier: RecaptchaVerifier) => {
  try {
    const confirmationResult = await signInWithPhoneNumber(auth, phoneNumber, recaptchaVerifier);
    return confirmationResult;
  } catch (error) {
    console.error('Error sending OTP:', error);
    throw error;
  }
};

export const verifyOTP = async (confirmationResult: any, otp: string) => {
  try {
    const result = await confirmationResult.confirm(otp);
    return result;
  } catch (error) {
    console.error('Error verifying OTP:', error);
    throw error;
  }
};