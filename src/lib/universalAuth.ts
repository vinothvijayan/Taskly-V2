import { signInWithCredential, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { auth, googleProvider } from './firebase';
import { isNative } from './platformDetection';

/**
 * Universal Google Sign-In that works on both web and native platforms
 * Currently optimized for web, with native support ready for plugin installation
 */
export class UniversalGoogleAuth {
  private static initialized = false;

  /**
   * Initialize Google Auth for the current platform
   */
  static async initialize() {
    if (this.initialized) return;

    if (isNative()) {
      console.log('Native platform detected - Google Auth plugin required for full functionality');
      // Note: Native functionality requires @capacitor/google-auth plugin
      // For now, we'll fall back to web auth
    }
    
    // Web initialization is handled by Firebase
    this.initialized = true;
  }

  /**
   * Sign in with Google - currently web-optimized
   */
  static async signIn() {
    await this.initialize();

    if (isNative()) {
      // Try native auth first, fall back to web if not available
      try {
        return await this.signInNative();
      } catch (error) {
        console.warn('Native Google Auth not available, falling back to web auth:', error);
        return await this.signInWeb();
      }
    } else {
      return this.signInWeb();
    }
  }

  /**
   * Native Google Sign-In using Capacitor Google Auth plugin
   */
  private static async signInNative() {
    try {
      // Check if plugin is available first
      const isPluginAvailable = await this.checkPluginAvailability();
      if (!isPluginAvailable) {
        throw new Error('Google Auth plugin not available - install @capacitor/google-auth for native authentication');
      }

      // Use eval to avoid build-time resolution issues
      const GoogleAuth = await this.loadGoogleAuthPlugin();
      if (!GoogleAuth) {
        throw new Error('Google Auth plugin not installed');
      }
      
      // Initialize if not already done
      await GoogleAuth.initialize();
      
      // Sign in with Google
      const googleUser = await GoogleAuth.signIn();
      
      // Convert Google Auth result to Firebase credential
      const credential = GoogleAuthProvider.credential(googleUser.authentication.idToken);
      
      // Sign in to Firebase with the credential
      const result = await signInWithCredential(auth, credential);
      
      console.log('Native Google Sign-In successful:', result.user.email);
      return result;
    } catch (error: any) {
      console.error('Native Google Sign-In failed:', error);
      
      // Handle specific native auth errors
      if (error.message?.includes('User cancelled')) {
        throw new Error('Sign-in was cancelled. Please try again.');
      } else if (error.message?.includes('No account selected')) {
        throw new Error('No Google account selected. Please try again.');
      }
      
      throw error;
    }
  }

  /**
   * Web Google Sign-In using Firebase popup with fallback to redirect
   */
  private static async signInWeb() {
    try {
      // Clear any existing auth state to prevent popup issues
      if (typeof window !== 'undefined' && window.sessionStorage) {
        // Clear Firebase auth redirect result storage
        Object.keys(window.sessionStorage).forEach(key => {
          if (key.startsWith('firebase:authUser:') || key.startsWith('firebase:redirectUser:')) {
            window.sessionStorage.removeItem(key);
          }
        });
      }

      const result = await signInWithPopup(auth, googleProvider);
      return result;
    } catch (error: any) {
      console.error('Web Google Sign-In failed:', error);
      
      // Handle specific popup errors
      if (error.code === 'auth/popup-closed-by-user') {
        throw new Error('Sign-in was cancelled. Please try again.');
      } else if (error.code === 'auth/popup-blocked') {
        throw new Error('Popup was blocked by your browser. Please allow popups and try again.');
      } else if (error.code === 'auth/cancelled-popup-request') {
        throw new Error('Another sign-in popup is already open. Please close it and try again.');
      } else if (error.message?.includes('initial state')) {
        // Clear storage and suggest page refresh
        if (typeof window !== 'undefined' && window.sessionStorage) {
          window.sessionStorage.clear();
        }
        throw new Error('Authentication state error. Please refresh the page and try again.');
      }
      
      throw error;
    }
  }

  /**
   * Check if Google Auth plugin is available
   */
  private static async checkPluginAvailability(): Promise<boolean> {
    try {
      const { Capacitor } = await import('@capacitor/core');
      return Capacitor.isPluginAvailable('GoogleAuth');
    } catch (error) {
      return false;
    }
  }

  /**
   * Sign out from Google Auth (both platforms)
   */
  static async signOut() {
    if (isNative()) {
      try {
        const GoogleAuth = await this.loadGoogleAuthPlugin();
        if (GoogleAuth) {
          await GoogleAuth.signOut();
          console.log('Native Google sign out completed');
        }
      } catch (error) {
        console.warn('Native Google sign out failed:', error);
      }
    }
    // Firebase sign out is handled separately in AuthContext
  }

  /**
   * Safely load Google Auth plugin without causing build failures
   */
  private static async loadGoogleAuthPlugin(): Promise<any> {
    try {
      // Use dynamic require for safer loading
      const moduleName = '@capacitor/google-auth';
      const module = await eval(`import('${moduleName}')`).catch(() => null);
      return module?.GoogleAuth || null;
    } catch (error) {
      console.warn('Failed to load Google Auth plugin:', error);
      return null;
    }
  }

  /**
   * Get plugin status for debugging
   */
  static async getStatus() {
    const isPluginAvailable = await this.checkPluginAvailability();
    return {
      isNative: isNative(),
      isPluginAvailable,
      isInitialized: this.initialized,
    };
  }
}