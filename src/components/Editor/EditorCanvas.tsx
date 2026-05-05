import { convertFileSrc, isTauri } from "@tauri-apps/api/core";
import { useEffect, useRef } from "react";
import { useEditorStore } from "../../store/useEditorStore";
import { EditorPipeline } from "../../engine/pipeline";

const LUT_MAP: Record<string, string> = {
  neutral: "/luts/canon_a1_standard.cube",
  canon_a1_standard: "/luts/canon_a1_standard.cube",
  yashica_mat_124g_bw: "/luts/yashica_mat_124g_bw.cube",
  yashica_electro_35: "/luts/yashica_electro_35.cube",
};

interface EditorCanvasProps {
  /** Absolute file path from the library catalog; shown in the Tauri webview only. */
  photoPath: string | null;
}

export function EditorCanvas({ photoPath }: EditorCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pipelineRef = useRef<EditorPipeline | null>(null);
  const adjustments = useEditorStore((s) => s.adjustments);
  const lutId = useEditorStore((s) => s.lutId);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let pipe: EditorPipeline;
    try {
      pipe = new EditorPipeline(canvas);
    } catch {
      return;
    }
    pipelineRef.current = pipe;
    const ro = new ResizeObserver(() => {
      const el = canvas.parentElement;
      if (!el || !pipelineRef.current) return;
      pipelineRef.current.resize(el.clientWidth, el.clientHeight);
      pipelineRef.current.draw(useEditorStore.getState().adjustments);
    });
    ro.observe(canvas.parentElement ?? canvas);
    pipe.resize(canvas.clientWidth, canvas.clientHeight);
    pipe.draw(useEditorStore.getState().adjustments);
    return () => {
      ro.disconnect();
      pipe.dispose();
      pipelineRef.current = null;
    };
  }, []);

  useEffect(() => {
    const pipe = pipelineRef.current;
    if (!pipe) return;
    let cancelled = false;
    const url = lutId ? LUT_MAP[lutId] ?? LUT_MAP.canon_a1_standard : null;
    if (!url) {
      pipe.clearLut();
      pipe.draw(useEditorStore.getState().adjustments);
      return;
    }
    void pipe
      .loadLutFromUrl(url)
      .then(() => {
        if (!cancelled) pipe.draw(useEditorStore.getState().adjustments);
      })
      .catch(() => {
        pipe.clearLut();
        if (!cancelled) pipe.draw(useEditorStore.getState().adjustments);
      });
    return () => {
      cancelled = true;
    };
  }, [lutId]);

  useEffect(() => {
    const pipe = pipelineRef.current;
    if (!pipe) return;
    const p = pipe;
    let cancelled = false;

    async function syncPhoto() {
      if (!photoPath || !isTauri()) {
        p.loadPlaceholder();
        if (!cancelled) p.draw(useEditorStore.getState().adjustments);
        return;
      }
      try {
        const src = convertFileSrc(photoPath);
        await p.loadImageFromUrl(src);
        if (!cancelled) p.draw(useEditorStore.getState().adjustments);
      } catch {
        p.loadPlaceholder();
        if (!cancelled) p.draw(useEditorStore.getState().adjustments);
      }
    }

    void syncPhoto();
    return () => {
      cancelled = true;
    };
  }, [photoPath]);

  useEffect(() => {
    pipelineRef.current?.draw(adjustments);
  }, [adjustments]);

  return (
    <canvas
      ref={canvasRef}
      className="editor-canvas"
      width={640}
      height={480}
      aria-label="Edit preview"
    />
  );
}
