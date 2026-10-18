"use client";

import { useMemo, useState } from "react";
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
} from "lucide-react";

type User = {
  id: number;
  name: string;
  username: string;
  color: string;
  online: boolean;
};

type Message = {
  id: number;
  senderId: number;
  text: string;
  time: string;
};

const currentUser: User = {
  id: 0,
  name: "مختار",
  username: "mukhtar",
  color: "#D9B879",
  online: true,
};

const initialUsers: User[] = [
  { id: 1, name: "أحمد", username: "ahmed", color: "#7CA8E8", online: true },
  { id: 2, name: "علي", username: "ali", color: "#B39BE8", online: false },
  { id: 3, name: "محمد", username: "mohammed", color: "#8DC8A7", online: true },
];

const initialMessages: Record<number, Message[]> = {
  1: [
    { id: 1, senderId: 1, text: "هلا مختار، شلونك؟", time: "10:41" },
    { id: 2, senderId: 0, text: "هلا بيك، تمام الحمدلله", time: "10:42" },
    { id: 3, senderId: 1, text: "شنو أخبار المشروع الجديد؟", time: "10:43" },
  ],
  2: [
    { id: 4, senderId: 2, text: "السلام عليكم 👋", time: "09:20" },
  ],
  3: [
    { id: 5, senderId: 3, text: "نشوفك باچر إن شاء الله", time: "أمس" },
  ],
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
  const [users] = useState(initialUsers);
  const [selectedId, setSelectedId] = useState<number | null>(1);
  const [messages, setMessages] = useState(initialMessages);
  const [draft, setDraft] = useState("");
  const [query, setQuery] = useState("");
  const [showUsers, setShowUsers] = useState(false);
  const [mobileChat, setMobileChat] = useState(false);

  const selectedUser = users.find((u) => u.id === selectedId);

  const filteredUsers = useMemo(
    () =>
      users.filter(
        (u) =>
          u.name.includes(query.trim()) ||
          u.username.toLowerCase().includes(query.trim().toLowerCase())
      ),
    [users, query]
  );

  function openChat(user: User) {
    setSelectedId(user.id);
    setShowUsers(false);
    setMobileChat(true);
    setQuery("");
  }

  function sendMessage() {
    const text = draft.trim();
    if (!text || selectedId === null) return;

    const now = new Date().toLocaleTimeString("ar-IQ", {
      hour: "2-digit",
      minute: "2-digit",
    });

    setMessages((previous) => ({
      ...previous,
      [selectedId]: [
        ...(previous[selectedId] ?? []),
        {
          id: Date.now(),
          senderId: currentUser.id,
          text,
          time: now,
        },
      ],
    }));

    setDraft("");
  }

  function handleAttachment(file?: File) {
    if (!file || selectedId === null) return;

    setMessages((previous) => ({
      ...previous,
      [selectedId]: [
        ...(previous[selectedId] ?? []),
        {
          id: Date.now(),
          senderId: currentUser.id,
          text: `📎 ${file.name} — ${formatSize(file.size)}`,
          time: new Date().toLocaleTimeString("ar-IQ", {
            hour: "2-digit",
            minute: "2-digit",
          }),
        },
      ],
    }));
  }

  function formatSize(size: number) {
    return size < 1024 * 1024
      ? `${Math.max(1, Math.round(size / 1024))} KB`
      : `${(size / (1024 * 1024)).toFixed(1)} MB`;
  }

  return (
    <main className="app-shell" dir="rtl">
      <header className="topbar">
        <div className="brand">
          <div className="brand-icon">
            <MessageCircle size={22} />
          </div>
          <div>
            <h1>habeeb<span>.</span></h1>
            <p>مساحتك الخاصة للكلام</p>
          </div>
        </div>

        <div className="profile">
          <Avatar user={currentUser} size={39} />
          <div className="profile-info">
            <strong>{currentUser.name}</strong>
            <span>@{currentUser.username}</span>
          </div>
          <button className="icon-button" aria-label="خيارات الحساب">
            <MoreVertical size={20} />
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

          <button
            className="start-chat"
            onClick={() => setShowUsers(true)}
          >
            <Users size={18} />
            <span>ابدأ محادثة مع...</span>
            <ArrowRight className="start-arrow" size={17} />
          </button>

          <label className="search-box">
            <Search size={18} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="ابحث عن محادثة..."
              aria-label="البحث عن محادثة"
            />
            {query && (
              <button onClick={() => setQuery("")} aria-label="مسح البحث">
                <X size={15} />
              </button>
            )}
          </label>

          <div className="list-label">المحادثات الأخيرة</div>

          <div className="conversation-list">
            {users
              .filter((u) => {
                const last = messages[u.id]?.at(-1)?.text ?? "";
                return (
                  u.name.includes(query) ||
                  u.username.includes(query.toLowerCase()) ||
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
                        <span>{last?.text ?? "ابدأ المحادثة الآن"}</span>
                        {last?.senderId === 0 && (
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
            واجهة تجريبية · غير متصل بالخادم
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
                    <i className={selectedUser.online ? "status-online" : "status-offline"} />
                    {selectedUser.online ? "متصل الآن" : "غير متصل"}
                  </span>
                </div>
                <div className="chat-actions">
                  <button
                    className="icon-button"
                    aria-label="خيارات المحادثة"
                  >
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
                        <div className={`message-bubble ${mine ? "mine-bubble" : ""}`}>
                          <p>{message.text}</p>
                          <div className="message-meta">
                            <time>{message.time}</time>
                            {mine && <CheckCheck size={14} />}
                          </div>
                        </div>
                      </div>
                    );
                  })}
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
                <form
                  className="composer"
                  onSubmit={(e) => {
                    e.preventDefault();
                    sendMessage();
                  }}
                >
                  <label className="attachment-button" title="إرفاق ملف">
                    <Paperclip size={21} />
                    <input
                      type="file"
                      hidden
                      onChange={(e) => {
                        handleAttachment(e.target.files?.[0]);
                        e.currentTarget.value = "";
                      }}
                    />
                  </label>

                  <input
                    className="message-input"
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
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
              <button className="start-chat" onClick={() => setShowUsers(true)}>
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
            onClick={(e) => e.stopPropagation()}
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
                onChange={(e) => setQuery(e.target.value)}
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
              الحسابات المعروضة تجريبية حالياً
            </div>
          </section>
        </div>
      )}

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
    </main>
  );
}
