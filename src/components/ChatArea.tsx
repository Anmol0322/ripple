import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Send,
  Search,
  MessageSquare,
  CornerUpLeft,
  X,
  Globe,
  Loader2,
  MoreVertical,
  Trash2,
  UserMinus,
  Menu,
} from "lucide-react";
import { Message, Room } from "../types";

interface ChatAreaProps {
  activeRoom: Room | null;
  messages: Message[];
  currentUserId: string;
  isAdmin?: boolean;
  onSendMessage: (text: string, replyToId?: string) => Promise<void>;
  onDeleteConversation?: (roomId: string) => Promise<void>;
  onRemoveFriend?: (roomId: string) => Promise<void>;
  onOpenSidebar: () => void;
}

export default function ChatArea({
  activeRoom,
  messages,
  currentUserId,
  isAdmin,
  onSendMessage,
  onDeleteConversation,
  onRemoveFriend,
  onOpenSidebar,
}: ChatAreaProps) {
  const [inputText, setInputText] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [replyMessage, setReplyMessage] = useState<Message | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [showAdminMenu, setShowAdminMenu] = useState(false);
  const [showConfirm, setShowConfirm] = useState<"delete" | "remove" | null>(null);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom of chat on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  if (!activeRoom) {
    return (
      <div className="flex-1 bg-slate-900 flex flex-col h-full overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-800/80 bg-slate-950/45 flex items-center gap-3 flex-shrink-0 md:hidden">
          <button
            onClick={onOpenSidebar}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 cursor-pointer transition-colors"
          >
            <Menu className="w-5 h-5" />
          </button>
          <span className="text-sm font-semibold text-slate-400">Ripple</span>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center text-slate-400 p-8 text-center select-none">
          <MessageSquare className="w-16 h-16 text-slate-700 mb-6" />
          {isAdmin ? (
            <>
              <h3 className="text-lg font-bold text-slate-200">Welcome, Admin! 👋</h3>
              <p className="text-sm text-slate-400 mt-2 max-w-sm leading-relaxed">
                To start a private conversation with your friends, add a member using the <span className="text-indigo-400 font-semibold">+</span> button in the sidebar and chat privately.
              </p>
            </>
          ) : (
            <>
              <h3 className="text-lg font-bold text-slate-300">No chat selected</h3>
              <p className="text-sm text-slate-500 mt-1">Select a member from the sidebar to start chatting.</p>
            </>
          )}
        </div>
      </div>
    );
  }

  // Filter messages for active room and matching search query
  const filteredMessages = messages
    .filter((m) => m.roomId === activeRoom.id)
    .filter((m) => {
      if (!searchQuery.trim()) return true;
      return (
        m.text.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.userName.toLowerCase().includes(searchQuery.toLowerCase())
      );
    });

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || isSending) return;

    const textToSend = inputText.trim();
    const replyId = replyMessage?.id;
    setIsSending(true);
    setInputText("");
    setReplyMessage(null);
    try {
      await onSendMessage(textToSend, replyId);
    } catch (err) {
      console.error("Failed to send message:", err);
    } finally {
      setIsSending(false);
    }
  };

  const getFormattedTime = (isoString: string) => {
    if (!isoString) return "";
    const date = new Date(isoString);
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  const findParentMessage = (replyToId?: string) => {
    if (!replyToId) return null;
    return messages.find((m) => m.id === replyToId);
  };

  // Simple, elegant parser for markdown responses (renders code, bold, lists beautifully)
  const renderMessageContent = (text: string) => {
    if (!text) return null;

    // Check for code blocks
    const parts = text.split(/(```[\s\S]*?```)/g);
    return parts.map((part, index) => {
      if (part.startsWith("```") && part.endsWith("```")) {
        const codeLines = part.slice(3, -3).trim().split("\n");
        const language = codeLines[0].match(/^[a-zA-Z0-9_-]+$/) ? codeLines[0] : "";
        const code = language ? codeLines.slice(1).join("\n") : codeLines.join("\n");

        return (
          <div key={index} className="my-3 bg-slate-950 rounded-xl border border-slate-800 p-4 font-mono text-xs overflow-x-auto text-indigo-300">
            {language && <span className="text-[10px] text-slate-500 uppercase font-bold block mb-1.5">{language}</span>}
            <pre className="whitespace-pre-wrap">{code}</pre>
          </div>
        );
      }

      // Handle bold text (**text**), line breaks, list items, inline code
      const inlineParts = part.split("\n");
      return (
        <span key={index} className="space-y-1 block">
          {inlineParts.map((line, lineIdx) => {
            // Check for list items
            if (line.trim().startsWith("- ") || line.trim().startsWith("* ")) {
              return (
                <span key={lineIdx} className="pl-4 relative block text-sm leading-relaxed text-slate-200">
                  <span className="absolute left-1.5 top-2.5 w-1.5 h-1.5 rounded-full bg-indigo-500" />
                  {renderInlineStyles(line.trim().substring(2))}
                </span>
              );
            }
            if (line.trim().startsWith("### ")) {
              return (
                <span key={lineIdx} className="font-bold text-sm block pt-2 text-indigo-300">
                  {renderInlineStyles(line.trim().substring(4))}
                </span>
              );
            }
            if (line.trim().startsWith("## ")) {
              return (
                <span key={lineIdx} className="font-bold text-base block pt-3 pb-1 text-slate-100 border-b border-slate-800">
                  {renderInlineStyles(line.trim().substring(3))}
                </span>
              );
            }
            if (line.trim().startsWith("# ")) {
              return (
                <span key={lineIdx} className="font-bold text-lg block pt-4 pb-2 text-slate-100 border-b border-slate-800">
                  {renderInlineStyles(line.trim().substring(2))}
                </span>
              );
            }

            return (
              <span key={lineIdx} className="block text-sm leading-relaxed text-slate-200">
                {renderInlineStyles(line)}
              </span>
            );
          })}
        </span>
      );
    });
  };

  const renderInlineStyles = (line: string) => {
    const mixedRegex = /(\*\*.*?\*\*|`.*?`)/g;
    const matchParts = line.split(mixedRegex);

    return matchParts.map((inlinePart, index) => {
      if (inlinePart.startsWith("**") && inlinePart.endsWith("**")) {
        return <strong key={index} className="font-bold text-slate-50">{inlinePart.slice(2, -2)}</strong>;
      }
      if (inlinePart.startsWith("`") && inlinePart.endsWith("`")) {
        return <code key={index} className="bg-slate-950 text-indigo-400 font-mono text-[11px] px-1.5 py-0.5 rounded border border-slate-800/60">{inlinePart.slice(1, -1)}</code>;
      }
      return inlinePart;
    });
  };

  const isAIChat = false;

  return (
    <div className="flex-1 bg-slate-900 flex flex-col h-full overflow-hidden relative">
      {/* Upper Active Room Info bar */}
      <div className="px-4 py-3 md:px-6 md:py-4 border-b border-slate-800/80 bg-slate-950/45 flex items-center justify-between gap-3 flex-shrink-0 z-10">
        <div className="flex items-center gap-3 min-w-0">
          {/* Hamburger — mobile only */}
          <button
            onClick={onOpenSidebar}
            className="md:hidden p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 cursor-pointer transition-colors flex-shrink-0"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              {isAIChat ? null : (
                <span className="text-xl font-bold text-slate-500 leading-none">#</span>
              )}
              <h2 className="font-bold text-slate-100 truncate tracking-tight text-base md:text-lg leading-tight">
                {activeRoom.name}
              </h2>
            </div>
            <p className="text-xs text-slate-400 truncate mt-0.5 max-w-[200px] md:max-w-lg">
              {activeRoom.description || "No description provided."}
            </p>
          </div>
        </div>

        {/* Search Bar */}
        <div className="relative max-w-xs w-full hidden sm:block">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search messages..."
            className="w-full bg-slate-900 border border-slate-800/80 hover:border-slate-700/80 focus:border-slate-600 focus:outline-none rounded-xl pl-9 pr-4 py-2.5 text-xs text-slate-200 placeholder-slate-500 transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-3 text-slate-500 hover:text-slate-300"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Admin actions menu */}
        {isAdmin && activeRoom?.id.startsWith("dm-") && (
          <div className="relative flex-shrink-0">
            <button
              onClick={() => setShowAdminMenu((p) => !p)}
              className="p-2 rounded-xl text-slate-500 hover:text-slate-300 hover:bg-slate-800 cursor-pointer transition-colors"
            >
              <MoreVertical className="w-4 h-4" />
            </button>
            <AnimatePresence>
              {showAdminMenu && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: -4 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: -4 }}
                  transition={{ duration: 0.1 }}
                  className="absolute right-0 top-10 bg-slate-900 border border-slate-800 rounded-xl shadow-2xl z-50 w-52 overflow-hidden"
                >
                  <button
                    onClick={() => { setShowConfirm("delete"); setShowAdminMenu(false); }}
                    className="w-full flex items-center gap-2.5 px-4 py-3 text-xs text-slate-300 hover:bg-slate-800 hover:text-rose-400 transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Delete Conversation
                  </button>
                  <button
                    onClick={() => { setShowConfirm("remove"); setShowAdminMenu(false); }}
                    className="w-full flex items-center gap-2.5 px-4 py-3 text-xs text-slate-300 hover:bg-slate-800 hover:text-rose-400 transition-colors cursor-pointer border-t border-slate-800"
                  >
                    <UserMinus className="w-3.5 h-3.5" />
                    Remove Friend
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* Confirm modal */}
        {showConfirm && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 w-full max-w-xs space-y-4 shadow-2xl text-center">
              <div className="w-10 h-10 rounded-full bg-rose-500/10 border border-rose-500/20 flex items-center justify-center mx-auto">
                {showConfirm === "delete" ? <Trash2 className="w-5 h-5 text-rose-400" /> : <UserMinus className="w-5 h-5 text-rose-400" />}
              </div>
              <div>
                <p className="font-bold text-slate-100 text-sm">
                  {showConfirm === "delete" ? "Delete Conversation?" : "Remove Friend?"}
                </p>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  {showConfirm === "delete"
                    ? "All messages will be deleted. The friend will remain in your list."
                    : "All messages will be deleted and this friend will be removed from your list."}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowConfirm(null)}
                  className="flex-1 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={async () => {
                    if (showConfirm === "delete") await onDeleteConversation?.(activeRoom.id);
                    else await onRemoveFriend?.(activeRoom.id);
                    setShowConfirm(null);
                  }}
                  className="flex-1 py-2 rounded-xl text-xs font-semibold bg-rose-600 hover:bg-rose-500 text-white cursor-pointer transition-colors"
                >
                  Confirm
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Message Feed Area */}
      <div
        ref={messagesContainerRef}
        className="flex-1 overflow-y-auto px-3 py-4 md:px-6 md:py-6 space-y-6 scrollbar-thin scroll-smooth"
      >
        {filteredMessages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-slate-500 text-center select-none py-12">
            <MessageSquare className="w-12 h-12 text-slate-800 mb-3" />
            <p className="text-sm font-medium">No messages found in this room</p>
            <p className="text-xs mt-1 text-slate-600 max-w-xs">
              {searchQuery ? "Try searching for a different keyword." : "Be the first to say something!"}
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {filteredMessages.map((msg) => {
              const isMe = msg.userId === currentUserId;
              const isSystem = msg.userId === "system" || msg.userId === "ai-bot";
              const parentMsg = findParentMessage(msg.replyToId);
              const isAIResponse = false;

              if (isSystem) return (
                <div key={msg.id} className="flex justify-center">
                  <span className="text-[11px] text-slate-500 bg-slate-900 border border-slate-800 px-3 py-1 rounded-full">{msg.text}</span>
                </div>
              );

              return (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                  className={`flex gap-3.5 max-w-3xl ${isMe ? "ml-auto flex-row-reverse" : "mr-auto"}`}
                >
                  {/* User Profile Avatar */}
                  {!isSystem ? (
                    <img
                      src={msg.userPhoto || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=100&q=80"}
                      alt={msg.userName}
                      referrerPolicy="no-referrer"
                      className="w-9 h-9 rounded-full border border-slate-800 object-cover flex-shrink-0"
                    />
                  ) : (
                    <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center text-white flex-shrink-0 shadow-lg shadow-indigo-500/10 border border-indigo-500/20">
                      ✨
                    </div>
                  )}

                  {/* Message Bubble Column */}
                  <div className={`space-y-1.5 min-w-0 flex-1 ${isMe ? "text-right" : "text-left"}`}>
                      <div className="flex items-center gap-2 flex-wrap text-xs">
                          <span className="font-semibold text-slate-200">{msg.userName}</span>
                          <span className="text-[10px] text-slate-500 font-mono">
                            {getFormattedTime(msg.timestamp)}
                          </span>
                        </div>

                    {/* Cited Parent Message for Thread replies */}
                    {parentMsg && (
                      <div className={`text-xs p-2.5 rounded-xl border border-slate-800/80 bg-slate-950/45 text-slate-400 mt-1 flex items-start gap-2 max-w-xl truncate ${isMe ? "ml-auto text-right border-r-indigo-500 border-r-2" : "mr-auto text-left border-l-indigo-500 border-l-2"}`}>
                        <CornerUpLeft className="w-3.5 h-3.5 text-slate-500 mt-0.5 flex-shrink-0" />
                        <div className="truncate min-w-0 flex-1">
                          <span className="font-semibold text-slate-300 mr-1.5">{parentMsg.userName}:</span>
                          <span className="italic">{parentMsg.text}</span>
                        </div>
                      </div>
                    )}

                    {/* Message Text Bubble */}
                    <div
                      className={`p-4 rounded-2xl relative ${
                        isMe
                          ? "bg-indigo-600 text-white rounded-tr-none shadow-lg shadow-indigo-600/10 border border-indigo-500/30"
                          : isAIResponse
                          ? "bg-indigo-950/40 border border-indigo-500/20 text-slate-200 rounded-tl-none shadow-xl shadow-indigo-950/15"
                          : "bg-slate-950/60 border border-slate-800/80 text-slate-200 rounded-tl-none"
                      }`}
                    >
                      <div className="break-words">
                        {isAIResponse ? renderMessageContent(msg.text) : (
                          <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.text}</p>
                        )}
                      </div>

                      {/* Reply Overlay trigger on hover */}
                      {!isSystem && (
                        <button
                          onClick={() => setReplyMessage(msg)}
                          title="Reply to message"
                          className="absolute bottom-2.5 right-2.5 opacity-0 hover:opacity-100 group-hover:opacity-100 text-slate-400 hover:text-indigo-400 bg-slate-900 border border-slate-800 p-1 rounded-lg transition-all cursor-pointer"
                        >
                          <CornerUpLeft className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}


        <div ref={messagesEndRef} />
      </div>

      {/* Input Message Form Box */}
      <div className="p-4 border-t border-slate-800 bg-slate-950/50 flex-shrink-0">
        {/* Reply To banner overlay */}
        <AnimatePresence>
          {replyMessage && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="bg-slate-900 border border-slate-800 rounded-t-xl px-4 py-2.5 flex items-center justify-between gap-4 text-xs text-slate-400 mb-2 border-b-0"
            >
              <div className="flex items-center gap-2 truncate">
                <CornerUpLeft className="w-3.5 h-3.5 text-indigo-400" />
                <span className="truncate">
                  Replying to <strong className="text-slate-300 font-semibold">{replyMessage.userName}</strong>:{" "}
                  <span className="italic">{replyMessage.text}</span>
                </span>
              </div>
              <button
                onClick={() => setReplyMessage(null)}
                className="text-slate-500 hover:text-slate-300 p-1 hover:bg-slate-800 rounded-lg cursor-pointer transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        <form onSubmit={handleSend} className="flex gap-2.5 items-end">
        {/* Quick AI Toggle Shortcut removed */}

          <div className="relative flex-1 min-w-0">
            <textarea
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend(e);
                }
              }}
              placeholder="Type a message..."
              rows={1}
              className="w-full bg-slate-900 border border-slate-800/80 focus:border-slate-700 focus:outline-none rounded-xl pl-4 pr-10 py-3 text-sm text-slate-200 placeholder-slate-500 transition-all resize-none max-h-24 scrollbar-thin"
              style={{ minHeight: "44px" }}
              required
            />
          </div>

          <button
            type="submit"
            disabled={!inputText.trim() || isSending}
            className="bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-800 text-white rounded-xl p-3 shadow-lg shadow-indigo-600/10 disabled:shadow-none hover:shadow-indigo-600/20 font-semibold cursor-pointer transition-all flex-shrink-0 flex items-center justify-center"
          >
            {isSending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </button>
        </form>

        {/* Visual Tip about AI */}
        <div className="mt-2.5 flex items-center justify-between text-[10px] text-slate-500 px-1 font-mono">
          <p>Synced in real-time</p>
          <div className="flex items-center gap-1 text-slate-600">
            <Globe className="w-3 h-3" />
            <span>Synced in real-time</span>
          </div>
        </div>
      </div>
    </div>
  );
}
