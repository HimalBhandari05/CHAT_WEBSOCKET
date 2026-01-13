import { useContext, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom"; // Added useParams for active state
import { AuthContext } from "../contexts/AuthContext";
import { ConversationModel } from "../models/Conversation";

export function ActiveConversations() {
  const { user } = useContext(AuthContext);
  const { conversationName } = useParams(); // To highlight active chat
  const [conversations, setActiveConversations] = useState<ConversationModel[]>(
    []
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchConversations() {
      if (!user?.token) {
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        setError(null);
        const res = await fetch("http://127.0.0.1:8000/api/conversations/", {
          headers: { Authorization: `Token ${user.token}` },
        });
        if (!res.ok) throw new Error(`Failed to fetch: ${res.status}`);
        const data = await res.json();

        const normalized = (data as any[])
          .map((conv) => {
            if (!conv?.name) return null;
            const participants = conv.name
              .split("__")
              .map((s: string) => s.trim());
            const [a, b] = participants;
            let otherUsername = a === user?.username ? b : a;
            const other_user =
              conv.other_user?.username === otherUsername
                ? conv.other_user
                : { username: otherUsername };
            return { ...conv, other_user };
          })
          .filter(Boolean) as ConversationModel[];

        const unique = normalized.filter(
          (conv, index, self) =>
            index ===
            self.findIndex(
              (c) => c.other_user.username === conv.other_user.username
            )
        );
        setActiveConversations(unique);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to load conversations"
        );
      } finally {
        setLoading(false);
      }
    }
    fetchConversations();
  }, [user?.token]);

  function createConversationName(username: string) {
    if (!user?.username) return "";
    const namesAlph = [user.username, username].sort();
    return `${namesAlph[0]}__${namesAlph[1]}`;
  }

  // UI Helper Components
  const StatusDot = () => (
    <div className="w-2 h-2 rounded-full bg-emerald-500" />
  );

  if (loading)
    return (
      <div className="flex h-screen items-center justify-center bg-white">
        <div className="w-6 h-6 border-2 border-gray-200 border-t-gray-800 rounded-full animate-spin" />
      </div>
    );

  return (
    <div className="flex h-screen bg-white overflow-hidden border-t border-gray-200">
      {/* Sidebar: Conversations List */}
      <aside className="w-80 flex flex-col border-r border-gray-200 bg-gray-50/30">
        <div className="p-4 border-b border-gray-200 bg-white">
          <h1 className="text-lg font-semibold text-gray-900">Messages</h1>
          <p className="text-xs text-gray-500 mt-1">
            {conversations.length} Conversations
          </p>
        </div>

        <div className="flex-1 overflow-y-auto">
          {conversations.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-sm text-gray-500">No messages yet</p>
              <Link
                to="/users"
                className="text-xs font-medium text-blue-600 hover:text-blue-700 mt-2 block"
              >
                Find Users
              </Link>
            </div>
          ) : (
            conversations.map((c) => {
              const cName = createConversationName(c.other_user.username);
              const isActive = conversationName === cName;

              return (
                <Link
                  key={c.id}
                  to={`/chats/${cName}`}
                  className={`block transition-colors border-b border-gray-100 ${
                    isActive ? "bg-white" : "hover:bg-gray-100/50"
                  }`}
                >
                  <div
                    className={`flex items-center gap-3 p-4 border-l-2 ${
                      isActive ? "border-gray-900" : "border-transparent"
                    }`}
                  >
                    <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center text-gray-600 font-medium text-xs flex-shrink-0">
                      {c.other_user.username.substring(0, 2).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-baseline">
                        <span className="text-sm font-semibold text-gray-900 truncate">
                          {c.other_user.username}
                        </span>
                        <span className="text-[10px] text-gray-400">
                          {c.last_message?.timestamp
                            ? new Date(
                                c.last_message.timestamp
                              ).toLocaleDateString([], {
                                month: "short",
                                day: "numeric",
                              })
                            : ""}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 truncate mt-0.5">
                        {c.last_message?.content || "No messages yet"}
                      </p>
                    </div>
                  </div>
                </Link>
              );
            })
          )}
        </div>
      </aside>

      {/* Main Panel: Active Chat */}
      <main className="flex-1 flex flex-col bg-white">
        {conversationName ? (
          /* This area would typically render the <ChatWindow /> via React Router Outlet or child component */
          <div className="flex flex-col h-full">
            {/* Header */}
            <header className="h-16 flex items-center justify-between px-6 border-b border-gray-200">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-xs font-bold">
                  {conversationName
                    .split("__")
                    .find((n) => n !== user?.username)
                    ?.substring(0, 2)
                    .toUpperCase()}
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-gray-900">
                    {conversationName
                      .split("__")
                      .find((n) => n !== user?.username)}
                  </h2>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <StatusDot />
                    <span className="text-[10px] text-gray-500 uppercase tracking-wider font-medium">
                      Online
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <button className="text-gray-400 hover:text-gray-600">
                  <SearchIcon />
                </button>
                <button className="text-gray-400 hover:text-gray-600">
                  <MoreIcon />
                </button>
              </div>
            </header>

            {/* Message Area (Scrollable) */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-gray-50/30">
              <div className="flex justify-center my-4">
                <span className="text-[10px] font-medium text-gray-400 bg-gray-100 px-2 py-1 rounded">
                  TODAY
                </span>
              </div>

              {/* Mocking placement for Sent/Received visual test */}
              <div className="flex justify-start">
                <div className="max-w-[70%] bg-white border border-gray-200 text-gray-800 px-4 py-2 rounded-2xl rounded-tl-none text-sm">
                  Hello! I'm interested in the project requirements.
                  <div className="text-[9px] text-gray-400 mt-1 text-right">
                    09:15 AM
                  </div>
                </div>
              </div>

              <div className="flex justify-end">
                <div className="max-w-[70%] bg-gray-900 text-white px-4 py-2 rounded-2xl rounded-tr-none text-sm">
                  Sure, let me send over the documentation now.
                  <div className="text-[9px] text-gray-500 mt-1 text-right">
                    09:16 AM
                  </div>
                </div>
              </div>
            </div>

            {/* Fixed Message Input */}
            <footer className="p-4 border-t border-gray-200">
              <div className="max-w-3xl mx-auto flex items-center gap-3 bg-gray-100 rounded-lg px-3 py-2 border border-transparent focus-within:border-gray-300 transition-all">
                <button className="text-gray-400 hover:text-gray-600">
                  <PaperclipIcon />
                </button>
                <input
                  type="text"
                  placeholder="Write a message..."
                  className="flex-1 bg-transparent border-none text-sm focus:ring-0 placeholder:text-gray-500"
                />
                <button className="text-sm font-semibold text-gray-900 px-2 hover:text-gray-600">
                  Send
                </button>
              </div>
            </footer>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-12">
            <div className="w-12 h-12 bg-gray-50 rounded-full flex items-center justify-center mb-4 border border-gray-100">
              <MessageIcon />
            </div>
            <h3 className="text-sm font-semibold text-gray-900">
              Select a message
            </h3>
            <p className="text-xs text-gray-500 mt-1 max-w-xs">
              Choose a conversation from the sidebar to start chatting with your
              team.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}

// Minimal Flat Icons
const SearchIcon = () => (
  <svg
    className="w-5 h-5"
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.5}
      d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
    />
  </svg>
);
const MoreIcon = () => (
  <svg
    className="w-5 h-5"
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.5}
      d="M12 5v.01M12 12v.01M12 19v.01"
    />
  </svg>
);
const PaperclipIcon = () => (
  <svg
    className="w-5 h-5"
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.5}
      d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"
    />
  </svg>
);
const MessageIcon = () => (
  <svg
    className="w-6 h-6 text-gray-400"
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.5}
      d="M8 10h.01M12 10h.01M16 10h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
    />
  </svg>
);
