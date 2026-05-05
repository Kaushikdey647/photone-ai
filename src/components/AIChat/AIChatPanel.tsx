import * as ScrollArea from "@radix-ui/react-scroll-area";
import { useCallback, useEffect, useState } from "react";
import {
  listChatMessages,
  sendChatMessage,
  type ChatMessageRow,
} from "../../api/ipc";
import { useEditorStore } from "../../store/useEditorStore";
import type { EditorDelta } from "../../types/editor";

interface AIChatPanelProps {
  scopeKind: "workspace" | "photo";
  scopeKey: string;
  workspaceHint: string;
  photoHint: string | null;
}

export function AIChatPanel({
  scopeKind,
  scopeKey,
  workspaceHint,
  photoHint,
}: AIChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessageRow[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const toJsonString = useEditorStore((s) => s.toJsonString);
  const applyDelta = useEditorStore((s) => s.applyDelta);

  const reload = useCallback(async () => {
    try {
      setError(null);
      const rows = await listChatMessages({
        scope_kind: scopeKind,
        scope_key: scopeKey,
        limit: 200,
      });
      setMessages(rows);
    } catch (e) {
      setError(String(e));
    }
  }, [scopeKind, scopeKey]);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function onSend() {
    const text = input.trim();
    if (!text || busy) return;
    setBusy(true);
    setError(null);
    setInput("");
    try {
      const res = await sendChatMessage({
        scope_kind: scopeKind,
        scope_key: scopeKey,
        user_text: text,
        editor_state_json: toJsonString(),
        workspace_hint: workspaceHint,
        photo_hint: photoHint,
        history_limit: 40,
      });
      if (res.editorDelta) {
        applyDelta(res.editorDelta as EditorDelta);
      }
      await reload();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="chat-panel">
      <div className="panel-header">
        <span className="panel-title">AI</span>
        <span className="panel-scope-pill">
          {scopeKind}:{scopeKey}
        </span>
      </div>
      {error && <div className="panel-error">{error}</div>}
      <ScrollArea.Root className="chat-scroll-root">
        <ScrollArea.Viewport className="chat-scroll-viewport">
          <div className="chat-scroll-inner">
            {messages.length === 0 && !error && (
              <p className="chat-empty-hint">
                No messages in this thread yet. Send a prompt below—the history loads here after
                each reply.
              </p>
            )}
            {messages.map((m) => (
              <div key={m.id} className={`chat-bubble chat-${m.role}`}>
                <div className="chat-role">{m.role}</div>
                <pre className="chat-body">{m.content}</pre>
              </div>
            ))}
          </div>
        </ScrollArea.Viewport>
        <ScrollArea.Scrollbar className="radix-scroll-bar" orientation="vertical">
          <ScrollArea.Thumb className="radix-scroll-thumb" />
        </ScrollArea.Scrollbar>
      </ScrollArea.Root>
      <div className="chat-input-row">
        <textarea
          className="chat-input"
          rows={3}
          value={input}
          placeholder="Ask for an edit or describe the look…"
          onChange={(e) => setInput(e.currentTarget.value)}
          disabled={busy}
        />
        <button
          type="button"
          className="btn-primary"
          disabled={busy || !input.trim()}
          onClick={() => void onSend()}
        >
          {busy ? "…" : "Send"}
        </button>
      </div>
    </div>
  );
}
