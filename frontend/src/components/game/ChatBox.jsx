import { useState, useEffect, useRef } from 'react';

export default function ChatBox({ messages, onSend, mySocketId, isOpen, onToggle }) {
  const [input, setInput] = useState('');
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // Auto-scroll vers le bas quand un nouveau message arrive
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  function handleSubmit(e) {
    e.preventDefault();
    if (input.trim()) {
      onSend(input);
      setInput('');
    }
  }

  const unreadCount = messages.length;

  return (
    <div className={`chat-box ${isOpen ? 'open' : 'collapsed'}`}>
      <button className="chat-toggle" onClick={onToggle}>
        <span className="chat-icon">💬</span>
        <span className="chat-label">Chat</span>
        {!isOpen && unreadCount > 0 && (
          <span className="chat-badge">{unreadCount}</span>
        )}
      </button>

      {isOpen && (
        <div className="chat-content">
          <div className="chat-messages">
            {messages.length === 0 ? (
              <div className="chat-empty">Aucun message</div>
            ) : (
              messages.map(msg => (
                <div
                  key={msg.id}
                  className={`chat-message ${msg.senderId === mySocketId ? 'mine' : 'theirs'}`}
                >
                  <span className="chat-sender">{msg.senderName}</span>
                  <span className="chat-text">{msg.text}</span>
                </div>
              ))
            )}
            <div ref={messagesEndRef} />
          </div>

          <form onSubmit={handleSubmit} className="chat-input-form">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Message..."
              maxLength={200}
              autoComplete="off"
            />
            <button type="submit" disabled={!input.trim()}>
              ↵
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
