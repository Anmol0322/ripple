import React, { useState, useEffect, useRef } from "react";
import { motion } from "motion/react";
import {
  Lock,
  Loader2,
  ShieldCheck,
  AlertCircle,
} from "lucide-react";
import { initAuth, adminSignIn, logout, nicknameSignIn } from "./lib/firebase";
import {
  fetchUsers,
  postMessage,
  updateUserPresence,
  startRealtimeListeners,
  rehydrateFromCache,
  deleteRoomMessages,
} from "./lib/sheets";
import { Message, Room, UserProfile, SpreadsheetConfig } from "./types";

import Sidebar from "./components/Sidebar";
import ChatArea from "./components/ChatArea";
import { RippleLogo } from "./components/RippleLogo";

export default function App() {
  const [user, setUser] = useState<any>(null);
  const [accessToken, setToken] = useState<string | null>(null);
  const [needsAuth, setNeedsAuth] = useState(true);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // Login form states
  const [nicknameInput, setNicknameInput] = useState("");
  const [adminNicknameInput, setAdminNicknameInput] = useState("");
  const [adminNameInput, setAdminNameInput] = useState("");
  const [nameInput, setNameInput] = useState("");
  const [authError, setAuthError] = useState<string | null>(null);
  const [loginMethod, setLoginMethod] = useState<"nickname" | "google">("nickname");
  const [loginConfirm, setLoginConfirm] = useState<{
    type: "welcome-back" | "not-found" | "new-user" | "checking";
    name: string;
    nickname: string;
    resolvedName: string;
    isAdmin?: boolean;
  } | null>(null);

  // Form input validation states
  const isNameInvalid = nameInput.length > 0 && !/^[a-zA-Z\s]+$/.test(nameInput);
  const isNicknameInvalid = nicknameInput.length > 0 && !/^[a-z0-9@_]+$/.test(nicknameInput);
  const isAdminNicknameInvalid = adminNicknameInput.length > 0 && !/^[a-z0-9@_]+$/.test(adminNicknameInput);
  const isAdminNameInvalid = adminNameInput.length > 0 && !/^[a-zA-Z\s]+$/.test(adminNameInput);

  // Database Connection State — Firestore doesn't need a real config, use a fixed placeholder
  const [spreadsheetConfig, setSpreadsheetConfig] = useState<SpreadsheetConfig | null>(
    { spreadsheetId: "firestore", spreadsheetUrl: "", title: "Ripple DB" }
  );

  const [rooms, setRooms] = useState<Room[]>([]);
  const [activeRoomId, setActiveRoomId] = useState<string>("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);

  // Synchronizers & Loaders

  // Generate simple unique IDs
  const generateId = () => {
    return (
      Math.random().toString(36).substring(2, 11) +
      Math.random().toString(36).substring(2, 11)
    );
  };

  // 1. Listen for auth state on load
  useEffect(() => {
    const loadActiveDatabase = async () => {
      const savedConfig = sessionStorage.getItem("sheets_chat_db_config");
      if (savedConfig) {
        try {
          setSpreadsheetConfig(JSON.parse(savedConfig));
          return;
        } catch (e) {
          console.error("Failed to parse saved spreadsheet config:", e);
        }
      }

      // Try fetching active spreadsheet from server (hosted by admin)
      try {
        const res = await fetch("/api/active-spreadsheet");
        if (res.ok) {
          const data = await res.json();
          if (data.spreadsheetConfig) {
            setSpreadsheetConfig(data.spreadsheetConfig);
            sessionStorage.setItem("sheets_chat_db_config", JSON.stringify(data.spreadsheetConfig));
            return;
          }
        }
      } catch (err) {
        console.error("Failed to load active database from server:", err);
      }

      // No Google Sheets configured — use local fallback DB automatically
      const localConfig: SpreadsheetConfig = { spreadsheetId: "local", spreadsheetUrl: "", title: "Local DB" };
      setSpreadsheetConfig(localConfig);
    };

    const unsubscribe = initAuth(
      (currentUser, token) => {
        setUser(currentUser);
        setToken(token);
        setNeedsAuth(false);

      },
      () => {
        setUser(null);
        setToken(null);
        setNeedsAuth(true);
      }
    );

    return () => unsubscribe();
  }, []);

  // Start real-time listeners immediately on app load — before user even logs in
  useEffect(() => {
    startRealtimeListeners(
      (u) => setUsers(u),
      (r) => {
        setRooms(r);
      },
      (m) => setMessages(m)
    );
  }, []);

  // Update presence when user logs in
  useEffect(() => {
    if (!user || !spreadsheetConfig) return;
    const profile: UserProfile = {
      id: user.uid,
      name: user.displayName || "Anonymous User",
      email: user.email || "",
      photoUrl: user.photoURL || `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(user.email || "guest")}`,
      status: "online",
      lastActive: new Date().toISOString(),
      isAdmin: user.isAdmin || false,
    };
    updateUserPresence(null, "firestore", profile);
    const interval = setInterval(() => {
      updateUserPresence(null, "firestore", { ...profile, lastActive: new Date().toISOString() });
    }, 30000);
    return () => clearInterval(interval);
  }, [user?.uid]);

  // Handle Admin Login: name + nickname + Google OAuth
  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const nickname = adminNicknameInput.trim().toLowerCase();
    const name = adminNameInput.trim().toLowerCase();
    if (!nickname || !name) { setAuthError("Please enter your name and nickname."); return; }
    if (!/^[a-z0-9@_]+$/.test(nickname)) { setAuthError("Nickname must only contain a-z, 0-9, @, and _."); return; }
    if (!/^[a-zA-Z\s]+$/.test(name)) { setAuthError("Name must only contain alphabetic letters and spaces."); return; }
    setIsLoggingIn(true);
    setAuthError(null);
    try {
      // Firestore check first — before opening Google popup
      const existingUsers = await fetchUsers("PROXY", "firestore");
      const existingUser = existingUsers.find((u) => u.id === "usr-" + nickname);
      if (existingUser) {
        if (existingUser.name.toLowerCase().trim() !== name) {
          setAuthError(`Name doesn't match the nickname "${nickname}". Please check and try again.`);
          setIsLoggingIn(false);
          return;
        }
        if (!existingUser.isAdmin) {
          setAuthError(`The nickname "${nickname}" is already registered as a regular user, not an admin.`);
          setIsLoggingIn(false);
          return;
        }
      }
      // Firestore check passed — now open Google popup
      const result = await adminSignIn(nickname, name);
      // If new admin, save to Firestore
      if (!existingUser) {
        updateUserPresence("PROXY", "firestore", {
          id: "usr-" + nickname,
          name,
          email: nickname,
          photoUrl: `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(nickname)}`,
          status: "online",
          lastActive: new Date().toISOString(),
          isAdmin: true,
        });
      }
      setUser(result.user);
      setToken(result.accessToken);
      setNeedsAuth(false);
      rehydrateFromCache();
    } catch (err: any) {
      const isUnauthorized = err.code === "auth/unauthorized-domain" || err.message?.toLowerCase().includes("unauthorized-domain");
      if (isUnauthorized) {
        setAuthError(`Domain not authorized: Add "${window.location.hostname}" to Firebase Console → Authentication → Authorized Domains.`);
      } else if (err.code === "auth/popup-closed-by-user") {
        setAuthError("Google sign-in was cancelled.");
      } else {
        setAuthError(err.message || "Google login failed.");
      }
    } finally {
      setIsLoggingIn(false);
    }
  };

  // Handle unique Nickname Join/Login (no password, no email, unique nickname matching)
  const handleNicknameLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const nicknameRaw = nicknameInput.trim();
    const nickname = nicknameRaw.toLowerCase();
    if (!nickname) return;

    if (!/^[a-z0-9@_]+$/.test(nickname)) {
      setAuthError("Nickname must only contain small-case letters (a-z), numbers (0-9), @, and _.");
      return;
    }

    const nameRaw = nameInput.trim();
    if (!nameRaw) { setAuthError("Please enter your name."); return; }
    if (!/^[a-zA-Z\s]+$/.test(nameRaw)) { setAuthError("Name must only contain alphabetic letters and spaces."); return; }

    setIsLoggingIn(true);
    setAuthError(null);

    // Show confirmation immediately without waiting for Firestore
    const enteredName = nameInput.trim().toLowerCase();
    setLoginConfirm({ type: "checking", name: enteredName, nickname, resolvedName: enteredName, isAdmin: false });
    setIsLoggingIn(false);

    // Check in background and update confirmation type
    fetchUsers("PROXY", "firestore").then((existingUsers) => {
      const existingUser = existingUsers.find((u) => u.id === "usr-" + nickname);
      if (existingUser) {
        if (existingUser.name.toLowerCase().trim() === enteredName) {
          setLoginConfirm({ type: "welcome-back", name: enteredName, nickname, resolvedName: existingUser.name.toLowerCase(), isAdmin: false });
        } else {
          setLoginConfirm({ type: "not-found", name: enteredName, nickname, resolvedName: enteredName, isAdmin: false });
        }
      } else {
        setLoginConfirm({ type: "new-user", name: enteredName, nickname, resolvedName: enteredName, isAdmin: false });
      }
    }).catch(() => {
      setLoginConfirm({ type: "new-user", name: enteredName, nickname, resolvedName: enteredName, isAdmin: false });
    });
  };

  const handleConfirmLogin = async (proceed: boolean) => {
    if (!proceed) { setLoginConfirm(null); return; }
    if (!loginConfirm) return;
    const { nickname, resolvedName, type } = loginConfirm;
    setIsLoggingIn(true);
    try {
      if (type === "new-user" && spreadsheetConfig) {
        updateUserPresence("PROXY", spreadsheetConfig.spreadsheetId, {
          id: "usr-" + nickname,
          name: resolvedName,
          email: nickname,
          photoUrl: `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(nickname)}`,
          status: "online",
          lastActive: new Date().toISOString(),
          isAdmin: false,
        });
      }
      const result = await nicknameSignIn(nickname, resolvedName, false);
      setUser(result.user);
      setToken(result.accessToken);
      setNeedsAuth(false);
      setLoginConfirm(null);
      setActiveRoomId("");
      rehydrateFromCache();
    } catch (err: any) {
      setAuthError(err.message || "Login failed.");
      setLoginConfirm(null);
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    setUser(null);
    setToken(null);
    setNeedsAuth(true);
    setSpreadsheetConfig({ spreadsheetId: "firestore", spreadsheetUrl: "", title: "Ripple DB" });
    sessionStorage.removeItem("sheets_chat_db_config");
    setRooms([]);
    setMessages([]);
    setUsers([]);
    setActiveRoomId("");
    setNameInput("");
    setNicknameInput("");
    setAdminNicknameInput("");
    setAdminNameInput("");
    setAuthError(null);
  };

  // Handle adding a member by nickname to open a DM
  const handleAddMember = async (nickname: string): Promise<{ success: boolean; error?: string }> => {
    if (!spreadsheetConfig) return { success: false, error: "No database connected." };
    const targetId = "usr-" + nickname;
    let found = users.find((u) => u.id === targetId);
    if (!found) {
      try {
        const sheetsUsers = await fetchUsers(accessToken || "PROXY", spreadsheetConfig.spreadsheetId);
        found = sheetsUsers.find((u) => u.id === targetId);
      } catch (e) {
        return { success: false, error: "Failed to search for user." };
      }
    }
    if (!found) return { success: false, error: `No user found with nickname "${nickname}".` };

    const dmRoomId = `dm-${[user.uid, targetId].sort().join("-")}`;

    // Send a hi message to the DM room
    const hiMessage: Omit<Message, "timestamp"> = {
      id: `msg-${generateId()}`,
      roomId: dmRoomId,
      userId: user.uid,
      userName: user.displayName || "Anonymous User",
      userEmail: user.email || "",
      userPhoto: user.photoURL || `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(user.email || "guest")}`,
      text: `👋 Hi! I'd like to connect with you.`,
      replyToId: "",
    };

    try {
      await postMessage(accessToken || "PROXY", spreadsheetConfig.spreadsheetId, hiMessage);
    } catch (e) {
      return { success: false, error: "Failed to send message." };
    }

    setActiveRoomId(dmRoomId);
    setUsers((prev) => prev.find((u) => u.id === targetId) ? prev : [...prev, found!]);
    return { success: true };
  };

  // Admin: delete conversation — wipe messages, post system notice, friend stays in sidebar
  const handleDeleteConversation = async (roomId: string) => {
    await deleteRoomMessages(roomId);
    const systemMsg = {
      id: `msg-${generateId()}`,
      roomId,
      userId: "system",
      userName: "System",
      userEmail: "",
      userPhoto: "",
      text: "🗑️ Chat was cleared by admin.",
      replyToId: "",
    };
    await postMessage(null, "firestore", systemMsg);
  };

  // Admin: remove friend — wipe messages, no system notice, friend disappears from sidebar
  const handleRemoveFriend = async (roomId: string) => {
    await deleteRoomMessages(roomId);
    setMessages((prev) => prev.filter((m) => m.roomId !== roomId));
    setActiveRoomId("");
  };

  const handleSendMessage = async (text: string, replyToId?: string) => {
    if (!spreadsheetConfig || !user) return;
    const msgId = `msg-${generateId()}`;
    const userMessage: Omit<Message, "timestamp"> = {
      id: msgId,
      roomId: activeRoomId,
      userId: user.uid,
      userName: user.displayName || "Anonymous User",
      userEmail: user.email || "",
      userPhoto: user.photoURL || `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(user.email || "guest")}`,
      text,
      replyToId: replyToId || "",
    };
    try {
      await postMessage(accessToken || "PROXY", spreadsheetConfig.spreadsheetId, userMessage);
    } catch (err: any) {
      console.error("Error posting message:", err);
    }
  };

  const activeRoomObj = rooms.find((r) => r.id === activeRoomId) || (() => {
    if (activeRoomId && activeRoomId.startsWith("dm-") && user) {
      const withoutPrefix = activeRoomId.slice(3);
      const otherUserId = withoutPrefix.startsWith(user.uid)
        ? withoutPrefix.slice(user.uid.length + 1)
        : withoutPrefix.slice(0, withoutPrefix.length - user.uid.length - 1);
      const otherUser = users.find((u) => u.id === otherUserId);
      const fromMsg = messages.find((m) => m.roomId === activeRoomId && m.userId === otherUserId);
      const otherName = otherUser?.name || fromMsg?.userName || otherUserId?.replace("usr-", "") || "Unknown";
      return {
        id: activeRoomId,
        name: otherName,
        description: `Direct message with ${otherName}`,
        createdBy: "System",
        createdAt: new Date().toISOString(),
      };
    }
    return null;
  })();

  if (loginConfirm) {
    const { type, resolvedName, nickname } = loginConfirm;
    const isNotFound = type === "not-found";
    const isWelcomeBack = type === "welcome-back";
    const isChecking = type === "checking";

    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4">
        <div className="absolute top-[-30%] left-[-20%] w-[70%] h-[70%] rounded-full bg-indigo-500/10 blur-[150px] pointer-events-none" />
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-slate-900/80 backdrop-blur-md border border-slate-800 rounded-3xl p-8 w-full max-w-sm shadow-2xl space-y-6 text-center relative z-10"
        >
          <div className={`w-14 h-14 rounded-full flex items-center justify-center mx-auto text-2xl border ${
            isNotFound ? "bg-rose-500/10 border-rose-500/20" : "bg-indigo-500/10 border-indigo-500/20"
          }`}>
            {isChecking ? <Loader2 className="w-6 h-6 text-indigo-400 animate-spin" /> : isWelcomeBack ? "👋" : isNotFound ? "🤔" : "✨"}
          </div>

          {isChecking && (
            <div>
              <p className="font-black text-xl text-slate-100">Just a sec...</p>
              <p className="text-sm text-slate-400 mt-1">Checking your account</p>
            </div>
          )}

          {isWelcomeBack && (
            <>
              <div>
                <p className="font-black text-xl text-slate-100">Welcome back!</p>
                <p className="text-sm text-slate-400 mt-1">Logged in as <span className="text-indigo-400 font-semibold">{resolvedName}</span></p>
              </div>
              <button
                onClick={() => handleConfirmLogin(true)}
                disabled={isLoggingIn}
                className="w-full bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl py-3 font-bold text-sm cursor-pointer transition-all"
              >
                {isLoggingIn ? "Entering..." : "Enter Ripple"}
              </button>
            </>
          )}

          {isNotFound && (
            <>
              <div>
                <p className="font-black text-xl text-slate-100">User not found</p>
                <p className="text-sm text-slate-400 mt-1 leading-relaxed">
                  We couldn't find anyone with the name <span className="text-rose-400 font-semibold">{resolvedName}</span> and nickname <span className="text-rose-400 font-semibold">{nickname}</span>.
                </p>
                <p className="text-xs text-slate-500 mt-2">Are you a new user who wants to join?</p>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => handleConfirmLogin(false)}
                  className="flex-1 py-2.5 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer transition-colors"
                >
                  Go back
                </button>
                <button
                  onClick={() => handleConfirmLogin(true)}
                  disabled={isLoggingIn}
                  className="flex-1 py-2.5 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white cursor-pointer transition-colors"
                >
                  {isLoggingIn ? "Joining..." : "Yes, join"}
                </button>
              </div>
            </>
          )}

          {type === "new-user" && (
            <>
              <div>
                <p className="font-black text-xl text-slate-100">Welcome to Ripple!</p>
                <p className="text-sm text-slate-400 mt-1 leading-relaxed">
                  You'll join as <span className="text-indigo-400 font-semibold">{resolvedName}</span> with nickname <span className="text-indigo-400 font-semibold">{nickname}</span>.
                </p>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => handleConfirmLogin(false)}
                  className="flex-1 py-2.5 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer transition-colors"
                >
                  Go back
                </button>
                <button
                  onClick={() => handleConfirmLogin(true)}
                  disabled={isLoggingIn}
                  className="flex-1 py-2.5 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white cursor-pointer transition-colors"
                >
                  {isLoggingIn ? "Joining..." : "Let's go!"}
                </button>
              </div>
            </>
          )}
        </motion.div>
      </div>
    );
  }

  // Render highly-polished login/welcome dashboard
  if (needsAuth) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4 relative overflow-hidden font-sans">
        {/* Glow ambient design backdrops */}
        <div className="absolute top-[-30%] left-[-20%] w-[70%] h-[70%] rounded-full bg-indigo-500/10 blur-[150px] pointer-events-none" />
        <div className="absolute bottom-[-30%] right-[-20%] w-[70%] h-[70%] rounded-full bg-violet-600/15 blur-[150px] pointer-events-none" />

        <div className="w-full max-w-4xl grid grid-cols-1 md:grid-cols-12 gap-8 items-center relative z-10">
          {/* Left panel branding */}
          <div className="md:col-span-7 space-y-8 text-left">
            <div className="flex items-center gap-4">
              <RippleLogo size={64} />
              <h1 className="text-4xl sm:text-5xl font-black tracking-tight text-slate-100">
                Ripple
              </h1>
            </div>

            <div className="space-y-4">
              <p className="text-indigo-400 font-black text-2xl sm:text-4xl tracking-tight leading-tight max-w-xl">
                How one message starts a whole conversation 😉
              </p>
              <p className="text-slate-400 text-sm leading-relaxed max-w-sm">
                Your own private space to chat with people you trust. No ads, no tracking — just you and your people.
              </p>
              <div className="space-y-2 pt-1">
                {[
                  { icon: "🔐", text: "Only invited members can join your conversations" },
                  { icon: "💬", text: "Start private 1-on-1 chats instantly" },
                ].map((item) => (
                  <div key={item.text} className="flex items-center gap-2.5 text-xs text-slate-400">
                    <span className="text-base leading-none">{item.icon}</span>
                    <span>{item.text}</span>
                  </div>
                ))}
{/* <div className="flex items-center gap-2.5 mt-1 px-3 py-2 rounded-xl bg-indigo-500/10 border border-indigo-500/20 w-fit">
                  <span className="text-base leading-none">👑</span>
                  <span className="text-xs font-semibold text-indigo-400">Be an admin and join friends to your private conversations</span>
                </div> */}
              </div>
            </div>

            <div className="flex items-center gap-2 text-slate-500 font-mono text-[11px] bg-slate-950 px-3.5 py-1.5 rounded-xl border border-slate-900 w-fit">
              <Lock className="w-3.5 h-3.5 text-indigo-400" />
              <span>SECURE END-TO-END ENCRYPTED CONVERSATION</span>
            </div>
          </div>

          {/* Right login container */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2, duration: 0.5 }}
            className="md:col-span-5 bg-slate-900/50 backdrop-blur-md border border-slate-900 p-6 sm:p-8 rounded-3xl shadow-2xl space-y-6 text-center flex flex-col justify-between"
          >
            <div className="space-y-5">
              {/* Login tab toggle */}
              <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800/60">
                <button
                  type="button"
                  onClick={() => { setLoginMethod("nickname"); setAuthError(null); }}
                  className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                    loginMethod === "nickname"
                      ? "bg-indigo-600 text-white shadow-lg"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  Join
                </button>
                <button
                  type="button"
                  onClick={(e) => e.preventDefault()}
                  className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all cursor-not-allowed ${
                    loginMethod === "google"
                      ? "bg-indigo-600 text-white shadow-lg"
                      : "text-slate-400 hover:text-slate-200"
                  } flex items-center justify-center gap-1.5`}
                >
                  <Lock className="w-3 h-3" />
                  Admin Login
                </button>
              </div>

              {authError && (
                <div className="p-3.5 bg-rose-500/10 border border-rose-500/20 rounded-xl flex gap-2.5 text-rose-300 text-xs text-left">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-400 mt-0.5" />
                  <p className="leading-relaxed">{authError}</p>
                </div>
              )}

              {loginMethod === "google" ? (
                <form onSubmit={handleAdminLogin} className="space-y-4 text-left">
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Enter your name and nickname, then verify with Google.
                  </p>
                  <div className="space-y-3.5">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Your Name</label>
                      <input
                        type="text"
                        value={adminNameInput}
                        onChange={(e) => {
                          const val = e.target.value.toLowerCase().replace(/[^a-z\s]/g, "").slice(0, 30);
                          setAdminNameInput(val);
                        }}
                        onPaste={(e) => e.preventDefault()}
                        placeholder="Enter your name (lowercase)"
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all"
                        required
                      />
                      {isAdminNameInvalid && (
                        <p className="text-[10px] text-rose-500 mt-1.5">⚠️ Name must only contain alphabetic letters and spaces.</p>
                      )}
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Nickname</label>
                      <input
                        type="text"
                        value={adminNicknameInput}
                        onChange={(e) => { setAdminNicknameInput(e.target.value.replace(/[^a-z0-9@_]/g, "")); setAuthError(null); }}
                        onPaste={(e) => e.preventDefault()}
                        placeholder="Enter your nickname"
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all font-mono"
                        required
                      />
                      {isAdminNicknameInvalid && (
                        <p className="text-[10px] text-rose-500 mt-1.5">⚠️ Only small-case letters, numbers, @, and _ are allowed.</p>
                      )}
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isLoggingIn || !adminNicknameInput.trim() || !adminNameInput.trim() || isAdminNicknameInvalid || isAdminNameInvalid}
                    className="w-full flex items-center justify-center gap-3.5 py-3 px-4 rounded-xl font-bold text-sm bg-white hover:bg-slate-50 text-slate-900 shadow-xl border border-slate-200 cursor-pointer disabled:bg-slate-800 disabled:text-slate-600 disabled:border-slate-900 disabled:cursor-not-allowed transition-all hover:scale-[1.01] active:scale-[0.99] mt-2"
                  >
                    {isLoggingIn ? (
                      <>
                        <Loader2 className="w-4 h-4 text-slate-900 animate-spin" />
                        <span>Connecting to Google...</span>
                      </>
                    ) : (
                      <>
                        <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 48 48">
                          <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
                          <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
                          <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
                          <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
                          <path fill="none" d="M0 0h48v48H0z" />
                        </svg>
                        <span>Verify with Google</span>
                      </>
                    )}
                  </button>
                </form>
              ) : (
                <form onSubmit={handleNicknameLogin} className="space-y-4 text-left">
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Enter your name and a nickname to join
                  </p>
                  
                  <div className="space-y-3.5">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                        Your Name
                      </label>
                      <input
                        type="text"
                        value={nameInput}
                        onChange={(e) => {
                          const val = e.target.value.toLowerCase().replace(/[^a-z\s]/g, "").slice(0, 30);
                          setNameInput(val);
                        }}
                        onPaste={(e) => e.preventDefault()}
                        placeholder="Enter your name (lowercase)"
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all"
                        pattern="^[a-zA-Z\s]+$"
                        title="Only alphabetic letters and spaces are allowed."
                        required
                      />
                      {isNameInvalid && (
                        <p className="text-[10px] text-rose-500 mt-1.5 leading-relaxed font-sans flex items-center gap-1.5">
                          <span>⚠️ Name must only contain alphabetic letters and spaces.</span>
                        </p>
                      )}
                    </div>
                    
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                        Unique Nickname
                      </label>
                      <input
                        type="text"
                        value={nicknameInput}
                        onChange={(e) => setNicknameInput(e.target.value)}
                        onPaste={(e) => e.preventDefault()}
                        placeholder="Enter your nickname"
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all font-mono"
                        pattern="^[a-z0-9@_]+$"
                        title="Only small case letters (a-z), numbers (0-9), @, and _ are allowed."
                        required
                      />
                      {isNicknameInvalid && (
                        <p className="text-[10px] text-rose-500 mt-1.5 leading-relaxed font-sans flex items-center gap-1.5">
                          <span>⚠️ Nickname must only contain small case letters, numbers, @, and _.</span>
                        </p>
                      )}
                      <p className="text-[10px] text-slate-500 mt-1.5 leading-relaxed font-sans">
                        💡 <strong>Tip:</strong> Returning? Enter the correct name & nickname to jump back into your chats!
                      </p>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isLoggingIn || isNameInvalid || isNicknameInvalid || !nicknameInput || !nameInput}
                    className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-950 disabled:text-slate-500 disabled:border-slate-900 disabled:cursor-not-allowed text-white rounded-xl py-3 px-4 font-bold text-xs flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-indigo-600/25 transition-all"
                  >
                    {isLoggingIn ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Joining...</span>
                      </>
                    ) : (
                      <span>Join</span>
                    )}
                  </button>
                </form>
              )}
            </div>

            <div className="pt-4 border-t border-slate-900/80">
              <div className="flex items-center gap-2 justify-center text-[10px] text-slate-500 font-mono">
                <ShieldCheck className="w-4 h-4 text-emerald-500" />
                <span>Protected Access</span>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    );
  }

  // Render the core full-featured Slack/Discord-style Workspace dashboard
  return (
    <div className="w-full h-screen flex bg-slate-900 text-slate-100 overflow-hidden relative">
      {/* Sidebar Navigation */}
      <Sidebar
        activeRoomId={activeRoomId}
        onSelectRoom={setActiveRoomId}
        users={(() => {
          if (!user) return [];
          const dmRoomIds = [...new Set(messages
            .filter((m) => m.roomId.startsWith("dm-") && m.roomId.includes(user.uid))
            .map((m) => m.roomId)
          )];
          return dmRoomIds.map((roomId) => {
            // Extract other user ID directly from room ID — format: dm-{uid1}-{uid2} where uids start with usr-
            const withoutPrefix = roomId.slice(3); // remove "dm-"
            const otherUserId = withoutPrefix.startsWith(user.uid)
              ? withoutPrefix.slice(user.uid.length + 1)
              : withoutPrefix.slice(0, withoutPrefix.length - user.uid.length - 1);
            if (!otherUserId) return null;
            const fromUsers = users.find((u) => u.id === otherUserId);
            const fromMsg = messages.find((m) => m.roomId === roomId && m.userId === otherUserId);
            return fromUsers || {
              id: otherUserId,
              name: fromMsg?.userName || otherUserId.replace("usr-", ""),
              email: otherUserId.replace("usr-", ""),
              photoUrl: `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(otherUserId)}`,
              status: "offline",
              lastActive: "",
            };
          }).filter(Boolean) as any[];
        })()}
        currentUserId={user?.uid || ""}
        currentUserProfile={{
          name: user?.displayName || "Anonymous User",
          email: user?.email || "",
          photoUrl: user?.photoURL || "",
        }}
        onLogout={handleLogout}
        onAddMember={handleAddMember}
        isSyncing={false}
        lastSynced={null}
      />

      {/* Main Conversation Canvas */}
      <ChatArea
        activeRoom={activeRoomObj}
        messages={messages}
        currentUserId={user?.uid || ""}
        isAdmin={user?.isAdmin || false}
        onSendMessage={handleSendMessage}
        onDeleteConversation={handleDeleteConversation}
        onRemoveFriend={handleRemoveFriend}
      />


    </div>
  );
}
