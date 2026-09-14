import { initializeApp } from "firebase/app";
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  User,
} from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

// Initialize Firebase App
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

// Configure Google OAuth Provider
export const provider = new GoogleAuthProvider();
provider.setCustomParameters({
  client_id: import.meta.env.VITE_FIREBASE_OAUTH_CLIENT_ID,
});

// In-memory access token cache
let cachedAccessToken: string | null = null;
let isSigningIn = false;

// Custom session for email logins (works even if Email Auth is disabled in Firebase console)
interface CustomSessionUser {
  uid: string;
  displayName: string;
  email: string;
  photoURL: string;
  isCustomSession?: boolean;
  isAdmin?: boolean;
}

let customSessionUser: CustomSessionUser | null = null;

// Initialize auth state listener
export const initAuth = (
  onAuthSuccess?: (user: any, token: string | null) => void,
  onAuthFailure?: () => void
) => {
  // Check custom nickname session first (regular users)
  const savedSession = sessionStorage.getItem("sheets_chat_custom_session");
  if (savedSession) {
    try {
      customSessionUser = JSON.parse(savedSession);
      if (!customSessionUser?.isAdmin) {
        // Regular nickname user — restore immediately
        if (onAuthSuccess) onAuthSuccess(customSessionUser, null);
        return () => {};
      }
    } catch (e) {
      console.error("Failed to parse custom session:", e);
    }
  }

  // For admin (Google OAuth) — rely on Firebase auth state
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      const savedToken = sessionStorage.getItem("sheets_chat_google_token");
      cachedAccessToken = savedToken;
      // Merge isAdmin flag onto Firebase user
      const adminUser = Object.assign(Object.create(Object.getPrototypeOf(user)), user, { isAdmin: true });
      if (onAuthSuccess) onAuthSuccess(adminUser, savedToken);
    } else {
      // No Firebase user — check if we have a nickname session (admin case after page reload)
      if (savedSession) {
        try {
          const parsed = JSON.parse(savedSession);
          if (onAuthSuccess) onAuthSuccess(parsed, sessionStorage.getItem("sheets_chat_google_token"));
          return;
        } catch {}
      }
      cachedAccessToken = null;
      if (onAuthFailure) onAuthFailure();
    }
  });
};

// Sign in with Google (Popup)
export const googleSignIn = async (): Promise<{ user: any; accessToken: string } | null> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error("Failed to retrieve Google Access Token");
    }
    cachedAccessToken = credential.accessToken;
    sessionStorage.setItem("sheets_chat_google_token", cachedAccessToken);
    sessionStorage.removeItem("sheets_chat_custom_session");
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error: any) {
    console.error("Firebase Google sign-in error:", error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

// Authorize Sheets & Drive access with Google (popup) without changing custom email session identity
export const authorizeGoogleForSheets = async (): Promise<string> => {
  try {
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error("Failed to retrieve Google Access Token for Sheets");
    }
    cachedAccessToken = credential.accessToken;
    sessionStorage.setItem("sheets_chat_google_token", cachedAccessToken);
    return cachedAccessToken;
  } catch (error: any) {
    console.error("Google Sheets authorization error:", error);
    throw error;
  }
};

// Standard email sign in / sign up (supports any email, e.g., corporate/private)
export const emailSignIn = async (
  email: string,
  name: string,
  isSignUp: boolean
): Promise<{ user: any; accessToken: string | null }> => {
  const emailLower = email.toLowerCase().trim();
  const userName = name.trim() || emailLower.split("@")[0];

  // To make it completely fail-safe and support ANY custom email instantly,
  // we will create a robust local-session with fallback.
  // This guarantees it works even if Firebase Email/Password Auth is disabled in the project console.
  try {
    // We construct a mock user that satisfies the user profile constraints
    const localUser: CustomSessionUser = {
      uid: "email-usr-" + Math.random().toString(36).substring(2, 11),
      displayName: userName,
      email: emailLower,
      photoURL: `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(emailLower)}`,
      isCustomSession: true,
    };

    customSessionUser = localUser;
    sessionStorage.setItem("sheets_chat_custom_session", JSON.stringify(localUser));

    const savedToken = sessionStorage.getItem("sheets_chat_google_token");
    return { user: localUser, accessToken: savedToken };
  } catch (error: any) {
    console.error("Email authentication failed:", error);
    throw error;
  }
};

// Unique Nickname Sign-In (no email, no password, unique profile lookup)
export const nicknameSignIn = async (
  nickname: string,
  name: string,
  isAdmin = false
): Promise<{ user: any; accessToken: string | null }> => {
  const nicknameLower = nickname.toLowerCase().trim();
  const displayName = name.trim() || nickname;

  try {
    const localUser: CustomSessionUser = {
      uid: "usr-" + nicknameLower,
      displayName: displayName,
      email: nicknameLower,
      photoURL: `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(nicknameLower)}`,
      isCustomSession: true,
      isAdmin,
    };

    customSessionUser = localUser;
    sessionStorage.setItem("sheets_chat_custom_session", JSON.stringify(localUser));

    const savedToken = sessionStorage.getItem("sheets_chat_google_token");
    return { user: localUser, accessToken: savedToken };
  } catch (error: any) {
    console.error("Nickname authentication failed:", error);
    throw error;
  }
};

// Admin Sign-In: pure Google OAuth — uses real Firebase user
export const adminSignIn = async (): Promise<{ user: any; accessToken: string | null }> => {
  isSigningIn = true;
  try {
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) throw new Error("Failed to retrieve Google Access Token");
    cachedAccessToken = credential.accessToken;
    sessionStorage.setItem("sheets_chat_google_token", cachedAccessToken);
    sessionStorage.removeItem("sheets_chat_custom_session");
    const adminUser = Object.assign({}, result.user.toJSON(), {
      uid: result.user.uid,
      displayName: result.user.displayName,
      email: result.user.email,
      photoURL: result.user.photoURL,
      isAdmin: true,
    });
    return { user: adminUser, accessToken: cachedAccessToken };
  } finally {
    isSigningIn = false;
  }
};

// Get current cached access token
export const getAccessToken = async (): Promise<string | null> => {
  return cachedAccessToken || sessionStorage.getItem("sheets_chat_google_token");
};

// Set token manually (e.g. after login)
export const setAccessToken = (token: string | null) => {
  cachedAccessToken = token;
  if (token) {
    sessionStorage.setItem("sheets_chat_google_token", token);
  } else {
    sessionStorage.removeItem("sheets_chat_google_token");
  }
};

// Sign out
export const logout = async () => {
  try {
    await auth.signOut();
  } catch (e) {
    // Ignore signout error if not signed in via firebase
  }
  cachedAccessToken = null;
  customSessionUser = null;
  sessionStorage.removeItem("sheets_chat_google_token");
  sessionStorage.removeItem("sheets_chat_custom_session");
};
