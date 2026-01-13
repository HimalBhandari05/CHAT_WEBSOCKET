import { useState, useEffect, useRef, useContext } from "react";
import { useParams, useNavigate } from "react-router-dom";
import useWebSocket from "react-use-websocket";
import { ReadyState } from "react-use-websocket";
import { AuthContext } from "../contexts/AuthContext";
import { MessageModel } from "../models/Message";
import { Message } from "./Message";
import { ChatLoader } from "./ChatLoader";
import InfiniteScroll from "react-infinite-scroll-component";
import { ConversationModel } from "../models/Conversation";

function Chat() {
  const [welcomeMessage, setWelcomeMessage] = useState("");
  const [message, setMessage] = useState("");
  const [meTyping, setMeTyping] = useState(false);
  const [typing, setTyping] = useState(false);
  const { user } = useContext(AuthContext);
  const { conversationName } = useParams();
  const navigate = useNavigate();
  const [participants, setParticipants] = useState<string[]>([]);
  const [conversation, setConversation] = useState<ConversationModel | null>(
    null
  );
  const [page, setPage] = useState(2);
  const [hasMoreMessages, setHasMoreMessages] = useState(false);
  const [messageHistory, setMessageHistory] = useState<MessageModel[]>([]);

  if (!user) {
    return null;
  }

  useEffect(() => {
    setMessageHistory([]);
    setPage(2);
    setHasMoreMessages(false);
  }, [conversationName]);

  async function fetchMessages() {
    const apiRes = await fetch(
      `http://127.0.0.1:8000/api/messages/?conversation=${conversationName}&page=${page}`,
      {
        method: "GET",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          Authorization: `Bearer ${user?.token}`,
        },
      }
    );
    if (apiRes.status === 200) {
      const data: {
        count: number;
        next: string | null;
        previous: string | null;
        results: MessageModel[];
      } = await apiRes.json();
      setHasMoreMessages(data.next !== null);
      setPage(page + 1);
      setMessageHistory((prev: MessageModel[]) => {
        const existingIds = new Set(prev.map((msg) => msg.id));
        const newMessages = data.results.filter(
          (msg) => !existingIds.has(msg.id)
        );
        return prev.concat(newMessages);
      });
    }
  }

  const timeout = useRef<any>(null);

  useEffect(() => {
    async function fetchConversation() {
      const apiRes = await fetch(
        `http://127.0.0.1:8000/api/conversations/${conversationName}/`,
        {
          method: "GET",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
            Authorization: `Token ${user?.token}`,
          },
        }
      );
      if (apiRes.status === 200) {
        const data: ConversationModel = await apiRes.json();
        setConversation(data);
      }
    }
    fetchConversation();
  }, [conversationName, user]);

  function timeoutFunction() {
    setMeTyping(false);
    sendJsonMessage({ type: "typing", typing: false });
  }

  function onType() {
    if (meTyping === false) {
      setMeTyping(true);
      sendJsonMessage({ type: "typing", typing: true });
      timeout.current = setTimeout(timeoutFunction, 5000);
    } else {
      clearTimeout(timeout.current);
      timeout.current = setTimeout(timeoutFunction, 5000);
    }
  }

  function updateTyping(event: { user: string; typing: boolean }) {
    if (event.user !== user!.username) {
      setTyping(event.typing);
    }
  }

  useEffect(() => () => clearTimeout(timeout.current), []);

  const { readyState, sendJsonMessage } = useWebSocket(
    user ? `ws://127.0.0.1:8000/chats/${conversationName}/` : null,
    {
      queryParams: {
        token: user?.token || "",
      },
      onOpen: () => {
        console.log("Connected!");
      },
      onClose: () => {
        console.log("Disconnected!");
      },
      onMessage: (e) => {
        const data = JSON.parse(e.data);
        switch (data.type) {
          case "welcome_message":
            setWelcomeMessage(data.message);
            break;
          case "chat_message_echo":
            const messageConvName = [
              data.message.from_user.username,
              data.message.to_user.username,
            ]
              .sort()
              .join("__");
            if (messageConvName === conversationName) {
              setMessageHistory((prev) => {
                const messageExists = prev.some(
                  (msg) => msg.id === data.message.id
                );
                if (messageExists) {
                  console.log(
                    "Message already exists, skipping:",
                    data.message.id
                  );
                  return prev;
                }
                return [data.message, ...prev];
              });
              sendJsonMessage({ type: "read_messages" });
            } else {
              console.warn(
                "Message from different conversation ignored:",
                messageConvName
              );
            }
            break;
          case "last_50_messages":
            setMessageHistory(data.messages);
            setHasMoreMessages(data.has_more);
            break;
          case "user_join":
            setParticipants((pcpts: string[]) => {
              if (!pcpts.includes(data.user)) {
                return [...pcpts, data.user];
              }
              return pcpts;
            });
            break;
          case "user_leave":
            setParticipants((pcpts: string[]) => {
              const newPcpts = pcpts.filter((x) => x !== data.user);
              return newPcpts;
            });
            break;
          case "online_user_list":
            setParticipants(data.users);
            break;
          case "typing":
            updateTyping(data);
            break;
          default:
            console.error("Unknown Message type", data.type);
            break;
        }
      },
    }
  );

  function handleChangeMessage(e: any) {
    setMessage(e.target.value);
    onType();
  }

  const handleSubmit = () => {
    if (message.length === 0) return;
    if (message.length > 512) return;
    if (message.trim()) {
      sendJsonMessage({
        type: "chat_message",
        message: message,
      });
      setMessage("");
      clearTimeout(timeout.current);
      timeoutFunction();
    }
  };

  const inputReference = useRef<HTMLInputElement>(null);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  useEffect(() => {
    inputReference.current?.focus();
  }, [inputReference]);

  const connectionStatus = {
    [ReadyState.CONNECTING]: "Connecting",
    [ReadyState.OPEN]: "Open",
    [ReadyState.CLOSING]: "Closing",
    [ReadyState.CLOSED]: "Closed",
    [ReadyState.UNINSTANTIATED]: "Uninstantiated",
  }[readyState];

  useEffect(() => {
    if (connectionStatus === "Open") {
      sendJsonMessage({
        type: "read_messages",
      });
    }
  }, [connectionStatus, sendJsonMessage]);

  function getInitials(username: string) {
    return username.substring(0, 2).toUpperCase();
  }

  const isConnected = readyState === ReadyState.OPEN;
  const isConnecting = readyState === ReadyState.CONNECTING;

  return (
    <div className="min-h-screen bg-gray-50 py-4 px-4">
      <div className="max-w-4xl mx-auto h-[85vh] bg-white rounded-lg shadow-lg overflow-hidden">
        {/* Header */}
        <div className="bg-white border-b border-gray-200">
          <div className="px-4 sm:px-6">
            <div className="flex items-center justify-between h-16">
              {/* Back Button & User Info */}
              <div className="flex items-center gap-4">
                <button
                  onClick={() => navigate(-1)}
                  className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                  aria-label="Go back"
                >
                  <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>

                {conversation?.other_user && (  
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white font-semibold text-sm shadow-sm">
                        {getInitials(conversation.other_user.username)}
                      </div>
                      {participants.includes(conversation.other_user.username) && (
                        <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white rounded-full"></div>
                      )}
                    </div>
                    <div>
                      <h2 className="text-base font-semibold text-gray-900">
                        {conversation.other_user.username}
                      </h2>
                      <p className="text-xs text-gray-500">
                        {participants.includes(conversation.other_user.username)
                          ? "Online"
                          : "Offline"}  
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Connection Status */}
              <div className="flex items-center gap-2">
                {isConnecting ? (
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse"></div>
                    <span>Connecting...</span>
                  </div>
                ) : isConnected ? (
                  <div className="flex items-center gap-2 text-sm text-green-600">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <span className="hidden sm:inline">Connected</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-sm text-red-600">
                    <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                    <span className="hidden sm:inline">Disconnected</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Messages Container */}
        <div className="flex-1 overflow-hidden">
          <div
            id="scrollableDiv"
            className="h-[calc(85vh-140px)] flex flex-col-reverse overflow-y-auto px-4 py-6"
          >
            <div>
              <InfiniteScroll
                dataLength={messageHistory.length}
                next={fetchMessages}
                className="flex flex-col-reverse"
                inverse={true}
                hasMore={hasMoreMessages}
                loader={<ChatLoader />}
                scrollableTarget="scrollableDiv"
              >
                {messageHistory.map((message: MessageModel) => (
                  <Message key={message.id} message={message} />
                ))}
              </InfiniteScroll>
            </div>
          </div>
        </div>

        {/* Typing Indicator */}
        {typing && (
          <div className="px-4">
            <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
              <div className="flex gap-1">
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }}></span>
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }}></span>
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }}></span>
              </div>
              <span>{conversation?.other_user?.username} is typing</span>
            </div>
          </div>
        )}

        {/* Input Area */}
        <div className="bg-white border-t border-gray-200">
          <div className="px-4 py-4">
            <div className="flex items-center gap-3">
              <div className="flex-1 relative">
                <input
                  type="text"
                  placeholder="Type a message..."
                  className="w-full px-4 py-3 pr-12 bg-gray-100 border border-transparent rounded-full outline-none focus:bg-white focus:border-blue-500 transition-all duration-200 text-gray-900 placeholder-gray-500"
                  name="message"
                  value={message}
                  onChange={handleChangeMessage}
                  onKeyDown={handleKeyDown}
                  required
                  ref={inputReference}
                  maxLength={511}
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">
                  {message.length}/512
                </div>
              </div>
              <button
                className={`p-3 rounded-full transition-all duration-200 ${
                  message.trim().length > 0
                    ? "bg-blue-600 hover:bg-blue-700 text-white shadow-md hover:shadow-lg"
                    : "bg-gray-200 text-gray-400 cursor-not-allowed"
                }`}
                onClick={handleSubmit}
                disabled={message.trim().length === 0}
                aria-label="Send message"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Chat;