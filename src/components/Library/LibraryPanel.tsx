import * as ScrollArea from "@radix-ui/react-scroll-area";
import { useCallback, useEffect, useState } from "react";
import { listPhotos, pickAndImportPhotos, type PhotoRow } from "../../api/ipc";

interface LibraryPanelProps {
  workspaceKey: string;
  activePhotoId: number | null;
  onSelectPhoto: (id: number | null, filePath?: string | null) => void;
  /** Increment when catalog changes (e.g. import from Settings) to force refresh. */
  libraryVersion?: number;
}

export function LibraryPanel({
  workspaceKey,
  activePhotoId,
  onSelectPhoto,
  libraryVersion = 0,
}: LibraryPanelProps) {
  const [photos, setPhotos] = useState<PhotoRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [importNote, setImportNote] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setError(null);
      const rows = await listPhotos();
      setPhotos(rows);
    } catch (e) {
      setError(String(e));
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh, workspaceKey, libraryVersion]);

  async function onAddPhotos() {
    setImportNote(null);
    setError(null);
    try {
      const res = await pickAndImportPhotos();
      if (res === null) return;
      const errTail =
        res.errors.length > 0
          ? ` Errors: ${res.errors.slice(0, 3).join("; ")}${res.errors.length > 3 ? "…" : ""}`
          : "";
      setImportNote(
        `Imported ${res.imported}, skipped ${res.skipped}.${errTail}`,
      );
      await refresh();
    } catch (e) {
      setError(String(e));
    }
  }

  return (
    <div className="library-panel">
      <div className="panel-header">
        <span className="panel-title">Library</span>
        <div className="panel-header-actions">
          <button type="button" className="btn-primary" onClick={() => void onAddPhotos()}>
            Add photos…
          </button>
          <button type="button" className="btn-ghost" onClick={() => void refresh()}>
            Refresh
          </button>
        </div>
      </div>
      <div className="panel-muted">Workspace: {workspaceKey}</div>
      {importNote && <div className="panel-muted import-note">{importNote}</div>}
      {error && <div className="panel-error">{error}</div>}
      <ScrollArea.Root className="library-scroll-root">
        <ScrollArea.Viewport className="library-scroll-viewport">
          <div className="library-scroll-inner">
            <div className="photo-grid">
              <button
                type="button"
                className={`photo-tile ${activePhotoId === null ? "active" : ""}`}
                onClick={() => onSelectPhoto(null, null)}
              >
                No selection
              </button>
              {photos.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className={`photo-tile ${activePhotoId === p.id ? "active" : ""}`}
                  onClick={() => onSelectPhoto(p.id, p.filePath)}
                  title={p.filePath}
                >
                  <span className="photo-id">#{p.id}</span>
                  <span className="photo-path">{p.filePath}</span>
                </button>
              ))}
            </div>
            {photos.length === 0 && !error && (
              <p className="panel-muted library-empty-hint">
                No photos yet. Use <strong>Add photos…</strong> or import from Settings.
              </p>
            )}
          </div>
        </ScrollArea.Viewport>
        <ScrollArea.Scrollbar className="radix-scroll-bar" orientation="vertical">
          <ScrollArea.Thumb className="radix-scroll-thumb" />
        </ScrollArea.Scrollbar>
      </ScrollArea.Root>
    </div>
  );
}
