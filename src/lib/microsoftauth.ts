import { PublicClientApplication, PopupRequest, SilentRequest, AuthenticationResult } from "@azure/msal-browser";

// MSAL config
const msalConfig = {
  auth: {
    clientId: "34cf9dc4-f837-4136-98c1-f66e913b4f95", // your app's Client ID
    authority: "https://login.microsoftonline.com/common", // use "common" since you allow all accounts
    redirectUri: "https://zp1v56uxy8rdx5ypatb0ockcb9tr6a-oci3--8080--96435430.local-credentialless.webcontainer-api.io", // must match Azure redirect URI
  },
  cache: {
    cacheLocation: "localStorage",
    storeAuthStateInCookie: false,
  },
};

// Create the MSAL instance
const msalInstance = new PublicClientApplication(msalConfig);

// This is the important new part: define the permissions (scopes) we need
const loginRequest: PopupRequest = {
  scopes: ["User.Read", "Notes.Read"] // We need User.Read for basic info and Notes.Read for OneNote
};

// A function to initialize MSAL. Call this in App.tsx
export const initMsal = () => {
  msalInstance.initialize();
};

/**
 * Signs the user in and acquires an access token with the necessary scopes for Notes.
 * @returns A promise that resolves with the access token string.
 */
export const signInWithMicrosoftForNotes = async (): Promise<string> => {
  try {
    // First, try to get a token silently without popping up a window
    const account = msalInstance.getAllAccounts()[0];
    if (account) {
      const silentRequest: SilentRequest = {
        ...loginRequest,
        account: account
      };
      const response: AuthenticationResult = await msalInstance.acquireTokenSilent(silentRequest);
      return response.accessToken;
    }

    // If silent fails or no user is logged in, use a popup
    const response: AuthenticationResult = await msalInstance.loginPopup(loginRequest);
    msalInstance.setActiveAccount(response.account);
    return response.accessToken;
    
  } catch (error) {
    console.error("MSAL login or token acquisition failed:", error);
    // Handle specific errors if needed, e.g., interaction_required
    if (error.name === "InteractionRequiredAuthError") {
        const response = await msalInstance.acquireTokenPopup(loginRequest);
        return response.accessToken;
    }
    throw error; // Re-throw the error to be caught by the calling function
  }
};