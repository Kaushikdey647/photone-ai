import * as Label from "@radix-ui/react-label";
import * as ScrollArea from "@radix-ui/react-scroll-area";
import * as Select from "@radix-ui/react-select";
import * as Separator from "@radix-ui/react-separator";
import * as Slider from "@radix-ui/react-slider";
import { useEditorStore } from "../../store/useEditorStore";
import type { EditorAdjustments } from "../../types/editor";

const fields: {
  key: keyof EditorAdjustments;
  label: string;
  min: number;
  max: number;
  step: number;
  decimals: number;
}[] = [
  { key: "exposure", label: "Exposure", min: -2, max: 2, step: 0.02, decimals: 2 },
  { key: "contrast", label: "Contrast", min: -1, max: 1, step: 0.02, decimals: 2 },
  { key: "highlights", label: "Highlights", min: -1, max: 1, step: 0.02, decimals: 2 },
  { key: "shadows", label: "Shadows", min: -1, max: 1, step: 0.02, decimals: 2 },
  { key: "temperature", label: "Temperature", min: -80, max: 80, step: 1, decimals: 0 },
  { key: "tint", label: "Tint", min: -80, max: 80, step: 1, decimals: 0 },
];

const lutOptions: { value: string; label: string }[] = [
  { value: "canon_a1_standard", label: "Canon A1 standard" },
  { value: "yashica_mat_124g_bw", label: "Yashica Mat 124G BW" },
  { value: "yashica_electro_35", label: "Yashica Electro 35" },
];

function SelectChevron() {
  return (
    <Select.Icon className="radix-select-icon" aria-hidden>
      <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden>
        <polyline
          points="3.5 5.25 7 8.75 10.5 5.25"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </Select.Icon>
  );
}

export function AdjustmentSliders() {
  const adjustments = useEditorStore((s) => s.adjustments);
  const setAdjustment = useEditorStore((s) => s.setAdjustment);
  const lutId = useEditorStore((s) => s.lutId);
  const setLutId = useEditorStore((s) => s.setLutId);

  const lutValue = lutId ?? "canon_a1_standard";

  return (
    <div className="adjustments-sidebar">
      <div className="adjustments-sidebar-header">
        <h2 className="adjustments-sidebar-title">Develop</h2>
        <p className="adjustments-sidebar-sub">Tone and color</p>
      </div>
      <ScrollArea.Root className="adjustments-scroll-root">
        <ScrollArea.Viewport className="adjustments-scroll-viewport">
          <div className="adjustments-scroll-padding">
            {fields.map((f) => (
              <div key={f.key} className="adjustment-field">
                <div className="adjustment-field-head">
                  <Label.Root className="adjustment-label" htmlFor={`adj-${f.key}`}>
                    {f.label}
                  </Label.Root>
                  <span className="adjustment-value-readout">
                    {f.decimals === 0
                      ? Math.round(adjustments[f.key])
                      : adjustments[f.key].toFixed(f.decimals)}
                  </span>
                </div>
                <Slider.Root
                  id={`adj-${f.key}`}
                  className="radix-slider-root"
                  min={f.min}
                  max={f.max}
                  step={f.step}
                  value={[adjustments[f.key]]}
                  onValueChange={(v) => {
                    const next = v[0];
                    if (next === undefined) return;
                    setAdjustment(f.key, next);
                  }}
                >
                  <Slider.Track className="radix-slider-track">
                    <Slider.Range className="radix-slider-range" />
                  </Slider.Track>
                  <Slider.Thumb className="radix-slider-thumb" aria-label={f.label} />
                </Slider.Root>
              </div>
            ))}

            <Separator.Root className="radix-separator" />

            <div className="adjustment-field">
              <Label.Root className="adjustment-label" htmlFor="lut-select">
                LUT / look
              </Label.Root>
              <Select.Root value={lutValue} onValueChange={setLutId}>
                <Select.Trigger id="lut-select" className="radix-select-trigger" aria-label="LUT preset">
                  <Select.Value />
                  <SelectChevron />
                </Select.Trigger>
                <Select.Portal>
                  <Select.Content className="radix-select-content" position="popper" sideOffset={6}>
                    <Select.Viewport className="radix-select-viewport">
                      {lutOptions.map((opt) => (
                        <Select.Item key={opt.value} value={opt.value} className="radix-select-item">
                          <Select.ItemText>{opt.label}</Select.ItemText>
                        </Select.Item>
                      ))}
                    </Select.Viewport>
                  </Select.Content>
                </Select.Portal>
              </Select.Root>
            </div>
          </div>
        </ScrollArea.Viewport>
        <ScrollArea.Scrollbar className="radix-scroll-bar" orientation="vertical">
          <ScrollArea.Thumb className="radix-scroll-thumb" />
        </ScrollArea.Scrollbar>
      </ScrollArea.Root>
    </div>
  );
}
