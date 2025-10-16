import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import {
  User,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  signInWithPopup,
  updateProfile,
  sendEmailVerification,
  sendPasswordResetEmail,
  RecaptchaVerifier,
  ConfirmationResult,
  fetchSignInMethodsForEmail,
  linkWithCredential,
  linkWithPopup,
  GoogleAuthProvider,
  OAuthProvider,
} from "firebase/auth";
import {
  collection,
  addDoc,
  getDocs,
  query,
  where,
  deleteDoc,
  doc,
  serverTimestamp,
  Timestamp,
  setDoc,
  getDoc,
  updateDoc as firestoreUpdateDoc,
  writeBatch,
  arrayUnion,
} from "firebase/firestore";
import { auth, googleProvider, db, setupRecaptcha, sendOTP, verifyOTP } from "@/lib/firebase";
import { useToast } from "@/hooks/use-toast";

// --- INTERFACES ---

interface UserProfile {
  uid: string;
  email: string;
  displayName?: string;
  photoURL?: string;
  phoneNumber?: string;
  emailVerified: boolean;
  createdAt: string;
  lastLoginAt: string;
  preferences?: {
    notifications: boolean;
    theme: 'light' | 'dark' | 'system';
    language: string;
  };
  teamId?: string | null;
  role?: 'admin' | 'user';
}

interface TeamRequest {
  id: string;
  senderId: string;
  senderName: string;
  senderEmail: string;
  receiverId: string;
  receiverEmail: string;
  status: 'pending' | 'accepted' | 'declined';
  createdAt: Timestamp;
}

interface Team {
  id: string;
  memberIds: string[];
  createdAt: Timestamp;
  createdBy: string;
}

