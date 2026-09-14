import React, { useState } from "react";
import { LogOut, Users, MessageSquare, UserPlus, X, Hash, Plus, Settings, Trash2, UserMinus } from "lucide-react";
import { UserProfile, Room } from "../types";
import { RippleLogo } from "./RippleLogo";

interface SidebarProps {
  activeRoomId: string;
  onSelectRoom: (roomId: string) => void;
  users: UserProfile[];
  allUsers: UserProfile[];
  rooms: Room[];
  currentUserId: string;
  isAdmin: boolean;
  currentUserProfile: { name: string; email: string; photoUrl: string };
  onLogout: () => void;
  onAddMember: (nickname: string) => Promise<{ success: boolean; error?: string }>;
  onCreateRoom: (name: string, description: string, memberIds: string[]) => Promise<{ success: boolean; error?: string }>;
  onDeleteConversation: (roomId: string) => Promise<void>;
  onRemoveRoom: (roomId: string) => Promise<void>;
  onRemoveMember: (roomId: string) => Promise<void>;
  isSyncing: boolean;
  lastSynced: Date | null;
  isOpen: boolean;
  onClose: () => void;
}

export default function Sidebar({
  activeRoomId,
  onSelectRoom,
  users,
  allUsers,
  rooms,
  currentUserId,
  isAdmin,
  currentUserProfile,
  onLogout,
  onAddMember,
  onCreateRoom,
  onDeleteConversation,
  onRemoveRoom,
  onRemoveMember,
  isSyncing,
  isOpen,
  onClose,
}: SidebarProps) {
  const [showSignOutConfirm, setShowSignOutConfirm] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [settingsConfirm, setSettingsConfirm] = useState<{ type: "deleteConvo" | "removeRoom" | "removeMember"; roomId: string; label: string } | null>(null);
  const [showAddMember, setShowAddMember] = useState(false);
  const [addNickname, setAddNickname] = useState("");
  const [addError, setAddError] = useState("");
  const [isAdding, setIsAdding] = useState(false);

  const [showCreateRoom, setShowCreateRoom] = useState(false);
  const [roomName, setRoomName] = useState("");
  const [roomDesc, setRoomDesc] = useState("");
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [memberNicknameInput, setMemberNicknameInput] = useState("");
  const [memberAddError, setMemberAddError] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState("");

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

  // DM partners — users who have exchanged messages with current user
  const dmUsers = users.filter((u) => u.id !== currentUserId);

  // Group rooms current user is a member of
  const groupRooms = rooms.filter(
    (r) => !r.id.startsWith("dm-") && r.id !== "ai-chat" && r.members?.includes(currentUserId)
  );

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

  const handleCreateRoom = async () => {
    const name = roomName.trim();
    if (!name) { setCreateError("Room name is required."); return; }
    if (selectedMembers.length === 0) { setCreateError("Select at least one member."); return; }
    setIsCreating(true);
    setCreateError("");
    const result = await onCreateRoom(name, roomDesc.trim(), selectedMembers);
    setIsCreating(false);
    if (result.success) {
      setShowCreateRoom(false);
      setRoomName("");
      setRoomDesc("");
      setSelectedMembers([]);
    } else {
      setCreateError(result.error || "Failed to create room.");
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

        <div className="flex-1 overflow-y-auto">
          {/* Rooms section */}
          <div className="px-4 py-3 border-b border-slate-900/60 flex items-center gap-2">
            <Hash className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Rooms ({groupRooms.length})
            </span>
            {isAdmin && (
              <button
                onClick={() => { setShowCreateRoom(true); setRoomName(""); setRoomDesc(""); setSelectedMembers([]); setCreateError(""); }}
                title="Create Room"
                className="ml-auto p-1 rounded-lg text-slate-500 hover:text-indigo-400 hover:bg-slate-800 cursor-pointer transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="p-3 space-y-1.5">
            {groupRooms.length === 0 ? (
              <p className="text-[11px] text-slate-600 px-2 py-1">No rooms yet.</p>
            ) : (
              groupRooms.map((room) => {
                const isActive = activeRoomId === room.id;
                return (
                  <button
                    key={room.id}
                    onClick={() => onSelectRoom(room.id)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all ${
                      isActive
                        ? "bg-indigo-600 text-white shadow-lg cursor-pointer"
                        : "bg-slate-900/30 text-slate-300 hover:bg-slate-900 cursor-pointer"
                    }`}
                  >
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${isActive ? "bg-indigo-500" : "bg-slate-800"}`}>
                      <Hash className={`w-4 h-4 ${isActive ? "text-white" : "text-slate-400"}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-xs font-semibold truncate ${isActive ? "text-white" : "text-slate-200"}`}>
                        {room.name}
                      </p>
                      <p className={`text-[10px] truncate ${isActive ? "text-indigo-200" : "text-slate-500"}`}>
                        {room.members?.length ?? 0} members
                      </p>
                    </div>
                  </button>
                );
              })
            )}
          </div>

          {/* DMs section */}
          <div className="px-4 py-3 border-t border-slate-900/60 flex items-center gap-2">
            <Users className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Members ({dmUsers.length})
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

          <div className="p-3 space-y-1.5">
            {dmUsers.map((member) => {
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
          <div className="flex items-center gap-1 flex-shrink-0">
            {isAdmin && (
              <button
                onClick={() => setShowSettings(true)}
                title="Settings"
                className="p-2 rounded-xl text-slate-500 hover:text-indigo-400 hover:bg-slate-800 border border-transparent hover:border-slate-700 cursor-pointer transition-colors"
              >
                <Settings className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={() => setShowSignOutConfirm(true)}
              title="Sign Out"
              className="p-2 rounded-xl text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 border border-transparent hover:border-rose-500/15 cursor-pointer transition-colors"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Sign out confirm modal */}
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
              <button onClick={() => setShowSignOutConfirm(false)} className="flex-1 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer transition-colors">No, stay</button>
              <button onClick={onLogout} className="flex-1 py-2 rounded-xl text-xs font-semibold bg-rose-600 hover:bg-rose-500 text-white cursor-pointer transition-colors">Yes, sign out</button>
            </div>
          </div>
        </div>
      )}

      {/* Add member modal */}
      {showAddMember && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 w-full max-w-xs space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <UserPlus className="w-4 h-4 text-indigo-400" />
                <p className="font-bold text-slate-100 text-sm">Add Member</p>
              </div>
              <button onClick={() => setShowAddMember(false)} className="text-slate-500 hover:text-slate-300 cursor-pointer"><X className="w-4 h-4" /></button>
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
              <button onClick={() => setShowAddMember(false)} className="flex-1 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer transition-colors">Cancel</button>
              <button onClick={handleAddMember} disabled={!addNickname.trim() || isAdding} className="flex-1 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-950 disabled:text-slate-500 text-white cursor-pointer transition-colors">
                {isAdding ? "Sending..." : "Send Request"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create room modal — admin only */}
      {showCreateRoom && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 w-full max-w-sm space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Hash className="w-4 h-4 text-indigo-400" />
                <p className="font-bold text-slate-100 text-sm">Create Room</p>
              </div>
              <button onClick={() => setShowCreateRoom(false)} className="text-slate-500 hover:text-slate-300 cursor-pointer"><X className="w-4 h-4" /></button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Room Name</label>
                <input
                  type="text"
                  value={roomName}
                  onChange={(e) => { setRoomName(e.target.value); setCreateError(""); }}
                  placeholder="e.g. general"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Description <span className="text-slate-600 normal-case font-normal">(optional)</span></label>
                <input
                  type="text"
                  value={roomDesc}
                  onChange={(e) => setRoomDesc(e.target.value)}
                  placeholder="What's this room about?"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Add Members by Nickname</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={memberNicknameInput}
                    onChange={(e) => { setMemberNicknameInput(e.target.value.replace(/[^a-z0-9@_]/g, "")); setMemberAddError(""); }}
                    onPaste={(e) => e.preventDefault()}
                    placeholder="Enter nickname"
                    className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        const nick = memberNicknameInput.trim();
                        if (!nick) return;
                        const id = "usr-" + nick;
                        if (id === currentUserId) { setMemberAddError("That's you!"); return; }
                        if (selectedMembers.includes(id)) { setMemberAddError("Already added."); return; }
                        const exists = allUsers.find((u) => u.id === id);
                        if (!exists) { setMemberAddError(`"${nick}" not found.`); return; }
                        setSelectedMembers((prev) => [...prev, id]);
                        setMemberNicknameInput("");
                        setMemberAddError("");
                      }
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const nick = memberNicknameInput.trim();
                      if (!nick) return;
                      const id = "usr-" + nick;
                      if (id === currentUserId) { setMemberAddError("That's you!"); return; }
                      if (selectedMembers.includes(id)) { setMemberAddError("Already added."); return; }
                      const exists = allUsers.find((u) => u.id === id);
                      if (!exists) { setMemberAddError(`"${nick}" not found.`); return; }
                      setSelectedMembers((prev) => [...prev, id]);
                      setMemberNicknameInput("");
                      setMemberAddError("");
                    }}
                    className="px-3 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white cursor-pointer transition-colors flex-shrink-0"
                  >
                    Add
                  </button>
                </div>
                {memberAddError && <p className="text-[11px] text-rose-400 mt-1">{memberAddError}</p>}
                {selectedMembers.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {selectedMembers.map((id) => {
                      const u = allUsers.find((u) => u.id === id);
                      const label = u?.name || id.replace("usr-", "");
                      return (
                        <span key={id} className="flex items-center gap-1 bg-indigo-600/20 border border-indigo-500/30 text-indigo-300 text-[11px] px-2 py-0.5 rounded-full">
                          {label}
                          <button type="button" onClick={() => setSelectedMembers((prev) => prev.filter((m) => m !== id))} className="text-indigo-400 hover:text-rose-400 cursor-pointer">
                            <X className="w-2.5 h-2.5" />
                          </button>
                        </span>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {createError && <p className="text-[11px] text-rose-400">{createError}</p>}

            <div className="flex gap-2">
              <button onClick={() => setShowCreateRoom(false)} className="flex-1 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer transition-colors">Cancel</button>
              <button onClick={handleCreateRoom} disabled={!roomName.trim() || isCreating} className="flex-1 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-950 disabled:text-slate-500 text-white cursor-pointer transition-colors">
                {isCreating ? "Creating..." : "Create Room"}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Settings modal — admin only */}
      {showSettings && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 w-full max-w-sm shadow-2xl space-y-4 max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-2">
                <Settings className="w-4 h-4 text-indigo-400" />
                <p className="font-bold text-slate-100 text-sm">Settings</p>
              </div>
              <button onClick={() => setShowSettings(false)} className="text-slate-500 hover:text-slate-300 cursor-pointer"><X className="w-4 h-4" /></button>
            </div>

            <div className="overflow-y-auto space-y-4 flex-1">
              {/* Rooms */}
              {groupRooms.length > 0 && (
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Rooms</p>
                  <div className="space-y-1.5">
                    {groupRooms.map((room) => (
                      <div key={room.id} className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-slate-800/50">
                        <div className="flex items-center gap-2 min-w-0">
                          <Hash className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                          <span className="text-xs text-slate-200 truncate">{room.name}</span>
                        </div>
                        <div className="flex gap-1 flex-shrink-0">
                          <button
                            onClick={() => setSettingsConfirm({ type: "deleteConvo", roomId: room.id, label: room.name })}
                            title="Delete messages"
                            className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 cursor-pointer transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setSettingsConfirm({ type: "removeRoom", roomId: room.id, label: room.name })}
                            title="Remove room"
                            className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 cursor-pointer transition-colors"
                          >
                            <UserMinus className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* DM Members */}
              {dmUsers.length > 0 && (
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Members</p>
                  <div className="space-y-1.5">
                    {dmUsers.map((member) => {
                      const dmRoomId = `dm-${[currentUserId, member.id].sort().join("-")}`;
                      return (
                        <div key={member.id} className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-slate-800/50">
                          <div className="flex items-center gap-2 min-w-0">
                            <img src={member.photoUrl || `https://api.dicebear.com/7.x/bottts/svg?seed=${member.id}`} alt={member.name} className="w-5 h-5 rounded-full border border-slate-700 flex-shrink-0" />
                            <span className="text-xs text-slate-200 truncate">{member.name}</span>
                          </div>
                          <div className="flex gap-1 flex-shrink-0">
                            <button
                              onClick={() => setSettingsConfirm({ type: "deleteConvo", roomId: dmRoomId, label: member.name })}
                              title="Delete conversation"
                              className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 cursor-pointer transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => setSettingsConfirm({ type: "removeMember", roomId: dmRoomId, label: member.name })}
                              title="Remove member"
                              className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 cursor-pointer transition-colors"
                            >
                              <UserMinus className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {groupRooms.length === 0 && dmUsers.length === 0 && (
                <p className="text-xs text-slate-600 text-center py-4">No rooms or members yet.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Settings action confirm modal */}
      {settingsConfirm && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 w-full max-w-xs space-y-4 shadow-2xl text-center">
            <div className="w-10 h-10 rounded-full bg-rose-500/10 border border-rose-500/20 flex items-center justify-center mx-auto">
              {settingsConfirm.type === "deleteConvo" ? <Trash2 className="w-5 h-5 text-rose-400" /> : <UserMinus className="w-5 h-5 text-rose-400" />}
            </div>
            <div>
              <p className="font-bold text-slate-100 text-sm">
                {settingsConfirm.type === "deleteConvo" ? "Delete messages?" : "Remove?"}
              </p>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                {settingsConfirm.type === "deleteConvo"
                  ? `All messages in "${settingsConfirm.label}" will be deleted.`
                  : settingsConfirm.type === "removeRoom"
                  ? `Room "${settingsConfirm.label}" and all its messages will be removed.`
                  : `"${settingsConfirm.label}" and their messages will be removed.`}
              </p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setSettingsConfirm(null)} className="flex-1 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer transition-colors">Cancel</button>
              <button
                onClick={async () => {
                  const { type, roomId } = settingsConfirm;
                  if (type === "deleteConvo") await onDeleteConversation(roomId);
                  else if (type === "removeRoom") await onRemoveRoom(roomId);
                  else await onRemoveMember(roomId);
                  setSettingsConfirm(null);
                }}
                className="flex-1 py-2 rounded-xl text-xs font-semibold bg-rose-600 hover:bg-rose-500 text-white cursor-pointer transition-colors"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
