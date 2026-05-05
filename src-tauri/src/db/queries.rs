use chrono::Utc;
use serde::Serialize;
use sqlx::SqlitePool;

#[derive(Debug, Serialize, sqlx::FromRow)]
#[serde(rename_all = "camelCase")]
pub struct MessageRow {
    pub id: i64,
    pub role: String,
    pub content: String,
    pub created_at: String,
}

pub async fn get_or_create_conversation(
    pool: &SqlitePool,
    scope_kind: &str,
    scope_key: &str,
) -> Result<i64, sqlx::Error> {
    let now = Utc::now().to_rfc3339();
    let id: Option<(i64,)> = sqlx::query_as(
        "SELECT id FROM conversations WHERE scope_kind = ?1 AND scope_key = ?2",
    )
    .bind(scope_kind)
    .bind(scope_key)
    .fetch_optional(pool)
    .await?;

    if let Some((id,)) = id {
        return Ok(id);
    }

    sqlx::query(
        "INSERT INTO conversations (scope_kind, scope_key, updated_at) VALUES (?1, ?2, ?3)",
    )
    .bind(scope_kind)
    .bind(scope_key)
    .bind(&now)
    .execute(pool)
    .await?;

    let (id,): (i64,) = sqlx::query_as(
        "SELECT id FROM conversations WHERE scope_kind = ?1 AND scope_key = ?2",
    )
    .bind(scope_kind)
    .bind(scope_key)
    .fetch_one(pool)
    .await?;

    Ok(id)
}

pub async fn touch_conversation(pool: &SqlitePool, conversation_id: i64) -> Result<(), sqlx::Error> {
    let now = Utc::now().to_rfc3339();
    sqlx::query("UPDATE conversations SET updated_at = ?1 WHERE id = ?2")
        .bind(now)
        .bind(conversation_id)
        .execute(pool)
        .await?;
    Ok(())
}

pub async fn insert_message(
    pool: &SqlitePool,
    conversation_id: i64,
    role: &str,
    content: &str,
) -> Result<i64, sqlx::Error> {
    let now = Utc::now().to_rfc3339();
    sqlx::query(
        "INSERT INTO messages (conversation_id, role, content, created_at) VALUES (?1, ?2, ?3, ?4)",
    )
    .bind(conversation_id)
    .bind(role)
    .bind(content)
    .bind(now)
    .execute(pool)
    .await?;
    let id: i64 = sqlx::query_scalar("SELECT last_insert_rowid()")
        .fetch_one(pool)
        .await?;
    Ok(id)
}

pub async fn list_recent_messages_tail(
    pool: &SqlitePool,
    conversation_id: i64,
    limit: i64,
) -> Result<Vec<MessageRow>, sqlx::Error> {
    sqlx::query_as::<_, MessageRow>(
        r#"
        SELECT id, role, content, created_at FROM (
            SELECT id, role, content, created_at
            FROM messages
            WHERE conversation_id = ?1
            ORDER BY datetime(created_at) DESC, id DESC
            LIMIT ?2
        ) t
        ORDER BY datetime(created_at) ASC, id ASC
        "#,
    )
    .bind(conversation_id)
    .bind(limit)
    .fetch_all(pool)
    .await
}
