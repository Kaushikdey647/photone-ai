//! Image I/O and export (stub for greenfield scaffold).

use std::path::{Path, PathBuf};

#[allow(dead_code)]
#[derive(Debug, thiserror::Error)]
pub enum ImageIoError {
    #[error("path escapes allowed directory")]
    PathEscape,
    #[error("io: {0}")]
    Io(#[from] std::io::Error),
}

/// Ensures `candidate` resolves under `base` after canonicalization (best-effort on non-existent paths).
#[allow(dead_code)]
pub fn assert_under_base(base: &Path, candidate: &Path) -> Result<PathBuf, ImageIoError> {
    let base_canon = base
        .canonicalize()
        .unwrap_or_else(|_| base.to_path_buf());
    let joined = if candidate.is_absolute() {
        candidate.to_path_buf()
    } else {
        base_canon.join(candidate)
    };
    let resolved = joined
        .canonicalize()
        .unwrap_or_else(|_| joined);
    if !resolved.starts_with(&base_canon) {
        return Err(ImageIoError::PathEscape);
    }
    Ok(resolved)
}

pub async fn batch_export_stub(paths: Vec<String>) -> Result<String, String> {
    Ok(format!(
        "batch_export stub: received {} paths (not processed)",
        paths.len()
    ))
}
