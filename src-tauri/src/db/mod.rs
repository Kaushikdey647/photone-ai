pub mod queries;

use sqlx::sqlite::SqlitePoolOptions;
use sqlx::SqlitePool;

pub async fn connect_pool(db_path: &std::path::Path) -> Result<SqlitePool, sqlx::Error> {
    let url = format!(
        "sqlite:{}?mode=rwc",
        db_path.to_string_lossy().replace(':', "%3A")
    );
    let pool = SqlitePoolOptions::new()
        .max_connections(5)
        .connect(&url)
        .await?;
    sqlx::migrate!("./migrations").run(&pool).await?;
    Ok(pool)
}