interface AuthContextType {
  user: User | null;
  userProfile: UserProfile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, displayName?: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signInWithMicrosoft: () => Promise<void>;
  signInWithPhone: (phoneNumber: string) => Promise<ConfirmationResult>;
  verifyPhoneOTP: (confirmationResult: ConfirmationResult, otp: string) => Promise<void>;
  signOutUser: () => Promise<void>;
  updateUserProfile: (data: Partial<UserProfile>) => Promise<void>;
  sendVerificationEmail: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  setupPhoneAuth: (containerId: string) => RecaptchaVerifier;
  sendTeamRequest: (receiverEmail: string) => Promise<void>;
  fetchReceivedTeamRequests: () => Promise<TeamRequest[]>;
  acceptTeamRequest: (requestId: string, senderId: string) => Promise<void>;
  declineTeamRequest: (requestId: string) => Promise<void>;
  fetchTeamMembers: () => Promise<UserProfile[]>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthContextProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        await fetchOrCreateUserProfile(currentUser);
      } else {
        setUserProfile(null);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const fetchUserProfile = async (uid: string) => {
    const userDocRef = doc(db, "users", uid);
    const userDoc = await getDoc(userDocRef);
    if (userDoc.exists()) {
      setUserProfile(userDoc.data() as UserProfile);
    }
  };

  const fetchOrCreateUserProfile = async (user: User) => {
    const userDocRef = doc(db, "users", user.uid);
    const userDoc = await getDoc(userDocRef);

    if (userDoc.exists()) {
      const profileData = userDoc.data() as UserProfile;
      setUserProfile(profileData);
      await firestoreUpdateDoc(userDocRef, { lastLoginAt: new Date().toISOString() });
    } else {
      const newProfile: UserProfile = {
        uid: user.uid,
        email: user.email || "",
        displayName: user.displayName || "",
        photoURL: user.photoURL || "",
        phoneNumber: user.phoneNumber || "",
        emailVerified: user.emailVerified,
        createdAt: new Date().toISOString(),
        lastLoginAt: new Date().toISOString(),
        preferences: { notifications: true, theme: "system", language: "en" },
        teamId: null,
        role: 'user', // Default role for new users
      };
      await setDoc(userDocRef, newProfile);
      setUserProfile(newProfile);
    }
  };

  const signIn = async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email, password);
  };

  const signUp = async (email: string, password: string, displayName?: string) => {
    const result = await createUserWithEmailAndPassword(auth, email, password);
    if (result.user && displayName) await updateProfile(result.user, { displayName });
    if (result.user) await sendEmailVerification(result.user);
  };

  const signInWithGoogle = async () => {
    try {
      const { UniversalGoogleAuth } = await import("@/lib/universalAuth");
      await UniversalGoogleAuth.signIn();
    } catch (error) {
      console.error("Google Sign-In failed:", error);
      await signInWithPopup(auth, googleProvider);
    }
  };

  const signInWithMicrosoft = async () => {
    const microsoftProvider = new OAuthProvider("microsoft.com");

    try {
      if (!auth.currentUser) {
        throw new Error("You must be logged in with Google/Email before linking Microsoft.");
      }

      // 👉 Link Microsoft to existing user
      const result = await linkWithPopup(auth.currentUser, microsoftProvider);

      toast({
        title: "Microsoft Linked ✅",
        description: `Connected as ${result.user.displayName || result.user.email}`,
      });

      // Optionally get access token for Graph API
      const credential = OAuthProvider.credentialFromResult(result);
      const accessToken = credential?.accessToken;
      console.log("Microsoft Access Token:", accessToken);

    } catch (error: any) {
      if (error.code === "auth/credential-already-in-use") {
        toast({
          title: "Already Linked",
          description: "This Microsoft account is already linked with another user.",
          variant: "destructive",
        });
      } else {
        console.error("Microsoft linking error:", error);
        toast({
          title: "Microsoft Link Failed",
          description: error.message,
          variant: "destructive",
        });
      }
    }
  };

  const signOutUser = async () => {
    await signOut(auth);
  };

  const updateUserProfile = async (data: Partial<UserProfile>) => {
    if (!user || !userProfile) return;
    const userDocRef = doc(db, "users", user.uid);
    await firestoreUpdateDoc(userDocRef, data);
    setUserProfile({ ...userProfile, ...data });
    toast({ title: "Profile Updated! ✨" });
  };

  const sendVerificationEmail = async () => {
    if (user) await sendEmailVerification(user);
  };

  const resetPassword = async (email: string) => {
    await sendPasswordResetEmail(auth, email);
    toast({
      title: "Password reset email sent!",
      description: "Check your inbox for reset instructions.",
    });
  };

  const setupPhoneAuth = (containerId: string): RecaptchaVerifier => {
    return setupRecaptcha(containerId);
  };

  const signInWithPhone = async (phoneNumber: string): Promise<ConfirmationResult> => {
    const recaptchaVerifier = setupRecaptcha("recaptcha-container");
    return await sendOTP(phoneNumber, recaptchaVerifier);
  };

  const verifyPhoneOTP = async (confirmationResult: ConfirmationResult, otp: string) => {
    await verifyOTP(confirmationResult, otp);
  };

  // --- TEAM MANAGEMENT FUNCTIONS ---

  const sendTeamRequest = async (receiverEmail: string) => {
    if (!user || !userProfile) throw new Error("Authentication required.");
    if (user.email === receiverEmail) throw new Error("You cannot send a request to yourself.");

    const usersRef = collection(db, "users");
    const q = query(usersRef, where("email", "==", receiverEmail));
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) throw new Error("No user found with this email address.");

    const receiverDoc = querySnapshot.docs[0];

    await addDoc(collection(db, "teamRequests"), {
      senderId: user.uid,
      senderName: userProfile.displayName || user.email,
      senderEmail: user.email,
      receiverId: receiverDoc.id,
      receiverEmail: receiverDoc.data().email,
      status: "pending",
      createdAt: serverTimestamp(),
    });

    toast({ title: "Team request sent! 🚀" });
  };

  const fetchReceivedTeamRequests = async (): Promise<TeamRequest[]> => {
    if (!user) return [];
    const requestsRef = collection(db, "teamRequests");
    const q = query(requestsRef, where("receiverId", "==", user.uid), where("status", "==", "pending"));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as TeamRequest));
  };

  const acceptTeamRequest = async (requestId: string, senderId: string) => {
    if (!user) throw new Error("You must be logged in to accept a request.");

    setLoading(true);
    const batch = writeBatch(db);

    try {
      const senderRef = doc(db, "users", senderId);
      const senderDoc = await getDoc(senderRef);

      if (!senderDoc.exists()) {
        throw new Error("The user who sent the invite no longer exists.");
      }

      const senderProfile = senderDoc.data() as UserProfile;
      const existingTeamId = senderProfile.teamId;

      const receiverRef = doc(db, "users", user.uid);
      const requestRef = doc(db, "teamRequests", requestId);

      if (existingTeamId) {
        const teamRef = doc(db, "teams", existingTeamId);
        batch.update(teamRef, { memberIds: arrayUnion(user.uid) });
        batch.update(receiverRef, { teamId: existingTeamId });
      } else {
        const newTeamRef = doc(collection(db, "teams"));
        batch.set(newTeamRef, {
          memberIds: [senderId, user.uid],
          createdAt: serverTimestamp(),
          createdBy: senderId,
        });
        batch.update(senderRef, { teamId: newTeamRef.id });
        batch.update(receiverRef, { teamId: newTeamRef.id });
      }

      batch.delete(requestRef);

      await batch.commit();
      await fetchUserProfile(user.uid);

      toast({
        title: "Team request accepted! 🎉",
        description: "You are now part of the team.",
      });
    } catch (error: any) {
      console.error("Error accepting team request:", error);
      toast({ title: "Failed to accept request", description: error.message, variant: "destructive" });
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const declineTeamRequest = async (requestId: string) => {
    const requestRef = doc(db, "teamRequests", requestId);
    await deleteDoc(requestRef);
    toast({ title: "Team request declined" });
  };

  const fetchTeamMembers = async (): Promise<UserProfile[]> => {
    if (!userProfile?.teamId) return [];

    const teamDocRef = doc(db, "teams", userProfile.teamId);
    const teamDoc = await getDoc(teamDocRef);

    if (!teamDoc.exists()) {
      await firestoreUpdateDoc(doc(db, "users", userProfile.uid), { teamId: null });
      setUserProfile((prev) => (prev ? { ...prev, teamId: null } : null));
      return [];
    }

    const teamData = teamDoc.data() as Team;
    const memberProfiles: UserProfile[] = [];

    for (const memberId of teamData.memberIds) {
      const memberDocRef = doc(db, "users", memberId);
      const memberDoc = await getDoc(memberDocRef);
      if (memberDoc.exists()) {
        memberProfiles.push(memberDoc.data() as UserProfile);
      }
    }
    return memberProfiles;
  };

  const value = {
    user,
    userProfile,
    loading,
    signIn,
    signUp,
    signInWithGoogle,
    signInWithMicrosoft,
    signInWithPhone,
    verifyPhoneOTP,
    signOutUser,
    updateUserProfile,
    sendVerificationEmail,
    resetPassword,
    setupPhoneAuth,
    sendTeamRequest,
    fetchReceivedTeamRequests,
    acceptTeamRequest,
    declineTeamRequest,
    fetchTeamMembers,
  };

  return <AuthContext.Provider value={value}>{!loading && children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthContextProvider");
  }
  return context;
}