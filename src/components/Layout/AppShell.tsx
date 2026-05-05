import * as Label from "@radix-ui/react-label";
import * as RadioGroup from "@radix-ui/react-radio-group";
import { useMemo, useState } from "react";
import { AIChatPanel } from "../AIChat/AIChatPanel";
import { AdjustmentSliders } from "../Editor/AdjustmentSliders";
import { EditorCanvas } from "../Editor/EditorCanvas";
import { HistogramStub } from "../Editor/HistogramStub";
import { LibraryPanel } from "../Library/LibraryPanel";
import { SettingsDialog } from "../Settings/SettingsDialog";

const DEFAULT_WORKSPACE = "default-library";

export function AppShell() {
  const [workspaceKey] = useState(DEFAULT_WORKSPACE);
  const [activePhotoId, setActivePhotoId] = useState<number | null>(null);
  const [activePhotoPath, setActivePhotoPath] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [chatScope, setChatScope] = useState<"workspace" | "photo">("workspace");
  const [libraryVersion, setLibraryVersion] = useState(0);

  const chatScopeKey = useMemo(() => {
    if (chatScope === "workspace") return workspaceKey;
    return activePhotoId != null ? `photo:${activePhotoId}` : "photo:none";
  }, [chatScope, workspaceKey, activePhotoId]);

  const photoHint =
    activePhotoId != null ? `photo_id:${activePhotoId}` : null;

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="brand">Photone AI</div>
        <div className="header-actions">
          <RadioGroup.Root
            className="scope-radio-group"
            value={chatScope}
            onValueChange={(v) => {
              if (v === "workspace" || v === "photo") setChatScope(v);
            }}
            aria-label="Chat context"
          >
            <div className="scope-radio-row">
              <RadioGroup.Item className="scope-radio-item" value="workspace" id="scope-ws" />
              <Label.Root className="scope-radio-label" htmlFor="scope-ws">
                Workspace chat
              </Label.Root>
            </div>
            <div className="scope-radio-row">
              <RadioGroup.Item className="scope-radio-item" value="photo" id="scope-ph" />
              <Label.Root className="scope-radio-label" htmlFor="scope-ph">
                Photo chat
              </Label.Root>
            </div>
          </RadioGroup.Root>
          <button
            type="button"
            className="btn-ghost header-settings-btn"
            onClick={() => setSettingsOpen(true)}
          >
            Settings
          </button>
        </div>
      </header>
      <main className="app-main">
        <aside className="col-library">
          <LibraryPanel
            workspaceKey={workspaceKey}
            activePhotoId={activePhotoId}
            onSelectPhoto={(id, path) => {
              setActivePhotoId(id);
              setActivePhotoPath(path ?? null);
            }}
            libraryVersion={libraryVersion}
          />
        </aside>
        <section className="col-editor">
          <div className="editor-preview">
            <EditorCanvas photoPath={activePhotoPath} />
          </div>
          <HistogramStub />
        </section>
        <aside className="col-adjustments">
          <AdjustmentSliders />
        </aside>
        <aside className="col-chat">
          <AIChatPanel
            scopeKind={chatScope}
            scopeKey={chatScopeKey}
            workspaceHint={workspaceKey}
            photoHint={photoHint}
          />
        </aside>
      </main>
      <SettingsDialog
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        onPhotosImported={() => setLibraryVersion((v) => v + 1)}
      />
    </div>
  );
}
