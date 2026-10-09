import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Icon } from "../components/ui/Icon";
import { Mascot } from "../components/ui/Mascot";
import { chatSessionsApi, type ChatSessionSummary } from "../lib/api/chatSessions";

function formatTimestamp(isoString: string): string {
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return "Recently";
    return d.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "Recently";
  }
}

export function ResourceChatHistory() {
  const [history, setHistory] = useState<ChatSessionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchHistory = async () => {
    try {
      setLoading(true);
      const res = await chatSessionsApi.list();
      setHistory(res.data || []);
    } catch (err) {
      console.warn("[ResourceChatHistory] Could not load chat history:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchHistory();
  }, []);

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (!window.confirm("Are you sure you want to delete this chat session?")) return;

    try {
      setDeletingId(id);
      await chatSessionsApi.delete(id);
      setHistory((prev) => prev.filter((c) => c.id !== id && c._id !== id));
    } catch (err) {
      console.error("[ResourceChatHistory] Could not delete chat session:", err);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-bg h-full overflow-hidden text-carbon-700">
      <header className="bg-white border-b border-border px-6 md:px-12 py-5 shrink-0 z-10 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link to="/resource-pack/chat" className="w-10 h-10 rounded-full border border-border flex items-center justify-center text-carbon-500 hover:bg-surface-muted transition-colors">
            <Icon name="arrow-back" className="text-lg" />
          </Link>
          <div>
            <h1 className="text-2xl font-extrabold text-carbon-900">Chat History</h1>
            <p className="text-xs text-carbon-500">Review and manage your Resource Assistant conversations</p>
          </div>
        </div>

        <Link to="/resource-pack/chat" className="px-4 py-2 bg-chrome text-on-chrome text-xs font-bold rounded-xl hover:opacity-90 transition-opacity">
          + New Chat
        </Link>
      </header>

      <div className="flex-1 overflow-y-auto p-6 md:p-12 safe-area-bottom">
        <div className="max-w-4xl mx-auto space-y-4">

          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3 text-carbon-500">
              <Icon name="sync-outline" className="animate-spin text-3xl text-chrome" />
              <p className="text-sm font-semibold">Loading your chat history...</p>
            </div>
          ) : history.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <Mascot variant="sad.png" size="xl" />
              <p className="font-bold text-lg text-carbon-500">No chat history yet.</p>
              <Link to="/resource-pack/chat" className="px-4 py-2 bg-chrome text-on-chrome text-sm font-bold rounded-xl">
                Start a Conversation
              </Link>
            </div>
          ) : (
            history.map((chat) => (
              <div
                key={chat.id || chat._id}
                className="bg-white border border-border rounded-2xl p-5 flex items-center justify-between shadow-xs hover:shadow-md transition-all gap-4"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-carbon-900 text-base truncate">{chat.title}</h3>
                    <span className="text-[10px] font-bold px-2 py-0.5 bg-lavender-100 text-chrome rounded-full shrink-0">
                      {chat.messageCount} msgs
                    </span>
                  </div>
                  {chat.lastMessage && (
                    <p className="text-xs text-carbon-500 mt-1 truncate max-w-xl">
                      {chat.lastMessage}
                    </p>
                  )}
                  <p className="text-[11px] text-carbon-400 mt-1.5 flex items-center gap-1 font-medium">
                    <Icon name="time-outline" className="text-xs" /> {formatTimestamp(chat.updatedAt || chat.createdAt)}
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <Link
                    to={`/resource-pack/chat/${chat.id || chat._id}`}
                    className="px-4 py-2 bg-lavender-100 text-chrome text-xs font-bold rounded-xl hover:bg-chrome hover:text-on-chrome transition-colors"
                  >
                    Open Chat
                  </Link>

                  <button
                    type="button"
                    title="Delete Chat"
                    onClick={(e) => handleDelete(e, chat.id || chat._id)}
                    disabled={deletingId === (chat.id || chat._id)}
                    className="w-8 h-8 rounded-xl border border-border flex items-center justify-center text-carbon-400 hover:text-red-600 hover:bg-red-50 hover:border-red-200 transition-colors"
                  >
                    <Icon name="trash-outline" className="text-base" />
                  </button>
                </div>
              </div>
            ))
          )}

        </div>
      </div>
    </div>
  );
}

