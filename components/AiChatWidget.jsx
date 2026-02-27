"use client";

import { useState, useRef, useEffect } from "react";
import { askAiAssistant } from "@/actions/ai-chat";
import { Bot, X, Send, Sparkles, ChevronDown, Maximize2, Minimize2 } from "lucide-react";

// ── Markdown-like text formatter (bold **text**, line breaks) ─────────────────
function FormattedMessage({ text }) {
    const lines = text.split("\n");
    return (
        <div className="space-y-1">
            {lines.map((line, i) => {
                if (!line.trim()) return <br key={i} />;

                // bullet points
                if (line.trim().startsWith("•") || line.trim().startsWith("-") || line.trim().startsWith("*")) {
                    const content = line.trim().replace(/^[•\-*]\s*/, "");
                    return (
                        <div key={i} className="flex gap-1.5">
                            <span className="mt-1 shrink-0 w-1.5 h-1.5 rounded-full bg-current opacity-60 block self-start" style={{ marginTop: "0.45em" }} />
                            <span>{renderBold(content)}</span>
                        </div>
                    );
                }

                return <p key={i}>{renderBold(line)}</p>;
            })}
        </div>
    );
}

function renderBold(text) {
    const parts = text.split(/(\*\*[^*]+\*\*)/g);
    return parts.map((part, i) =>
        part.startsWith("**") && part.endsWith("**") ? (
            <strong key={i}>{part.slice(2, -2)}</strong>
        ) : (
            part
        )
    );
}

// ── Typing indicator ──────────────────────────────────────────────────────────
function TypingDots() {
    return (
        <div className="flex gap-1 items-center px-1 py-0.5">
            {[0, 1, 2].map((i) => (
                <span
                    key={i}
                    className="w-2 h-2 rounded-full bg-current opacity-60"
                    style={{
                        animation: `ai-dot-bounce 1.2s ease-in-out ${i * 0.2}s infinite`,
                    }}
                />
            ))}
        </div>
    );
}

