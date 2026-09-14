export interface Message {
  id: string;
  roomId: string;
  userId: string;
  userName: string;
  userEmail: string;
  userPhoto: string;
  text: string;
  timestamp: string;
  replyToId?: string;
}

export interface Room {
  id: string;
  name: string;
  description: string;
  createdBy: string;
  createdAt: string;
  members?: string[];
}

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  photoUrl: string;
  status: string;
  lastActive: string;
  isAdmin?: boolean;
}

export interface SpreadsheetConfig {
  spreadsheetId: string;
  spreadsheetUrl: string;
  title: string;
}
