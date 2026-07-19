import React, { useState } from "react";
import { LogOut, Users, MessageSquare, UserPlus, X, Menu } from "lucide-react";
import { UserProfile } from "../types";
import { RippleLogo } from "./RippleLogo";

interface SidebarProps {
  activeRoomId: string;
  onSelectRoom: (roomId: string) => void;
  users: UserProfile[];
  currentUserId: string;
  currentUserProfile: { name: string; email: string; photoUrl: string };
  onLogout: () => void;
  onAddMember: (nickname: string) => Promise<{ success: boolean; error?: string }>;
  isSyncing: boolean;
  lastSynced: Date | null;
  isOpen: boolean;
  onClose: () => void;
}

export default function Sidebar({
  activeRoomId,
  onSelectRoom,
  users,
  currentUserId,
  currentUserProfile,
  onLogout,
  onAddMember,
  isSyncing,
  isOpen,
  onClose,
}: SidebarProps) {
  const [showSignOutConfirm, setShowSignOutConfirm] = useState(false);
  const [showAddMember, setShowAddMember] = useState(false);
  const [addNickname, setAddNickname] = useState("");
  const [addError, setAddError] = useState("");
  const [isAdding, setIsAdding] = useState(false);

  const getRelativeTime = (isoString: string) => {
    if (!isoString) return "Offline";
    const seconds = Math.floor((Date.now() - new Date(isoString).getTime()) / 1000);
    if (seconds < 60) return "Just active";
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    return "Offline";
  };

  const allMembers = users.filter((u) => u.id !== currentUserId);

  const handleAddMember = async () => {
    const nickname = addNickname.trim().toLowerCase();
    if (!nickname) return;
    if (nickname === currentUserId.replace("usr-", "")) {
      setAddError("That's your own nickname!");
      return;
    }
    setIsAdding(true);
    const result = await onAddMember(nickname);
    setIsAdding(false);
    if (result.success) {
      setShowAddMember(false);
      setAddNickname("");
    } else {
      setAddError(result.error || "User not found.");
    }
  };

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-40 md:hidden"
          onClick={onClose}
        />
      )}

      <aside className={`
        fixed inset-y-0 left-0 z-50 w-72 h-full bg-slate-950 border-r border-slate-900 flex flex-col overflow-hidden
        transition-transform duration-300 ease-in-out
        ${isOpen ? "translate-x-0" : "-translate-x-full"}
        md:relative md:translate-x-0 md:z-auto
      `}>
      {/* Brand header */}
      <div className="p-4 border-b border-slate-900">
        <div className="flex items-center gap-2.5">
          <RippleLogo size={36} />
          <h1 className="font-bold text-slate-100 tracking-tight leading-tight">Ripple</h1>
        </div>
      </div>

      {/* Members label */}
      <div className="px-4 py-3 border-b border-slate-900/60 flex items-center gap-2">
        <Users className="w-3.5 h-3.5 text-slate-400" />
        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
          Members ({allMembers.length})
        </span>
        {isSyncing && <span className="ml-auto text-[10px] text-indigo-400 font-mono animate-pulse">syncing...</span>}
        <button
          onClick={() => { setShowAddMember(true); setAddNickname(""); setAddError(""); }}
          title="Add Member"
          className="ml-auto p-1 rounded-lg text-slate-500 hover:text-indigo-400 hover:bg-slate-800 cursor-pointer transition-colors"
        >
          <UserPlus className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Members list */}
      <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
        {allMembers.map((member) => {
          const targetRoomId = `dm-${[currentUserId, member.id].sort().join("-")}`;
          const isActive = activeRoomId === targetRoomId;
          const activeTime = getRelativeTime(member.lastActive);
          const isOnline = member.status === "online" && activeTime === "Just active";

          return (
            <button
              key={member.id}
              onClick={() => onSelectRoom(targetRoomId)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all group ${
                isActive
                  ? "bg-indigo-600 text-white shadow-lg cursor-pointer"
                  : "bg-slate-900/30 text-slate-300 hover:bg-slate-900 cursor-pointer"
              }`}
            >
              <div className="relative flex-shrink-0">
                <img
                  src={member.photoUrl || `https://api.dicebear.com/7.x/bottts/svg?seed=${member.id}`}
                  alt={member.name}
                  referrerPolicy="no-referrer"
                  className="w-8 h-8 rounded-full border border-slate-800 object-cover"
                />
                <span className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-slate-950 ${
                  isOnline ? "bg-emerald-500" : "bg-slate-600"
                }`} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <p className={`text-xs font-semibold truncate ${isActive ? "text-white" : "text-slate-200"}`}>
                    {member.name}
                    {member.isAdmin && <span className="ml-1 text-[9px] text-indigo-400 font-bold uppercase">admin</span>}
                  </p>
                  <MessageSquare className={`w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity ${
                    isActive ? "text-indigo-200" : "text-slate-500"
                  }`} />
                </div>
                <p className={`text-[10px] truncate ${isActive ? "text-indigo-200" : "text-slate-500"}`}>
                  {isOnline ? "Online" : activeTime}
                </p>
              </div>
            </button>
          );
        })}
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-slate-900 flex items-center justify-between">
        <div className="flex items-center gap-3 truncate min-w-0">
          <img
            src={currentUserProfile.photoUrl || `https://api.dicebear.com/7.x/bottts/svg?seed=${currentUserId}`}
            alt={currentUserProfile.name}
            referrerPolicy="no-referrer"
            className="w-9 h-9 rounded-full border border-slate-800 object-cover"
          />
          <div className="truncate">
            <p className="text-xs font-semibold text-slate-200 truncate">{currentUserProfile.name}</p>
            <p className="text-[10px] text-slate-500 truncate">{currentUserProfile.email}</p>
          </div>
        </div>
        <button
          onClick={() => setShowSignOutConfirm(true)}
          title="Sign Out"
          className="p-2 rounded-xl text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 border border-transparent hover:border-rose-500/15 cursor-pointer transition-colors"
        >
          <LogOut className="w-4 h-4" />
        </button>

        {showSignOutConfirm && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 w-full max-w-xs space-y-4 shadow-2xl text-center">
              <div className="w-10 h-10 rounded-full bg-rose-500/10 border border-rose-500/20 flex items-center justify-center mx-auto">
                <LogOut className="w-5 h-5 text-rose-400" />
              </div>
              <div>
                <p className="font-bold text-slate-100 text-sm">Sign out?</p>
                <p className="text-xs text-slate-500 mt-1">Do you want to sign out?</p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowSignOutConfirm(false)}
                  className="flex-1 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer transition-colors"
                >
                  No, stay
                </button>
                <button
                  onClick={onLogout}
                  className="flex-1 py-2 rounded-xl text-xs font-semibold bg-rose-600 hover:bg-rose-500 text-white cursor-pointer transition-colors"
                >
                  Yes, sign out
                </button>
              </div>
            </div>
          </div>
        )}

        {showAddMember && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 w-full max-w-xs space-y-4 shadow-2xl">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <UserPlus className="w-4 h-4 text-indigo-400" />
                  <p className="font-bold text-slate-100 text-sm">Add Member</p>
                </div>
                <button onClick={() => setShowAddMember(false)} className="text-slate-500 hover:text-slate-300 cursor-pointer">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <p className="text-xs text-slate-400">Enter the nickname of the person you want to message.</p>
              <input
                type="text"
                value={addNickname}
                onChange={(e) => { setAddNickname(e.target.value.replace(/[^a-z0-9@_]/g, "")); setAddError(""); }}
                onPaste={(e) => e.preventDefault()}
                placeholder="e.g. john@123"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono"
                onKeyDown={(e) => e.key === "Enter" && !isAdding && handleAddMember()}
                autoFocus
              />
              {addError && <p className="text-[11px] text-rose-400">{addError}</p>}
              <div className="flex gap-2">
                <button
                  onClick={() => setShowAddMember(false)}
                  className="flex-1 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddMember}
                  disabled={!addNickname.trim() || isAdding}
                  className="flex-1 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-950 disabled:text-slate-500 text-white cursor-pointer transition-colors"
                >
                  {isAdding ? "Sending..." : "Send Request"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
      </aside>
    </>
  );
}