// ── Main Widget ───────────────────────────────────────────────────────────────
export function AiChatWidget() {
    const [isOpen, setIsOpen] = useState(false);
    const [isExpanded, setIsExpanded] = useState(false);
    const [messages, setMessages] = useState([
        {
            id: "welcome",
            role: "ai",
            text: "Hi! 👋 I'm your personal finance assistant. Ask me anything about your accounts, transactions, or budget.",
            time: new Date(),
        },
    ]);
    const [input, setInput] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const messagesEndRef = useRef(null);
    const inputRef = useRef(null);

    // Auto-scroll to bottom
    useEffect(() => {
        if (isOpen) {
            messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
        }
    }, [messages, isOpen]);

    // Focus input when opened
    useEffect(() => {
        if (isOpen) {
            setTimeout(() => inputRef.current?.focus(), 100);
        }
    }, [isOpen]);

    async function handleSend() {
        const q = input.trim();
        if (!q || isLoading) return;

        const userMsg = { id: Date.now().toString(), role: "user", text: q, time: new Date() };
        setMessages((prev) => [...prev, userMsg]);
        setInput("");
        setIsLoading(true);

        try {
            const result = await askAiAssistant(q);
            const aiText = result.success
                ? result.answer
                : result.error || "Something went wrong. Please try again.";

            setMessages((prev) => [
                ...prev,
                { id: (Date.now() + 1).toString(), role: "ai", text: aiText, time: new Date() },
            ]);
        } catch {
            setMessages((prev) => [
                ...prev,
                {
                    id: (Date.now() + 1).toString(),
                    role: "ai",
                    text: "Sorry, I ran into an error. Please try again.",
                    time: new Date(),
                },
            ]);
        } finally {
            setIsLoading(false);
        }
    }

    function handleKeyDown(e) {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    }

    function formatTime(date) {
        return date.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
    }

    return (
        <>
            {/* Keyframe styles injected once */}
            <style>{`
        @keyframes ai-dot-bounce {
          0%, 80%, 100% { transform: translateY(0); opacity: 0.4; }
          40% { transform: translateY(-5px); opacity: 1; }
        }
        @keyframes ai-chat-slide-up {
          from { opacity: 0; transform: translateY(20px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes ai-fab-pulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(139, 92, 246, 0.4); }
          50%       { box-shadow: 0 0 0 10px rgba(139, 92, 246, 0); }
        }
        .ai-chat-panel {
          animation: ai-chat-slide-up 0.25s ease-out forwards;
        }
        .ai-fab {
          animation: ai-fab-pulse 2.5s ease-in-out infinite;
        }
      `}</style>

            {/* ── FAB ──────────────────────────────────────────────────────────── */}
            <button
                onClick={() => setIsOpen((v) => !v)}
                aria-label="Open AI assistant"
                className={`ai-fab fixed bottom-6 right-6 z-50 flex items-center justify-center w-14 h-14 rounded-full shadow-lg transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-violet-500 ${isOpen ? "rotate-0 scale-90" : "rotate-0 scale-100"
                    }`}
                style={{
                    background: "linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%)",
                    color: "#fff",
                }}
            >
                {isOpen ? <ChevronDown size={22} /> : <Sparkles size={22} />}
            </button>

            {/* ── Chat Panel ───────────────────────────────────────────────────── */}
            {isOpen && (
                <div
                    className="ai-chat-panel fixed bottom-24 right-6 z-50 flex flex-col rounded-2xl shadow-2xl overflow-hidden transition-all duration-300"
                    style={{
                        width: isExpanded ? "min(700px, calc(100vw - 2rem))" : "min(380px, calc(100vw - 2rem))",
                        height: isExpanded ? "min(80vh, 640px)" : "520px",
                        background: "var(--card)",
                        border: "1px solid var(--border)",
                    }}
                >
                    {/* Header */}
                    <div
                        className="flex items-center gap-3 px-4 py-3 shrink-0"
                        style={{
                            background: "linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%)",
                            color: "#fff",
                        }}
                    >
                        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-white/20">
                            <Bot size={16} />
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold leading-none">Aura AI</p>
                            <p className="text-xs opacity-75 mt-0.5">Your personal finance assistant</p>
                        </div>
                        {/* Expand / Collapse */}
                        <button
                            onClick={() => setIsExpanded((v) => !v)}
                            className="p-1 rounded-lg hover:bg-white/20 transition-colors"
                            aria-label={isExpanded ? "Collapse chat" : "Expand chat"}
                            title={isExpanded ? "Collapse" : "Expand"}
                        >
                            {isExpanded ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
                        </button>
                        {/* Close */}
                        <button
                            onClick={() => setIsOpen(false)}
                            className="p-1 rounded-lg hover:bg-white/20 transition-colors"
                            aria-label="Close chat"
                        >
                            <X size={16} />
                        </button>
                    </div>

                    {/* Messages */}
                    <div
                        className="flex-1 overflow-y-auto px-4 py-3 space-y-3"
                        style={{ background: "var(--background)" }}
                    >
                        {messages.map((msg) => (
                            <div
                                key={msg.id}
                                className={`flex gap-2 ${msg.role === "user" ? "flex-row-reverse" : "flex-row"}`}
                            >
                                {/* Avatar */}
                                {msg.role === "ai" && (
                                    <div
                                        className="shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-white mt-0.5"
                                        style={{ background: "linear-gradient(135deg, #7c3aed, #4f46e5)" }}
                                    >
                                        <Bot size={13} />
                                    </div>
                                )}

                                <div
                                    className={`max-w-[82%] rounded-2xl px-3 py-2 text-sm leading-relaxed ${msg.role === "user"
                                        ? "rounded-tr-sm text-white"
                                        : "rounded-tl-sm"
                                        }`}
                                    style={
                                        msg.role === "user"
                                            ? { background: "linear-gradient(135deg, #7c3aed, #4f46e5)" }
                                            : {
                                                background: "var(--muted)",
                                                color: "var(--foreground)",
                                                border: "1px solid var(--border)",
                                            }
                                    }
                                >
                                    <FormattedMessage text={msg.text} />
                                    <p
                                        className={`text-[10px] mt-1 opacity-60 ${msg.role === "user" ? "text-right" : "text-left"
                                            }`}
                                    >
                                        {formatTime(msg.time)}
                                    </p>
                                </div>
                            </div>
                        ))}

                        {/* Thinking indicator */}
                        {isLoading && (
                            <div className="flex gap-2 flex-row">
                                <div
                                    className="shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-white mt-0.5"
                                    style={{ background: "linear-gradient(135deg, #7c3aed, #4f46e5)" }}
                                >
                                    <Bot size={13} />
                                </div>
                                <div
                                    className="rounded-2xl rounded-tl-sm px-3 py-2.5"
                                    style={{
                                        background: "var(--muted)",
                                        border: "1px solid var(--border)",
                                        color: "var(--muted-foreground)",
                                    }}
                                >
                                    <TypingDots />
                                </div>
                            </div>
                        )}

                        <div ref={messagesEndRef} />
                    </div>

                    {/* Input bar */}
                    <div
                        className="shrink-0 flex items-end gap-2 px-3 py-3"
                        style={{
                            background: "var(--card)",
                            borderTop: "1px solid var(--border)",
                        }}
                    >
                        <textarea
                            ref={inputRef}
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder="Ask about your finances…"
                            rows={1}
                            disabled={isLoading}
                            className="flex-1 resize-none rounded-xl px-3 py-2 text-sm outline-none transition-colors disabled:opacity-50"
                            style={{
                                background: "var(--input)",
                                border: "1px solid var(--border)",
                                color: "var(--foreground)",
                                minHeight: "38px",
                                maxHeight: "96px",
                            }}
                            onInput={(e) => {
                                e.target.style.height = "auto";
                                e.target.style.height = Math.min(e.target.scrollHeight, 96) + "px";
                            }}
                        />
                        <button
                            onClick={handleSend}
                            disabled={!input.trim() || isLoading}
                            className="shrink-0 flex items-center justify-center w-9 h-9 rounded-xl text-white transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed hover:scale-105 active:scale-95"
                            style={{
                                background: "linear-gradient(135deg, #7c3aed, #4f46e5)",
                            }}
                            aria-label="Send message"
                        >
                            <Send size={15} />
                        </button>
                    </div>
                </div>
            )}
        </>
    );
}
