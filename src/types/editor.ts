export interface EditorAdjustments {
  exposure: number;
  contrast: number;
  highlights: number;
  shadows: number;
  temperature: number;
  tint: number;
}

export interface EditorDelta {
  version: number;
  adjustments: EditorAdjustments;
  lutId: string | null;
}

export interface EditorState {
  version: number;
  adjustments: EditorAdjustments;
  lutId: string | null;
}

export const defaultAdjustments = (): EditorAdjustments => ({
  exposure: 0,
  contrast: 0,
  highlights: 0,
  shadows: 0,
  temperature: 0,
  tint: 0,
});
