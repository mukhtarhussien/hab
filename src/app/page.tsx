"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Send,
  Paperclip,
  Search,
  Plus,
  MessageCircle,
  ArrowRight,
  MoreVertical,
  CheckCheck,
  X,
  Users,
  Smile,
  LogOut,
  LockKeyhole,
  UserRound,
} from "lucide-react";

type User = {
  id: string;
  name: string;
  username: string;
  color: string;
  online: boolean;
};

type Message = {
  id: string;
  senderId: string;
  text: string;
  time: string;
  attachmentUrl?: string | null;
  attachmentType?: string | null;
  attachmentName?: string | null;
};

type Session = { id: string; username: string };

type ApiMessage = {
  id: string;
  senderId: string;
  text: string;
  createdAt: string;
  attachmentUrl?: string | null;
  attachmentType?: string | null;
  attachmentName?: string | null;
  attachmentSize?: number | string | null;
};

type UploadResponse = {
  url?: string;
  contentType?: string;
  name?: string;
  size?: number;
  error?: string;
};

function Avatar({ user, size = 44 }: { user: User; size?: number }) {
  return (
    <div
      className="avatar"
      style={{
        width: size,
        height: size,
        background: `${user.color}20`,
        color: user.color,
        fontSize: size * 0.38,
      }}
    >
      {user.name.slice(0, 1)}
      {user.online && <span className="online-dot" />}
    </div>
  );
}

