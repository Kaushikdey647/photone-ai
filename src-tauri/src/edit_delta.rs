use serde::{Deserialize, Serialize};
use serde_json::Value;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EditorAdjustments {
    #[serde(default)]
    pub exposure: f32,
    #[serde(default)]
    pub contrast: f32,
    #[serde(default)]
    pub highlights: f32,
    #[serde(default)]
    pub shadows: f32,
    #[serde(default)]
    pub temperature: f32,
    #[serde(default)]
    pub tint: f32,
}

impl Default for EditorAdjustments {
    fn default() -> Self {
        Self {
            exposure: 0.0,
            contrast: 0.0,
            highlights: 0.0,
            shadows: 0.0,
            temperature: 0.0,
            tint: 0.0,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EditorDelta {
    pub version: u32,
    #[serde(default)]
    pub adjustments: EditorAdjustments,
    #[serde(default)]
    pub lut_id: Option<String>,
}

impl EditorDelta {
    pub fn validate(&self) -> Result<(), String> {
        if self.version != 1 {
            return Err(format!("Unsupported editor delta version {}", self.version));
        }
        Ok(())
    }
}

pub fn parse_editor_delta_from_assistant(content: &str) -> Option<EditorDelta> {
    let trimmed = content.trim();
    if let Ok(v) = serde_json::from_str::<EditorDelta>(trimmed) {
        return v.validate().ok().map(|_| v);
    }
    if let Some(json) = extract_json_fence(trimmed) {
        if let Ok(v) = serde_json::from_str::<EditorDelta>(json) {
            return v.validate().ok().map(|_| v);
        }
    }
    if let Some(obj) = extract_json_object(trimmed) {
        if let Ok(v) = serde_json::from_str::<EditorDelta>(&obj) {
            return v.validate().ok().map(|_| v);
        }
    }
    None
}

fn extract_json_fence(s: &str) -> Option<&str> {
    let start = s.find("```json")?;
    let rest = &s[start + 7..];
    let end = rest.find("```")?;
    Some(rest[..end].trim())
}

fn extract_json_object(s: &str) -> Option<String> {
    let start = s.find('{')?;
    let end = s.rfind('}')?;
    if end > start {
        Some(s[start..=end].to_string())
    } else {
        None
    }
}

#[allow(dead_code)]
pub fn merge_delta_into_value(base: &mut Value, delta: &EditorDelta) {
    if let Some(obj) = base.as_object_mut() {
        let adj = serde_json::to_value(&delta.adjustments).unwrap_or_default();
        obj.insert("adjustments".to_string(), adj);
        if let Some(lut) = &delta.lut_id {
            obj.insert("lutId".to_string(), Value::String(lut.clone()));
        }
    }
}
