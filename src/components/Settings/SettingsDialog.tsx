import * as Dialog from "@radix-ui/react-dialog";
import * as Label from "@radix-ui/react-label";
import { useEffect, useState } from "react";
import { getSettings, pickAndImportPhotos, setSettings } from "../../api/ipc";

interface SettingsDialogProps {
  open: boolean;
  onClose: () => void;
  /** Called after photos are imported so the Library can refresh. */
  onPhotosImported?: () => void;
}

export function SettingsDialog({ open, onClose, onPhotosImported }: SettingsDialogProps) {
  const [baseUrl, setBaseUrl] = useState("https://api.openai.com/v1");
  const [model, setModel] = useState("gpt-4o-mini");
  const [apiKey, setApiKey] = useState("");
  const [hasKey, setHasKey] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [importStatus, setImportStatus] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    void (async () => {
      try {
        const s = await getSettings();
        setBaseUrl(s.baseUrl);
        setModel(s.model);
        setHasKey(s.hasApiKey);
        setApiKey("");
        setStatus(null);
        setImportStatus(null);
      } catch (e) {
        setStatus(String(e));
      }
    })();
  }, [open]);

  async function save() {
    setStatus(null);
    try {
      await setSettings({
        base_url: baseUrl.trim(),
        model: model.trim(),
        ...(apiKey.trim() !== "" ? { api_key: apiKey.trim() } : {}),
      });
      const s = await getSettings();
      setHasKey(s.hasApiKey);
      setApiKey("");
      setStatus("Saved.");
    } catch (e) {
      setStatus(String(e));
    }
  }

  async function clearKey() {
    setStatus(null);
    try {
      await setSettings({
        base_url: baseUrl.trim(),
        model: model.trim(),
        api_key: "",
      });
      setHasKey(false);
      setApiKey("");
      setStatus("API key cleared.");
    } catch (e) {
      setStatus(String(e));
    }
  }

  async function importPhotosFromSettings() {
    setImportStatus(null);
    try {
      const res = await pickAndImportPhotos();
      if (res === null) return;
      const errTail =
        res.errors.length > 0
          ? ` ${res.errors.slice(0, 2).join("; ")}${res.errors.length > 2 ? "…" : ""}`
          : "";
      setImportStatus(
        `Imported ${res.imported}, skipped ${res.skipped}.${errTail}`,
      );
      onPhotosImported?.();
    } catch (e) {
      setImportStatus(String(e));
    }
  }

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content className="dialog-content">
          <div className="dialog-header-row">
            <Dialog.Title className="dialog-title">Settings</Dialog.Title>
            <Dialog.Close asChild>
              <button type="button" className="dialog-close" aria-label="Close settings">
                ×
              </button>
            </Dialog.Close>
          </div>
          <Dialog.Description className="dialog-description">
            OpenAI-compatible endpoint. The API key is stored in the OS keychain.
            {hasKey ? " A key is on file." : " No key on file."}
          </Dialog.Description>
          <div className="field">
            <Label.Root className="field-label" htmlFor="settings-base-url">
              Base URL
            </Label.Root>
            <input
              id="settings-base-url"
              className="field-input"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.currentTarget.value)}
              autoComplete="off"
            />
          </div>
          <div className="field">
            <Label.Root className="field-label" htmlFor="settings-model">
              Model
            </Label.Root>
            <input
              id="settings-model"
              className="field-input"
              value={model}
              onChange={(e) => setModel(e.currentTarget.value)}
              autoComplete="off"
            />
          </div>
          <div className="field">
            <Label.Root className="field-label" htmlFor="settings-api-key">
              New API key (leave blank to keep)
            </Label.Root>
            <input
              id="settings-api-key"
              className="field-input"
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.currentTarget.value)}
              autoComplete="new-password"
            />
          </div>
          <hr className="modal-divider" />
          <h3 className="modal-subtitle">Library</h3>
          <p className="dialog-description">
            Add image files to the local catalog (stored in your app database). You can also use{" "}
            <strong>Add photos…</strong> in the Library column.
          </p>
          <div className="modal-actions modal-actions-left">
            <button
              type="button"
              className="btn-primary"
              onClick={() => void importPhotosFromSettings()}
            >
              Import photos…
            </button>
          </div>
          {importStatus && <p className="dialog-footnote">{importStatus}</p>}
          {status && <p className="dialog-footnote">{status}</p>}
          <div className="modal-actions">
            <button type="button" className="btn-ghost" onClick={() => void clearKey()}>
              Clear key
            </button>
            <button type="button" className="btn-primary" onClick={() => void save()}>
              Save
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