export default function Home() {
  const [users, setUsers] = useState<User[]>([]);
  const [account, setAccount] = useState<Session | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [authUsername, setAuthUsername] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [chatError, setChatError] = useState("");
  const [authBusy, setAuthBusy] = useState(false);
  const [attachmentBusy, setAttachmentBusy] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Record<string, Message[]>>({});
  const [draft, setDraft] = useState("");
  const [query, setQuery] = useState("");
  const [showUsers, setShowUsers] = useState(false);
  const [mobileChat, setMobileChat] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const currentUser: User = {
    id: account?.id ?? "",
    name: account?.username ?? "مستخدم",
    username: account?.username ?? "user",
    color: "#D9B879",
    online: true,
  };

  useEffect(() => {
    fetch("/api/auth/me", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("session lookup failed");
        return response.json() as Promise<{ user: Session | null }>;
      })
      .then(({ user }) => setAccount(user))
      .catch((error) => {
        console.error("تعذّر استعادة جلسة الدخول:", error);
        setAuthError(
          "تعذّر الاتصال بالخادم. تأكد من إعداد قاعدة البيانات وحاول مرة ثانية."
        );
      })
      .finally(() => setAuthReady(true));
  }, []);

  async function submitCredentials(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const username = authUsername.trim().toLowerCase();
    const password = authPassword;

    if (username.length < 3 || password.length < 10) {
      setAuthError(
        "اسم المستخدم 3 أحرف على الأقل، وكلمة المرور 10 أحرف على الأقل."
      );
      return;
    }

    setAuthBusy(true);
    setAuthError("");

    try {
      const response = await fetch(
        `/api/auth/${authMode === "register" ? "register" : "login"}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username, password }),
        }
      );
      const result = (await response.json()) as {
        user?: Session;
        error?: string;
      };

      if (!response.ok || !result.user) {
        setAuthError(
          result.error ?? "ما قدرنا نسجل دخولك. حاول مرة ثانية."
        );
        return;
      }

      setAccount(result.user);
      setAuthPassword("");
    } catch (error) {
      console.error("تعذّر تسجيل الدخول:", error);
      setAuthError("ما قدرنا نتصل بالخادم. حاول مرة ثانية.");
    } finally {
      setAuthBusy(false);
    }
  }

  async function signOut() {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      setAccount(null);
      setUsers([]);
      setSelectedId(null);
      setMessages({});
      setAuthPassword("");
      setChatError("");
    }
  }

  useEffect(() => {
    if (!account) return;
    let cancelled = false;

    fetch("/api/users", { cache: "no-store" })
      .then(async (response) => {
        const result = (await response.json()) as {
          users?: { id: string; username: string }[];
          error?: string;
        };
        if (!response.ok) {
          throw new Error(result.error ?? "تعذّر تحميل الحسابات.");
        }
        return result.users ?? [];
      })
      .then((items) => {
        if (cancelled) return;
        const colors = [
          "#7CA8E8",
          "#B39BE8",
          "#8DC8A7",
          "#E8A67C",
          "#D88CB0",
        ];
        const nextUsers = items
          .filter((item) => item.id !== account.id)
          .map((item, index) => ({
            id: item.id,
            username: item.username,
            name: item.username,
            color: colors[index % colors.length],
            online: false,
          }));

        setUsers(nextUsers);
        setSelectedId((previous) =>
          previous && nextUsers.some((user) => user.id === previous)
            ? previous
            : nextUsers[0]?.id ?? null
        );
      })
      .catch((error) => {
        console.error("تعذّر تحميل المستخدمين:", error);
        if (!cancelled) {
          setChatError("تعذّر تحميل الحسابات من قاعدة البيانات.");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [account]);

  useEffect(() => {
    if (!selectedId || !account) return;
    let cancelled = false;

    const loadMessages = async () => {
      try {
        const response = await fetch(
          `/api/messages?with=${encodeURIComponent(selectedId)}`,
          { cache: "no-store" }
        );
        const result = (await response.json()) as {
          messages?: ApiMessage[];
          error?: string;
        };
        if (!response.ok) {
          throw new Error(result.error ?? "تعذّر تحميل الرسائل.");
        }
        if (cancelled) return;

        const conversation: Message[] = (result.messages ?? []).map(
          (message) => ({
            id: message.id,
            senderId: message.senderId,
            text: message.text ?? "",
            attachmentUrl: message.attachmentUrl,
            attachmentType: message.attachmentType,
            attachmentName: message.attachmentName,
            time: new Date(message.createdAt).toLocaleTimeString("ar-IQ", {
              hour: "2-digit",
              minute: "2-digit",
            }),
          })
        );

        setMessages((previous) => ({
          ...previous,
          [selectedId]: conversation,
        }));
      } catch (error) {
        console.error("تعذّر تحميل الرسائل:", error);
      }
    };

    void loadMessages();
    const interval = window.setInterval(() => void loadMessages(), 5000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [selectedId, account]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "end",
    });
  }, [selectedId, messages]);

  const selectedUser = users.find((user) => user.id === selectedId);

  const filteredUsers = useMemo(
    () =>
      users.filter(
        (user) =>
          user.name.includes(query.trim()) ||
          user.username.toLowerCase().includes(query.trim().toLowerCase())
      ),
    [users, query]
  );

  function openChat(user: User) {
    setSelectedId(user.id);
    setShowUsers(false);
    setMobileChat(true);
    setQuery("");
    setChatError("");
  }

  async function sendTextMessage(text: string) {
    const cleanText = text.trim();
    const recipientId = selectedId;
    if (!cleanText || !recipientId) return;

    try {
      const response = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipientId, text: cleanText }),
      });
      const result = (await response.json()) as {
        message?: ApiMessage;
        error?: string;
      };

      if (!response.ok || !result.message) {
        setChatError(result.error ?? "تعذّر إرسال الرسالة.");
        return;
      }

      const message = result.message;
      const saved: Message = {
        id: message.id,
        senderId: message.senderId,
        text: message.text ?? cleanText,
        attachmentUrl: message.attachmentUrl,
        attachmentType: message.attachmentType,
        attachmentName: message.attachmentName,
        time: new Date(message.createdAt).toLocaleTimeString("ar-IQ", {
          hour: "2-digit",
          minute: "2-digit",
        }),
      };

      setChatError("");
      setMessages((previous) => ({
        ...previous,
        [recipientId]: [...(previous[recipientId] ?? []), saved],
      }));
    } catch (error) {
      console.error("تعذّر إرسال الرسالة:", error);
      setChatError("تعذّر الاتصال بالخادم لإرسال الرسالة.");
    }
  }

  async function sendMessage() {
    const text = draft.trim();
    if (!text || !selectedId) return;
    await sendTextMessage(text);
    setDraft("");
  }

  async function handleAttachment(file?: File) {
    if (!file || !selectedId || attachmentBusy) return;

    const recipientId = selectedId;
    const allowedTypes = new Set([
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/gif",
    ]);

    if (!allowedTypes.has(file.type)) {
      setChatError("اختر صورة JPG أو PNG أو WebP أو GIF.");
      return;
    }

    if (file.size === 0 || file.size > 5 * 1024 * 1024) {
      setChatError("الحد الأقصى لحجم الصورة هو 5 MB.");
      return;
    }

    setAttachmentBusy(true);
    setChatError("");

    try {
      const formData = new FormData();
      formData.append("file", file);

      const uploadResponse = await fetch("/api/uploads", {
        method: "POST",
        body: formData,
      });
      const uploaded = (await uploadResponse.json()) as UploadResponse;

      if (!uploadResponse.ok || !uploaded.url) {
        setChatError(uploaded.error ?? "فشل رفع الصورة.");
        return;
      }

      const response = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipientId,
          text: "",
          attachmentUrl: uploaded.url,
          attachmentType: uploaded.contentType ?? file.type,
          attachmentName: uploaded.name ?? file.name,
          attachmentSize: uploaded.size ?? file.size,
        }),
      });

      const result = (await response.json()) as {
        message?: ApiMessage;
        error?: string;
      };

      if (!response.ok || !result.message) {
        setChatError(result.error ?? "تم رفع الصورة لكن تعذّر إرسالها.");
        return;
      }

      const message = result.message;
      const saved: Message = {
        id: message.id,
        senderId: message.senderId,
        text: message.text ?? "",
        attachmentUrl: message.attachmentUrl ?? uploaded.url,
        attachmentType:
          message.attachmentType ?? uploaded.contentType ?? file.type,
        attachmentName:
          message.attachmentName ?? uploaded.name ?? file.name,
        time: new Date(message.createdAt).toLocaleTimeString("ar-IQ", {
          hour: "2-digit",
          minute: "2-digit",
        }),
      };

      setMessages((previous) => ({
        ...previous,
        [recipientId]: [...(previous[recipientId] ?? []), saved],
      }));
      setChatError("");
    } catch (error) {
      console.error("فشل رفع الصورة أو إرسالها:", error);
      setChatError("تعذّر رفع الصورة أو إرسالها. حاول مرة ثانية.");
    } finally {
      setAttachmentBusy(false);
    }
  }

  return (
    <>
      {(!authReady || !account) && (
        <div className="auth-overlay" dir="rtl">
          {!authReady ? (
            <div className="auth-loading">
              <MessageCircle size={26} /> جاري التحميل...
            </div>
          ) : (
            <section className="auth-card" aria-labelledby="auth-title">
              <div className="auth-mark">
                <MessageCircle size={25} />
              </div>
              <p className="auth-eyebrow">مساحتك الخاصة للكلام</p>
              <h1 id="auth-title">
                {authMode === "login" ? "هلا بعودتك" : "خلّينا نتعارف"}
              </h1>
              <p className="auth-description">
                {authMode === "login"
                  ? "سجّل دخولك وكمل أحاديثك."
                  : "أنشئ حسابك وابدأ محادثتك الأولى."}
              </p>
              <form className="auth-form" onSubmit={submitCredentials}>
                <label className="auth-field">
                  <span>اسم المستخدم</span>
                  <span className="auth-input-wrap">
                    <UserRound size={18} />
                    <input
                      autoComplete="username"
                      value={authUsername}
                      onChange={(event) => setAuthUsername(event.target.value)}
                      placeholder="مثال: mukhtar"
                      required
                      minLength={3}
                    />
                  </span>
                </label>
                <label className="auth-field">
                  <span>كلمة المرور</span>
                  <span className="auth-input-wrap">
                    <LockKeyhole size={18} />
                    <input
                      type="password"
                      autoComplete={
                        authMode === "login"
                          ? "current-password"
                          : "new-password"
                      }
                      value={authPassword}
                      onChange={(event) => setAuthPassword(event.target.value)}
                      placeholder="10 أحرف على الأقل"
                      required
                      minLength={10}
                    />
                  </span>
                </label>
                {authError && (
                  <p className="auth-error" role="alert">
                    {authError}
                  </p>
                )}
                <button
                  className="auth-submit"
                  type="submit"
                  disabled={authBusy}
                >
                  {authBusy
                    ? "لحظة..."
                    : authMode === "login"
                      ? "دخول"
                      : "إنشاء الحساب"}
                  <ArrowRight size={18} />
                </button>
              </form>
              <button
                className="auth-switch"
                type="button"
                onClick={() => {
                  setAuthMode(authMode === "login" ? "register" : "login");
                  setAuthError("");
                }}
              >
                {authMode === "login"
                  ? "ما عندك حساب؟ أنشئ حساب جديد"
                  : "عندك حساب؟ سجّل دخولك"}
              </button>
              <p className="auth-local-note">
                حسابك وجلسة الدخول محميان عبر الخادم.
              </p>
            </section>
          )}
        </div>
      )}

      <main className="app-shell" dir="rtl">
        <header className="topbar">
          <div className="brand">
            <div className="brand-icon">
              <MessageCircle size={22} />
            </div>
            <div>
              <h1>
                habeeb<span>.</span>
              </h1>
              <p>مساحتك الخاصة للكلام</p>
            </div>
          </div>

          <div className="profile">
            <Avatar user={currentUser} size={39} />
            <div className="profile-info">
              <strong>{currentUser.name}</strong>
              <span>@{currentUser.username}</span>
            </div>
            <button
              className="icon-button"
              onClick={signOut}
              aria-label="تسجيل الخروج"
              title="تسجيل الخروج"
            >
              <LogOut size={19} />
            </button>
          </div>
        </header>

        <section className="workspace">
          <aside className={`sidebar ${mobileChat ? "mobile-hidden" : ""}`}>
            <div className="sidebar-heading">
              <div>
                <h2>رسائلك</h2>
                <p>مكان يجمع أحاديثك</p>
              </div>
              <button
                className="new-chat-button"
                onClick={() => setShowUsers(true)}
                aria-label="ابدأ محادثة جديدة"
                title="محادثة جديدة"
              >
                <Plus size={21} />
              </button>
            </div>

            <button className="start-chat" onClick={() => setShowUsers(true)}>
              <Users size={18} />
              <span>ابدأ محادثة مع...</span>
              <ArrowRight className="start-arrow" size={17} />
            </button>

            <label className="search-box">
              <Search size={18} />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="ابحث عن محادثة..."
                aria-label="البحث عن محادثة"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  aria-label="مسح البحث"
                >
                  <X size={15} />
                </button>
              )}
            </label>

            <div className="list-label">المحادثات الأخيرة</div>

            <div className="conversation-list">
              {users
                .filter((user) => {
                  const last = messages[user.id]?.at(-1)?.text ?? "";
                  return (
                    user.name.includes(query) ||
                    user.username.includes(query.toLowerCase()) ||
                    last.includes(query)
                  );
                })
                .map((user) => {
                  const last = messages[user.id]?.at(-1);
                  return (
                    <button
                      key={user.id}
                      className={`conversation-item ${
                        selectedId === user.id ? "active" : ""
                      }`}
                      onClick={() => openChat(user)}
                    >
                      <Avatar user={user} />
                      <div className="conversation-details">
                        <div className="conversation-top">
                          <strong>{user.name}</strong>
                          <time>{last?.time ?? ""}</time>
                        </div>
                        <div className="conversation-bottom">
                          <span>
                            {last?.attachmentUrl
                              ? "📷 صورة مرفقة"
                              : last?.text ?? "ابدأ المحادثة الآن"}
                          </span>
                          {last?.senderId === currentUser.id && (
                            <CheckCheck size={15} className="read-icon" />
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })}
            </div>

            <div className="sidebar-footer">
              <span className="footer-dot" />
              رسائلك محفوظة بأمان على Neon
            </div>
          </aside>

          <section className={`chat-panel ${mobileChat ? "mobile-visible" : ""}`}>
            {selectedUser ? (
              <>
                <header className="chat-header">
                  <button
                    className="icon-button back-button"
                    onClick={() => setMobileChat(false)}
                    aria-label="العودة للمحادثات"
                  >
                    <ArrowRight size={21} />
                  </button>
                  <Avatar user={selectedUser} size={43} />
                  <div className="chat-person">
                    <strong>{selectedUser.name}</strong>
                    <span>
                      <i
                        className={
                          selectedUser.online
                            ? "status-online"
                            : "status-offline"
                        }
                      />
                      {selectedUser.online ? "متصل الآن" : "غير متصل"}
                    </span>
                  </div>
                  <div className="chat-actions">
                    <button className="icon-button" aria-label="خيارات المحادثة">
                      <MoreVertical size={21} />
                    </button>
                  </div>
                </header>

                <div className="messages-area">
                  <div className="date-divider">
                    <span>بداية المحادثة</span>
                  </div>

                  <div className="messages">
                    {(messages[selectedUser.id] ?? []).map((message) => {
                      const mine = message.senderId === currentUser.id;
                      return (
                        <div
                          key={message.id}
                          className={`message-row ${mine ? "mine" : "theirs"}`}
                        >
                          <div
                            className={`message-bubble ${
                              mine ? "mine-bubble" : ""
                            }`}
                          >
                            {message.attachmentUrl &&
                              message.attachmentType?.startsWith("image/") && (
                                <a
                                  href={message.attachmentUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="message-image-link"
                                  aria-label={`فتح الصورة ${
                                    message.attachmentName ?? "المرفقة"
                                  }`}
                                >
                                  <img
                                    src={message.attachmentUrl}
                                    alt={
                                      message.attachmentName ?? "صورة مرفقة"
                                    }
                                    className="message-image"
                                    loading="lazy"
                                  />
                                </a>
                              )}

                            {message.text && <p>{message.text}</p>}

                            <div className="message-meta">
                              <time>{message.time}</time>
                              {mine && <CheckCheck size={14} />}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    <div ref={messagesEndRef} />
                    {(messages[selectedUser.id] ?? []).length === 0 && (
                      <div className="empty-messages">
                        <div className="empty-icon">
                          <MessageCircle size={27} />
                        </div>
                        <h3>بداية حكاية جديدة</h3>
                        <p>أرسل أول رسالة إلى {selectedUser.name}.</p>
                      </div>
                    )}
                  </div>
                </div>

                <footer className="composer-area">
                  {chatError && (
                    <p className="chat-error" role="alert">
                      {chatError}
                    </p>
                  )}
                  {attachmentBusy && (
                    <p className="upload-status" role="status">
                      جارٍ رفع الصورة وإرسالها...
                    </p>
                  )}
                  <form
                    className="composer"
                    onSubmit={(event) => {
                      event.preventDefault();
                      void sendMessage();
                    }}
                  >
                    <label
                      className={`attachment-button ${
                        attachmentBusy ? "is-busy" : ""
                      }`}
                      title="إرفاق صورة"
                    >
                      <Paperclip size={21} />
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp,image/gif"
                        hidden
                        disabled={attachmentBusy}
                        onChange={(event) => {
                          const file = event.currentTarget.files?.[0];
                          event.currentTarget.value = "";
                          void handleAttachment(file);
                        }}
                      />
                    </label>

                    <input
                      className="message-input"
                      value={draft}
                      onChange={(event) => setDraft(event.target.value)}
                      placeholder="اكتب رسالتك هنا..."
                      aria-label="نص الرسالة"
                    />

                    <button
                      type="button"
                      className="icon-button emoji-button"
                      title="الرموز التعبيرية"
                      onClick={() => setDraft((value) => value + " 😊")}
                    >
                      <Smile size={21} />
                    </button>

                    <button
                      type="submit"
                      className="send-button"
                      disabled={!draft.trim()}
                      aria-label="إرسال الرسالة"
                    >
                      <Send size={19} />
                    </button>
                  </form>
                  <p className="composer-note">مساحة للكلام، بلا تعقيد.</p>
                </footer>
              </>
            ) : (
              <div className="empty-chat">
                <MessageCircle size={45} />
                <h2>ابدأ محادثتك الأولى</h2>
                <p>اختر شخصاً من القائمة حتى تبدأ المراسلة.</p>
                <button
                  className="start-chat"
                  onClick={() => setShowUsers(true)}
                >
                  <Plus size={18} /> ابدأ محادثة
                </button>
              </div>
            )}
          </section>
        </section>

        {showUsers && (
          <div className="modal-overlay" onClick={() => setShowUsers(false)}>
            <section
              className="users-modal"
              onClick={(event) => event.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-labelledby="modal-title"
            >
              <header className="modal-header">
                <div>
                  <h2 id="modal-title">ابدأ محادثة مع...</h2>
                  <p>اختار الشخص اللي تريد تحچي وياه</p>
                </div>
                <button
                  className="icon-button"
                  onClick={() => setShowUsers(false)}
                  aria-label="إغلاق"
                >
                  <X size={21} />
                </button>
              </header>

              <label className="search-box modal-search">
                <Search size={18} />
                <input
                  autoFocus
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="ابحث بالاسم أو اسم المستخدم..."
                />
              </label>

              <div className="users-list">
                {filteredUsers.length ? (
                  filteredUsers.map((user) => (
                    <button
                      className="user-option"
                      key={user.id}
                      onClick={() => openChat(user)}
                    >
                      <Avatar user={user} />
                      <div className="user-option-info">
                        <strong>{user.name}</strong>
                        <span>@{user.username}</span>
                      </div>
                      <span className="user-message-action">مراسلة</span>
                    </button>
                  ))
                ) : (
                  <div className="no-users">
                    <Search size={26} />
                    <p>ما لكينا حساب بهذا الاسم.</p>
                  </div>
                )}
              </div>

              <div className="modal-footer">
                الحسابات المعروضة من قاعدة البيانات
              </div>
            </section>
          </div>
        )}
      </main>

      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@400;450;500;550;600;650;700&display=swap');

        :root {
          color-scheme: dark;
          --bg: #10110f;
          --panel: #171815;
          --panel-light: #1d1e1a;
          --border: #2b2c26;
          --text: #eeeae0;
          --muted: #85857b;
          --gold: #d9b879;
          --gold-dark: #a88a54;
        }

        * { box-sizing: border-box; }
        html, body { margin: 0; min-height: 100%; }
        body {
          background: var(--bg);
          color: var(--text);
          font-family: 'IBM Plex Sans Arabic', Tahoma, sans-serif;
          font-size: 14px;
        }
        button, input { font: inherit; }
        button { color: inherit; cursor: pointer; }
        button:focus-visible, input:focus-visible {
          outline: 2px solid var(--gold);
          outline-offset: 3px;
        }

        .auth-overlay {
          position: fixed; inset: 0; z-index: 100; display: grid; place-items: center;
          overflow-y: auto; padding: 24px; background: radial-gradient(ellipse at 50% 0%, #29251c 0%, #11120f 52%);
        }
        .auth-card {
          width: min(100%, 430px); padding: 36px; border: 1px solid #34342c;
          border-radius: 24px; background: #191a16; box-shadow: 0 28px 100px #0008;
        }
        .auth-mark { width: 54px; height: 54px; display: grid; place-items: center; margin-bottom: 23px; border-radius: 17px; background: var(--gold); color: #191811; }
        .auth-eyebrow { margin: 0 0 8px; color: var(--gold); font-size: 11px; }
        .auth-card h1 { margin: 0; font-size: 26px; }
        .auth-description { margin: 8px 0 25px; color: var(--muted); font-size: 13px; }
        .auth-form { display: flex; flex-direction: column; gap: 17px; }
        .auth-field { display: flex; flex-direction: column; gap: 8px; color: #d4d0c5; font-size: 12px; }
        .auth-input-wrap { min-height: 52px; display: flex; align-items: center; gap: 11px; padding: 0 14px; border: 1px solid #36372f; border-radius: 13px; background: #20211c; color: var(--muted); }
        .auth-input-wrap:focus-within { border-color: var(--gold-dark); }
        .auth-input-wrap input { width: 100%; min-width: 0; border: 0; outline: 0; background: transparent; color: var(--text); font-size: 13px; }
        .auth-input-wrap input::placeholder { color: #77776e; }
        .auth-submit { min-height: 51px; display: flex; align-items: center; justify-content: center; gap: 9px; margin-top: 3px; border: 0; border-radius: 13px; background: var(--gold); color: #191811; font-weight: 700; }
        .auth-submit:disabled { opacity: .65; cursor: wait; }
        .auth-error { margin: -3px 0 0; color: #f19a92; font-size: 12px; line-height: 1.7; }
        .auth-switch { width: 100%; margin-top: 20px; padding: 8px; border: 0; background: transparent; color: var(--gold); font-size: 12px; }
        .auth-local-note { margin: 14px 0 0; color: #77776e; text-align: center; font-size: 10px; }
        .auth-loading { display: flex; align-items: center; gap: 12px; color: var(--gold); font-size: 14px; }

        .app-shell {
          height: 100dvh;
          min-height: 530px;
          padding: 0 36px 28px;
          display: flex;
          flex-direction: column;
          max-width: 1600px;
          margin: auto;
        }
        .topbar {
          height: 91px;
          min-height: 91px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          border-bottom: 1px solid var(--border);
        }
        .brand, .profile, .sidebar-heading, .conversation-item,
        .conversation-top, .conversation-bottom, .chat-header,
        .chat-person span, .chat-actions, .composer, .modal-header,
        .user-option {
          display: flex;
          align-items: center;
        }
        .brand { gap: 12px; }
        .brand-icon {
          width: 43px; height: 43px; display: grid; place-items: center;
          border-radius: 14px; background: var(--gold); color: #191811;
        }
        .brand h1 {
          font-size: 24px; line-height: 1.15; margin: 0;
          letter-spacing: -1px; font-weight: 700; direction: ltr;
          text-align: right;
        }
        .brand h1 span { color: var(--gold); }
        .brand p { margin: 5px 0 0; color: var(--muted); font-size: 11px; }
        .profile { gap: 10px; }
        .profile-info { display: flex; flex-direction: column; gap: 3px; }
        .profile-info strong { font-size: 13px; }
        .profile-info span { color: var(--muted); font-size: 11px; direction: ltr; }
        .avatar {
          position: relative; flex-shrink: 0; border-radius: 15px;
          display: grid; place-items: center; font-weight: 650;
        }
        .online-dot {
          position: absolute; width: 10px; height: 10px; border-radius: 50%;
          background: #73c49a; border: 2px solid var(--panel);
          left: -2px; bottom: -1px;
        }
        .icon-button {
          width: 38px; height: 38px; display: grid; place-items: center;
          border: 0; border-radius: 11px; background: transparent;
          color: var(--muted); transition: .15s;
        }
        .icon-button:hover { background: #282922; color: var(--text); }

        .workspace {
          flex: 1; min-height: 0; display: grid;
          grid-template-columns: 330px minmax(0, 1fr);
          border: 1px solid var(--border); border-radius: 18px;
          overflow: hidden; margin-top: 23px; margin-bottom: 0;
          background: var(--panel);
        }
        .sidebar {
          display: flex; flex-direction: column; min-width: 0;
          border-left: 1px solid var(--border); padding: 23px 17px 13px;
          background: #151613;
        }
        .sidebar-heading { justify-content: space-between; margin-bottom: 21px; }
        .sidebar-heading h2 { margin: 0; font-size: 19px; font-weight: 650; }
        .sidebar-heading p { color: var(--muted); font-size: 11px; margin: 5px 0 0; }
        .new-chat-button {
          display: grid; place-items: center; width: 39px; height: 39px;
          background: var(--gold); color: #171711; border: 0;
          border-radius: 12px; transition: .2s;
        }
        .new-chat-button:hover, .send-button:hover { background: #e8c98c; transform: translateY(-1px); }
        .start-chat {
          width: 100%; display: flex; align-items: center; gap: 10px;
          padding: 13px 13px; background: #28251d;
          border: 1px solid #49402e; border-radius: 12px;
          color: var(--gold); text-align: right; margin-bottom: 17px;
          transition: .2s;
        }
        .start-chat:hover { background: #332e23; }
        .start-arrow { margin-right: auto; }
        .search-box {
          display: flex; align-items: center; gap: 10px; padding: 0 12px;
          height: 43px; min-height: 43px; border-radius: 11px;
          border: 1px solid var(--border); background: #1c1d19; color: var(--muted);
        }
        .search-box input {
          width: 100%; min-width: 0; background: transparent; border: 0;
          outline: 0; color: var(--text); font-size: 12px;
        }
        .search-box input::placeholder { color: #77776e; }
        .search-box button {
          background: transparent; border: 0; color: var(--muted);
          display: grid; place-items: center;
        }
        .list-label {
          color: #77776e; font-size: 11px; margin: 25px 3px 11px;
        }
        .conversation-list { display: flex; flex-direction: column; gap: 5px; overflow-y: auto; }
        .conversation-item {
          gap: 11px; padding: 11px 9px; border: 1px solid transparent;
          border-radius: 13px; background: transparent; text-align: right;
          width: 100%; min-width: 0; transition: .15s;
        }
        .conversation-item:hover { background: #1f201b; }
        .conversation-item.active { background: #24241e; border-color: #37352b; }
        .conversation-details { flex: 1; min-width: 0; }
        .conversation-top, .conversation-bottom { justify-content: space-between; gap: 8px; }
        .conversation-top strong { font-size: 13px; font-weight: 550; }
        .conversation-top time { color: var(--muted); font-size: 10px; white-space: nowrap; }
        .conversation-bottom { margin-top: 6px; color: var(--muted); }
        .conversation-bottom span {
          overflow: hidden; white-space: nowrap; text-overflow: ellipsis;
          font-size: 11px; direction: rtl; text-align: right;
        }
        .read-icon { flex-shrink: 0; color: var(--gold-dark); }
        .sidebar-footer {
          margin-top: auto; padding: 17px 4px 4px; border-top: 1px solid var(--border);
          display: flex; align-items: center; gap: 8px;
          color: var(--muted); font-size: 10px;
        }
        .footer-dot { width: 7px; height: 7px; background: #d1a663; border-radius: 50%; }

        .chat-panel { display: flex; flex-direction: column; min-width: 0; background: #181916; }
        .chat-header {
          height: 79px; min-height: 79px; padding: 0 25px; gap: 12px;
          border-bottom: 1px solid var(--border);
        }
        .chat-person { display: flex; flex-direction: column; gap: 5px; }
        .chat-person strong { font-size: 14px; }
        .chat-person span { color: var(--muted); gap: 6px; font-size: 11px; }
        .status-online, .status-offline { width: 6px; height: 6px; border-radius: 50%; display: inline-block; }
        .status-online { background: #73c49a; }
        .status-offline { background: #74746b; }
        .chat-actions { margin-right: auto; gap: 5px; }
        .messages-area {
          flex: 1; min-height: 0; overflow-y: auto;
          padding: 24px clamp(18px, 5%, 65px);
          scrollbar-width: thin; scrollbar-color: #414139 transparent;
        }
        .date-divider {
          display: flex; align-items: center; gap: 13px; color: #77776e;
          font-size: 10px; margin: 0 auto 28px; max-width: 290px;
        }
        .date-divider::before, .date-divider::after { content: ""; height: 1px; flex: 1; background: var(--border); }
        .messages { display: flex; flex-direction: column; gap: 17px; }
        .message-row { display: flex; width: 100%; }
        .message-row.mine { justify-content: flex-start; }
        .message-row.theirs { justify-content: flex-end; }
        .message-bubble {
          max-width: min(76%, 440px); min-width: 85px;
          padding: 11px 14px 7px; border-radius: 15px 15px 4px 15px;
          background: #272823; border: 1px solid #33342c;
        }
        .message-bubble.mine-bubble {
          background: #373024; border-color: #4b402c;
          border-radius: 15px 15px 15px 4px;
        }
        .message-bubble p { margin: 0; white-space: pre-wrap; overflow-wrap: anywhere; line-height: 1.8; font-size: 13px; }
        .message-image-link {
          display: block;
          max-width: min(100%, 320px);
          margin-bottom: 8px;
          overflow: hidden;
          border-radius: 12px;
        }
        .message-image {
          display: block;
          width: 100%;
          max-height: 360px;
          object-fit: contain;
          border-radius: 12px;
        }
        .message-meta {
          display: flex; align-items: center; justify-content: flex-end;
          gap: 5px; color: #979083; margin-top: 5px; font-size: 9px;
        }
        .message-meta svg { color: var(--gold); }
        .empty-messages {
          min-height: 200px; display: flex; align-items: center;
          justify-content: center; flex-direction: column; text-align: center;
        }
        .empty-icon {
          width: 57px; height: 57px; display: grid; place-items: center;
          color: var(--gold); background: #302b20; border-radius: 18px;
        }
        .empty-messages h3 { font-size: 16px; margin: 15px 0 5px; }
        .empty-messages p, .empty-chat p { font-size: 12px; color: var(--muted); }
        .composer-area { padding: 13px 23px 11px; border-top: 1px solid var(--border); }
        .composer {
          gap: 9px; padding: 7px 8px; min-height: 58px;
          border: 1px solid #36372f; border-radius: 15px; background: #20211c;
        }
        .attachment-button {
          display: grid; place-items: center; width: 39px; height: 39px;
          flex-shrink: 0; color: var(--muted); cursor: pointer; border-radius: 10px;
          transition: .15s;
        }
        .attachment-button:hover { color: var(--gold); background: #302b20; }
        .attachment-button.is-busy { opacity: .5; cursor: wait; }
        .message-input {
          flex: 1; width: 0; border: 0; outline: 0;
          background: transparent; color: var(--text); padding: 8px 3px;
          font-size: 13px;
        }
        .message-input::placeholder { color: #77776e; }
        .emoji-button { flex-shrink: 0; }
        .send-button {
          width: 42px; height: 42px; flex-shrink: 0; display: grid;
          place-items: center; background: var(--gold); color: #1a1913;
          border: 0; border-radius: 12px; transition: .2s;
        }
        .send-button:disabled { opacity: .38; cursor: not-allowed; transform: none; }
        .composer-note { text-align: center; color: #696960; font-size: 10px; margin: 10px 0 0; }
        .chat-error, .upload-status {
          margin: 0 0 9px;
          padding: 8px 11px;
          border-radius: 9px;
          font-size: 11px;
          line-height: 1.7;
        }
        .chat-error { color: #f19a92; background: #3a211f; }
        .upload-status { color: var(--gold); background: #302b20; }
        .empty-chat {
          flex: 1; display: flex; flex-direction: column; align-items: center;
          justify-content: center; color: var(--gold); text-align: center; padding: 20px;
        }
        .empty-chat h2 { color: var(--text); font-size: 21px; margin: 18px 0 0; }
        .empty-chat p { margin: 8px 0 20px; }
        .empty-chat .start-chat { width: auto; margin: 0; }

        .modal-overlay {
          position: fixed; inset: 0; z-index: 50; display: flex;
          align-items: center; justify-content: center; padding: 18px;
          background: #000a; backdrop-filter: blur(7px);
          animation: fadeIn .15s ease-out;
        }
        .users-modal {
          width: min(100%, 440px); max-height: min(650px, 88dvh);
          display: flex; flex-direction: column; overflow: hidden;
          background: #191a16; border: 1px solid #37372e; border-radius: 19px;
          box-shadow: 0 25px 90px #0008;
        }
        .modal-header { justify-content: space-between; gap: 12px; padding: 21px 21px 15px; }
        .modal-header h2 { margin: 0; font-size: 17px; }
        .modal-header p { color: var(--muted); font-size: 11px; margin: 6px 0 0; }
        .modal-search { margin: 0 20px 13px; flex-shrink: 0; }
        .users-list { padding: 0 11px; overflow-y: auto; }
        .user-option {
          width: 100%; gap: 11px; padding: 12px 10px;
          text-align: right; background: transparent; border: 0;
          border-radius: 12px; transition: .15s;
        }
        .user-option:hover { background: #24251f; }
        .user-option-info { display: flex; flex-direction: column; gap: 5px; min-width: 0; }
        .user-option-info strong { font-size: 13px; }
        .user-option-info span { color: var(--muted); font-size: 11px; direction: ltr; text-align: right; }
        .user-message-action {
          margin-right: auto; color: var(--gold); background: #302b20;
          padding: 6px 10px; border-radius: 8px; font-size: 10px;
        }
        .no-users { text-align: center; padding: 35px 15px; color: var(--muted); }
        .no-users p { font-size: 12px; }
        .modal-footer {
          border-top: 1px solid var(--border); padding: 14px 20px;
          text-align: center; color: var(--muted); font-size: 10px; margin-top: 10px;
        }
        .back-button { display: none; }

        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }

        @media (min-width: 1200px) {
          .workspace { grid-template-columns: 350px minmax(0, 1fr); }
          .messages-area { padding-right: 7%; padding-left: 7%; }
        }

        @media (max-width: 760px) {
          .auth-card { padding: 28px 23px; }
          .app-shell { padding: 0 0 0; height: 100dvh; min-height: 0; }
          .topbar { height: 70px; min-height: 70px; padding: 0 16px; }
          .brand-icon { width: 38px; height: 38px; border-radius: 12px; }
          .brand h1 { font-size: 21px; }
          .brand p { font-size: 10px; }
          .profile-info { display: none; }
          .profile { gap: 4px; }
          .workspace {
            flex: 1; margin: 0; border: 0; border-radius: 0;
            display: block; position: relative; overflow: hidden;
          }
          .sidebar, .chat-panel {
            position: absolute; inset: 0; width: 100%; height: 100%;
          }
          .sidebar { padding: 20px 14px 12px; border: 0; }
          .sidebar.mobile-hidden { display: none; }
          .chat-panel { display: none; }
          .chat-panel.mobile-visible { display: flex; }
          .chat-header { padding: 0 12px; gap: 10px; height: 69px; min-height: 69px; }
          .back-button { display: grid; }
          .chat-header > .avatar { width: 40px !important; height: 40px !important; }
          .messages-area { padding: 20px 14px; }
          .message-bubble { max-width: 88%; }
          .message-image-link { max-width: min(100%, 280px); }
          .message-image { max-height: 300px; }
          .composer-area { padding: 11px 10px 9px; }
          .composer { gap: 4px; padding: 6px; }
          .attachment-button { width: 34px; }
          .send-button { width: 39px; height: 39px; }
          .emoji-button { width: 31px; }
          .composer-note { margin-top: 7px; }
          .sidebar-footer { padding-top: 13px; }
          .modal-overlay { padding: 12px; }
          .users-modal { max-height: 85dvh; }
        }

        @media (prefers-reduced-motion: reduce) {
          *, *::before, *::after { animation-duration: .01ms !important; transition-duration: .01ms !important; }
        }
      `}</style>
    </>
  );
}
