import { create } from "zustand";
import type { EditorAdjustments, EditorDelta, EditorState } from "../types/editor";
import { defaultAdjustments } from "../types/editor";

function clamp(n: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, n));
}

export interface EditorStore extends EditorState {
  setAdjustment: <K extends keyof EditorAdjustments>(
    key: K,
    value: number,
  ) => void;
  setLutId: (id: string | null) => void;
  applyDelta: (delta: EditorDelta) => void;
  toJsonString: () => string;
}

const initial: EditorState = {
  version: 1,
  adjustments: defaultAdjustments(),
  lutId: "canon_a1_standard",
};

export const useEditorStore = create<EditorStore>((set, get) => ({
  ...initial,
  setAdjustment: (key, value) =>
    set((s) => ({
      adjustments: { ...s.adjustments, [key]: value },
    })),
  setLutId: (lutId) => set({ lutId }),
  applyDelta: (delta) => {
    if (delta.version !== 1) return;
    set((s) => {
      const a = s.adjustments;
      const d = delta.adjustments;
      return {
        adjustments: {
          exposure: clamp(a.exposure + d.exposure, -2, 2),
          contrast: clamp(a.contrast + d.contrast, -1, 1),
          highlights: clamp(a.highlights + d.highlights, -1, 1),
          shadows: clamp(a.shadows + d.shadows, -1, 1),
          temperature: clamp(a.temperature + d.temperature, -100, 100),
          tint: clamp(a.tint + d.tint, -100, 100),
        },
        lutId: delta.lutId ?? s.lutId,
      };
    });
  },
  toJsonString: () => JSON.stringify(get()),
}));
