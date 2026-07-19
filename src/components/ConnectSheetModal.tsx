import React, { useState, useEffect } from "react";
import { motion } from "motion/react";
import {
  Database,
  Plus,
  ArrowRight,
  FileSpreadsheet,
  Loader2,
  AlertCircle,
  ExternalLink,
  ArrowLeft,
} from "lucide-react";
import { SpreadsheetConfig } from "../types";
import { searchDatabaseSheets, createDatabaseSheet } from "../lib/sheets";
import { authorizeGoogleForSheets } from "../lib/firebase";

interface ConnectSheetModalProps {
  accessToken: string | null;
  onConnect: (config: SpreadsheetConfig) => void;
  onAuthorizeGoogle: (token: string) => void;
  onLogout: () => void;
  userName: string;
}

export default function ConnectSheetModal({
  accessToken,
  onConnect,
  onAuthorizeGoogle,
  onLogout,
  userName,
}: ConnectSheetModalProps) {
  const [sheetsList, setSheetsList] = useState<SpreadsheetConfig[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [isAuthorizing, setIsAuthorizing] = useState(false);
  const [newSheetTitle, setNewSheetTitle] = useState("Ripple Database");
  const [manualId, setManualId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isDomainError, setIsDomainError] = useState(false);

  useEffect(() => {
    if (!accessToken) {
      setIsLoading(false);
      return;
    }
    async function loadSheets() {
      setIsLoading(true);
      setError(null);
      setIsDomainError(false);
      try {
        const list = await searchDatabaseSheets(accessToken!);
        setSheetsList(list);
      } catch (err: any) {
        console.error("Error loading spreadsheets list:", err);
        if (err.message && (err.message.includes("scopes") || err.message.includes("403") || err.message.includes("insufficient"))) {
          setError(
            "Google API Error (403): Request had insufficient authentication scopes. " +
            "When signing in with Google, you must check the boxes to grant Google Sheets and Google Drive permissions so that Ripple can function. " +
            "Please click 'Sign Out' in the top-right corner, click 'Sign in with Google' again, and make sure to check all permissions checkboxes on the Google consent screen."
          );
        } else {
          setError("Failed to search your Google Drive. Check permissions or network.");
        }
      } finally {
        setIsLoading(false);
      }
    }
    loadSheets();
  }, [accessToken]);

  const handleAuthorizeGoogle = async () => {
    setIsAuthorizing(true);
    setError(null);
    setIsDomainError(false);
    try {
      const token = await authorizeGoogleForSheets();
      onAuthorizeGoogle(token);
    } catch (err: any) {
      console.error("Authorization error:", err);
      const isUnauthorized = err.code === "auth/unauthorized-domain" || (err.message && err.message.toLowerCase().includes("unauthorized-domain"));
      if (isUnauthorized) {
        setIsDomainError(true);
        setError("Domain Authorization Required: This URL must be authorized in your Firebase console.");
      } else {
        setError(err.message || "Failed to authorize Google Sheets access.");
      }
    } finally {
      setIsAuthorizing(false);
    }
  };

  const handleCreateNew = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSheetTitle.trim() || !accessToken) return;

    setIsCreating(true);
    setError(null);
    try {
      const config = await createDatabaseSheet(accessToken, newSheetTitle.trim());
      onConnect(config);
    } catch (err: any) {
      console.error("Error creating sheet:", err);
      if (err.message && (err.message.includes("scopes") || err.message.includes("403") || err.message.includes("insufficient"))) {
        setError(
          "Google API Error (403): Request had insufficient authentication scopes. " +
          "When signing in with Google, you must check the boxes to grant Google Sheets and Google Drive permissions. " +
          "Please click 'Sign Out' in the top-right corner, click 'Sign in with Google' again, and make sure to check all permissions checkboxes on the Google consent screen."
        );
      } else {
        setError(err.message || "Failed to create a new spreadsheet. Please try again.");
      }
    } finally {
      setIsCreating(false);
    }
  };

  const handleManualConnect = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualId.trim()) return;

    // Extract ID if a full URL is pasted
    let id = manualId.trim();
    if (id.includes("/spreadsheets/d/")) {
      const parts = id.split("/spreadsheets/d/");
      if (parts[1]) {
        id = parts[1].split("/")[0];
      }
    }

    onConnect({
      spreadsheetId: id,
      spreadsheetUrl: `https://docs.google.com/spreadsheets/d/${id}/edit`,
      title: "Connected Spreadsheet",
    });
  };

  if (!accessToken) {
    return (
      <div className="min-h-screen bg-slate-900 text-slate-100 flex items-center justify-center p-4 relative overflow-hidden">
        {/* Abstract ambient glowing background */}
        <div className="absolute top-[-20%] left-[-20%] w-[60%] h-[60%] rounded-full bg-indigo-500/10 blur-[120px] pointer-events-none" />
        <div className="absolute bottom-[-20%] right-[-20%] w-[60%] h-[60%] rounded-full bg-emerald-500/10 blur-[120px] pointer-events-none" />

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-lg bg-slate-950/80 backdrop-blur-md border border-slate-800 rounded-2xl shadow-2xl p-6 sm:p-8 text-center relative z-10 space-y-6"
        >
          <div className="flex justify-between items-start">
            <div className="text-left">
              <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest font-mono">DATABASE HOSTING</span>
              <h1 className="text-xl font-extrabold tracking-tight text-slate-50 mt-1">Connect Your Google Drive</h1>
            </div>
            <button
              onClick={onLogout}
              className="text-xs text-slate-400 hover:text-indigo-400 hover:border-indigo-900 border border-slate-800 bg-slate-900/50 px-3.5 py-2 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 hover:scale-[1.01]"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Login</span>
            </button>
          </div>

          <p className="text-sm text-slate-400 leading-relaxed text-left">
            Welcome, <strong className="text-indigo-300 font-semibold">{userName}</strong>! Since you signed in using a custom email, you must authorize a Google Account to host the Google Sheet database.
          </p>

          <div className="bg-indigo-600/10 border border-indigo-500/20 p-4 rounded-xl text-xs text-indigo-300 text-left space-y-2">
            <p className="font-bold">Database Ownership Principle:</p>
            <p className="leading-relaxed">
              All room structures, member lists, and message logs reside strictly in a Google Sheet created on <strong>your own Google Drive</strong>. Your data remains fully owned and controlled by you.
            </p>
          </div>

          {isDomainError ? (
            <div className="bg-amber-500/10 border border-amber-500/20 p-5 rounded-2xl text-left space-y-3.5">
              <div className="flex items-center gap-2.5 text-amber-400 font-bold text-sm">
                <AlertCircle className="w-5 h-5 flex-shrink-0 text-amber-500 animate-pulse" />
                <span>Authorized Domain Required</span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed font-sans">
                Your Firebase project blocks OAuth logins from unauthorized domains. To fix this, please whitelist this domain:
              </p>
              <ol className="text-xs text-slate-400 list-decimal pl-5 space-y-2.5 leading-relaxed font-sans">
                <li>
                  Open your <a href="https://console.firebase.google.com/" target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:underline inline-flex items-center gap-0.5 font-semibold">Firebase Console <ExternalLink className="w-3 h-3" /></a> and select your project.
                </li>
                <li>
                  Go to <strong className="text-slate-200 font-medium">Authentication</strong> &rarr; <strong className="text-slate-200 font-medium">Settings</strong> tab &rarr; <strong className="text-slate-200 font-medium">Authorized Domains</strong> (under "Authorized domains" section).
                </li>
                <li>
                  Click <strong className="text-slate-200 font-medium">Add domain</strong> and paste exactly:
                  <div className="mt-1.5 flex items-center justify-between bg-slate-950 px-3 py-2 rounded-lg border border-slate-800 text-indigo-300 font-mono text-[11px] select-all break-all">
                    <span>{window.location.hostname}</span>
                  </div>
                </li>
                <li>
                  Once added, refresh this tab and try authorizing again.
                </li>
              </ol>
            </div>
          ) : error ? (
            <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl flex gap-3 text-rose-300 text-sm items-start text-left">
              <AlertCircle className="w-5 h-5 flex-shrink-0 text-rose-400" />
              <p>{error}</p>
            </div>
          ) : null}

          <button
            onClick={handleAuthorizeGoogle}
            disabled={isAuthorizing}
            className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-800 text-white rounded-xl py-3 font-semibold text-xs flex items-center justify-center gap-2 cursor-pointer transition-all shadow-lg shadow-indigo-600/25"
          >
            {isAuthorizing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Authorizing Google...</span>
              </>
            ) : (
              <>
                <FileSpreadsheet className="w-4 h-4" />
                <span>Authorize Google Sheets & Drive</span>
              </>
            )}
          </button>
          
          <p className="text-[10px] text-slate-500 font-mono">
            This applet only requests drive.file permissions for your security.
          </p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Abstract ambient glowing background */}
      <div className="absolute top-[-20%] left-[-20%] w-[60%] h-[60%] rounded-full bg-indigo-500/10 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-20%] w-[60%] h-[60%] rounded-full bg-emerald-500/10 blur-[120px] pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="w-full max-w-2xl bg-slate-950/80 backdrop-blur-md border border-slate-800 rounded-2xl shadow-2xl p-6 sm:p-8 relative z-10"
      >
        <div className="flex justify-between items-start mb-6">
          <div>
            <div className="flex items-center gap-2 text-indigo-400 font-medium text-sm mb-1 uppercase tracking-wider">
              <Database className="w-4 h-4" />
              <span>Google Sheets Database</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-50">
              Set Up Your Database
            </h1>
            <p className="text-slate-400 text-sm mt-1">
              Welcome, <span className="text-indigo-300 font-medium">{userName}</span>! Connect a Google Spreadsheet to store your channels, users, and chat messages.
            </p>
          </div>
          <button
            onClick={onLogout}
            className="text-xs text-slate-400 hover:text-indigo-400 hover:border-indigo-900 border border-slate-800 bg-slate-900/50 px-3.5 py-2 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 hover:scale-[1.01]"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Login</span>
          </button>
        </div>

        {error && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            className="mb-6 p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl flex gap-3 text-rose-300 text-sm items-start"
          >
            <AlertCircle className="w-5 h-5 flex-shrink-0 text-rose-400" />
            <p>{error}</p>
          </motion.div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Create New Sheet */}
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-slate-200 flex items-center gap-2">
              <Plus className="w-5 h-5 text-indigo-400" />
              Create New Database
            </h2>
            <p className="text-xs text-slate-400 leading-relaxed">
              We'll automatically initialize a new Google Sheet in your Google Drive with the necessary tables and structure for your rooms and messages.
            </p>
            <form onSubmit={handleCreateNew} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">
                  Spreadsheet Title
                </label>
                <input
                  type="text"
                  value={newSheetTitle}
                  onChange={(e) => setNewSheetTitle(e.target.value)}
                  placeholder="e.g. Sheets Chat Database"
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                  required
                />
              </div>
              <button
                type="submit"
                disabled={isCreating}
                className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-800 disabled:cursor-not-allowed text-white rounded-xl py-2.5 px-4 font-medium text-sm flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-indigo-600/10 hover:shadow-indigo-600/20 transition-all"
              >
                {isCreating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Creating Sheets DB...</span>
                  </>
                ) : (
                  <>
                    <span>Create & Connect</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Connect Existing Sheet */}
          <div className="space-y-4 border-t border-slate-800 md:border-t-0 md:border-l md:pl-8 pt-6 md:pt-0">
            <h2 className="text-lg font-semibold text-slate-200 flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5 text-emerald-400" />
              Use Existing Sheet
            </h2>
            <p className="text-xs text-slate-400 leading-relaxed">
              Select one of your existing spreadsheets containing chat records, or connect one manually by Spreadsheet ID.
            </p>

            {/* List existing Google Sheets found */}
            <div className="space-y-2">
              <label className="block text-xs font-medium text-slate-400">
                Found in your Google Drive
              </label>
              
              {isLoading ? (
                <div className="flex flex-col items-center justify-center py-6 bg-slate-900/30 rounded-xl border border-dashed border-slate-800">
                  <Loader2 className="w-6 h-6 text-slate-400 animate-spin" />
                  <span className="text-xs text-slate-500 mt-2">Searching Google Drive...</span>
                </div>
              ) : sheetsList.length === 0 ? (
                <div className="text-center py-4 bg-slate-900/30 rounded-xl border border-dashed border-slate-800">
                  <span className="text-xs text-slate-500">No Sheets Chat databases found in Drive.</span>
                </div>
              ) : (
                <div className="max-h-[160px] overflow-y-auto space-y-1.5 pr-1 scrollbar-thin">
                  {sheetsList.map((sheet) => (
                    <button
                      key={sheet.spreadsheetId}
                      onClick={() => onConnect(sheet)}
                      className="w-full text-left bg-slate-900/50 hover:bg-slate-900 border border-slate-800/80 hover:border-slate-700/80 p-2.5 rounded-xl flex items-center justify-between group transition-all cursor-pointer"
                    >
                      <div className="truncate flex-1 min-w-0 pr-2">
                        <p className="text-xs font-medium text-slate-200 truncate group-hover:text-indigo-300 transition-colors">
                          {sheet.title}
                        </p>
                        <p className="text-[10px] text-slate-500 truncate mt-0.5">
                          ID: {sheet.spreadsheetId}
                        </p>
                      </div>
                      <ArrowRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-indigo-400 group-hover:translate-x-1 transition-all flex-shrink-0" />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Manual ID Form */}
            <form onSubmit={handleManualConnect} className="space-y-2.5 pt-2">
              <div className="relative">
                <input
                  type="text"
                  value={manualId}
                  onChange={(e) => setManualId(e.target.value)}
                  placeholder="Paste Spreadsheet ID or URL"
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-3 pr-10 py-2.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                />
                <button
                  type="submit"
                  disabled={!manualId.trim()}
                  className="absolute right-1.5 top-1.5 p-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white disabled:bg-slate-800 disabled:text-slate-600 disabled:cursor-not-allowed transition-all cursor-pointer"
                >
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Footer info about sheet security */}
        <div className="mt-8 pt-4 border-t border-slate-800 flex justify-between items-center text-[11px] text-slate-500">
          <p>
            Your access token is cached <strong>securely in memory</strong>.
          </p>
          <a
            href="https://docs.google.com/spreadsheets"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-indigo-400 flex items-center gap-1 transition-colors"
          >
            Open Google Sheets <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </motion.div>
    </div>
  );
}
