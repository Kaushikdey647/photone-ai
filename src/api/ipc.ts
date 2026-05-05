import { invoke, isTauri } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import type { EditorDelta } from "../types/editor";

function requireTauri(): void {
  if (!isTauri()) {
    throw new Error(
      "Native features need the Tauri shell. Run `npm run tauri dev` instead of `npm run dev` (Vite alone has no IPC bridge).",
    );
  }
}

export interface AppSettingsDto {
  baseUrl: string;
  model: string;
  hasApiKey: boolean;
}

export interface ChatMessageRow {
  id: number;
  role: string;
  content: string;
  createdAt: string;
}

export interface SendMessageResponse {
  assistantText: string;
  editorDelta: EditorDelta | null;
}

export interface PhotoRow {
  id: number;
  filePath: string;
  thumbnailPath: string | null;
  dateImported: string;
}

export function getSettings(): Promise<AppSettingsDto> {
  requireTauri();
  return invoke("get_settings");
}

export function setSettings(payload: {
  base_url: string;
  model: string;
  api_key?: string | null;
}): Promise<void> {
  requireTauri();
  return invoke("set_settings", {
    baseUrl: payload.base_url,
    model: payload.model,
    ...(payload.api_key !== undefined && payload.api_key !== null
      ? { apiKey: payload.api_key }
      : {}),
  });
}

export function listChatMessages(payload: {
  scope_kind: string;
  scope_key: string;
  limit?: number | null;
}): Promise<ChatMessageRow[]> {
  requireTauri();
  return invoke("list_chat_messages", {
    scopeKind: payload.scope_kind,
    scopeKey: payload.scope_key,
    ...(payload.limit != null ? { limit: payload.limit } : {}),
  });
}

export function sendChatMessage(payload: {
  scope_kind: string;
  scope_key: string;
  user_text: string;
  editor_state_json: string;
  workspace_hint?: string | null;
  photo_hint?: string | null;
  history_limit?: number | null;
}): Promise<SendMessageResponse> {
  requireTauri();
  return invoke("send_chat_message", {
    scopeKind: payload.scope_kind,
    scopeKey: payload.scope_key,
    userText: payload.user_text,
    editorStateJson: payload.editor_state_json,
    workspaceHint: payload.workspace_hint ?? undefined,
    photoHint: payload.photo_hint ?? undefined,
    historyLimit: payload.history_limit ?? undefined,
  });
}

export function listPhotos(): Promise<PhotoRow[]> {
  requireTauri();
  return invoke("list_photos");
}

export interface ImportPhotosResult {
  imported: number;
  skipped: number;
  errors: string[];
}

export function importPhotos(paths: string[]): Promise<ImportPhotosResult> {
  requireTauri();
  return invoke("import_photos", { paths });
}

/** Native file picker, then import into the SQLite catalog. Returns null if cancelled. */
export async function pickAndImportPhotos(): Promise<ImportPhotosResult | null> {
  requireTauri();
  const selected = await open({
    multiple: true,
    title: "Add photos to library",
    filters: [
      {
        name: "Images",
        extensions: [
          "jpg",
          "jpeg",
          "png",
          "webp",
          "tif",
          "tiff",
          "bmp",
          "gif",
          "heic",
          "heif",
          "raw",
          "cr2",
          "cr3",
          "nef",
          "arw",
          "dng",
          "orf",
          "rw2",
          "raf",
        ],
      },
    ],
  });
  if (selected === null) return null;
  const paths = Array.isArray(selected) ? selected : [selected];
  if (paths.length === 0) return null;
  return importPhotos(paths);
}
