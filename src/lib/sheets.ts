import {
  collection,
  doc,
  getDocs,
  setDoc,
  deleteDoc,
  query,
  orderBy,
  where,
  onSnapshot,
  getDoc,
} from "firebase/firestore";
import { db } from "./firebase";
import { Message, Room, UserProfile, SpreadsheetConfig } from "../types";

const DEFAULT_ROOM: Room = {
  id: "ai-chat",
  name: "ai-chat",
  description: "Talk to Gemini AI assistant here! (Type anything or ask questions)",
  createdBy: "System",
  createdAt: new Date().toISOString(),
};

const WELCOME_MESSAGE = {
  id: "msg-welcome",
  roomId: "ai-chat",
  userId: "system",
  userName: "Gemini AI",
  userEmail: "bot@ripple.internal",
  userPhoto: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=120&q=80",
  text: "Hey! 👋 Welcome to Ripple. Ask me anything to start chatting!",
  replyToId: "",
};

// In-memory caches populated by real-time listeners — start immediately on module load
let cachedUsers: UserProfile[] = [];
let cachedRooms: Room[] = [];
let cachedMessages: Message[] = [];
let listenersStarted = false;

let onUsersUpdate: ((users: UserProfile[]) => void) | null = null;
let onRoomsUpdate: ((rooms: Room[]) => void) | null = null;
let onMessagesUpdate: ((messages: Message[]) => void) | null = null;

// Boot listeners immediately so cache is warm before user clicks anything
_bootListeners();

let cacheReady = false;
let cacheReadyResolvers: (() => void)[] = [];

function waitForCache(): Promise<void> {
  if (cacheReady) return Promise.resolve();
  return new Promise((resolve) => cacheReadyResolvers.push(resolve));
}

function _bootListeners() {
  if (listenersStarted) return;
  listenersStarted = true;
  onSnapshot(collection(db, "users"), (snap) => {
    cachedUsers = snap.docs.map((d) => ({ id: d.id, ...d.data() } as UserProfile));
    onUsersUpdate?.(cachedUsers);
    if (!cacheReady) {
      cacheReady = true;
      cacheReadyResolvers.forEach((r) => r());
      cacheReadyResolvers = [];
    }
  });
  onSnapshot(collection(db, "rooms"), (snap) => {
    cachedRooms = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Room));
    onRoomsUpdate?.(cachedRooms);
  });
  onSnapshot(query(collection(db, "messages"), orderBy("timestamp", "asc")), (snap) => {
    cachedMessages = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Message));
    onMessagesUpdate?.(cachedMessages);
  });
}

// Register React state callbacks — listeners already running from module boot
export function startRealtimeListeners(
  onUsers: (u: UserProfile[]) => void,
  onRooms: (r: Room[]) => void,
  onMessages: (m: Message[]) => void
) {
  onUsersUpdate = onUsers;
  onRoomsUpdate = onRooms;
  onMessagesUpdate = onMessages;
  // Fire immediately with whatever is already cached
  onUsers(cachedUsers);
  onRooms(cachedRooms);
  onMessages(cachedMessages);
}

// Re-push cached data to React state — call after login to restore state cleared on logout
export function rehydrateFromCache() {
  onUsersUpdate?.(cachedUsers);
  onRoomsUpdate?.(cachedRooms);
  onMessagesUpdate?.(cachedMessages);
}

// Seed default data if Firestore is empty
let seeded = false;
async function seedIfEmpty() {
  if (seeded) return;
  seeded = true;
  const roomSnap = await getDoc(doc(db, "rooms", "ai-chat"));
  if (!roomSnap.exists()) {
    await setDoc(doc(db, "rooms", "ai-chat"), DEFAULT_ROOM);
    await setDoc(doc(db, "messages", "msg-welcome"), {
      ...WELCOME_MESSAGE,
      timestamp: new Date().toISOString(),
    });
  }
}

// These are now just synchronous cache reads — instant, no network call
export async function fetchMessages(_token: string | null, _sheetId: string): Promise<Message[]> {
  return cachedMessages;
}

export async function fetchRooms(_token: string | null, _sheetId: string): Promise<Room[]> {
  return cachedRooms;
}

export async function fetchUsers(_token: string | null, _sheetId: string): Promise<UserProfile[]> {
  await waitForCache();
  return cachedUsers;
}

export async function postMessage(
  _token: string | null,
  _sheetId: string,
  message: Omit<Message, "timestamp">
): Promise<Message> {
  const timestamp = new Date().toISOString();
  const data = { ...message, timestamp };
  await setDoc(doc(db, "messages", message.id), data);
  return data;
}

export async function createRoom(
  _token: string | null,
  _sheetId: string,
  room: Omit<Room, "createdAt">
): Promise<Room> {
  const createdAt = new Date().toISOString();
  const data = { ...room, createdAt };
  await setDoc(doc(db, "rooms", room.id), data);
  return data;
}

export async function updateUserPresence(
  _token: string | null,
  _sheetId: string,
  profile: UserProfile
): Promise<void> {
  await setDoc(doc(db, "users", profile.id), {
    ...profile,
    lastActive: new Date().toISOString(),
  });
}

// Kept for compatibility
export async function searchDatabaseSheets(_token: string): Promise<SpreadsheetConfig[]> {
  return [];
}

export async function createDatabaseSheet(_token: string, title: string): Promise<SpreadsheetConfig> {
  await seedIfEmpty();
  return { spreadsheetId: "firestore", spreadsheetUrl: "", title };
}

// Delete all messages in a room
export async function deleteRoomMessages(roomId: string): Promise<void> {
  const snap = await getDocs(query(collection(db, "messages"), where("roomId", "==", roomId)));
  await Promise.all(snap.docs.map((d) => deleteDoc(d.ref)));
}
