import json
import sqlite3


DATABASE = 'blog.db'


SCHEMA_SQL = """
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    tags TEXT,
    status TEXT NOT NULL DEFAULT 'draft',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    summary TEXT NOT NULL DEFAULT '',
    author TEXT NOT NULL DEFAULT 'admin',
    published INTEGER NOT NULL DEFAULT 0,
    view_count INTEGER NOT NULL DEFAULT 0,
    updated_at TIMESTAMP
);

CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    slug TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS post_categories (
    post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
    PRIMARY KEY (post_id, category_id)
);

CREATE TABLE IF NOT EXISTS tags (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS post_tags (
    post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    PRIMARY KEY (post_id, tag_id)
);

CREATE TABLE IF NOT EXISTS comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    author TEXT NOT NULL DEFAULT 'anonymous',
    body TEXT NOT NULL,
    approved INTEGER NOT NULL DEFAULT 0,
    sentiment_score REAL NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS post_revisions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    revision_number INTEGER NOT NULL,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    tags TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (post_id, revision_number)
);

CREATE INDEX IF NOT EXISTS idx_posts_status_created_at ON posts(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_comments_post ON comments(post_id);
CREATE INDEX IF NOT EXISTS idx_comments_approved ON comments(approved);
CREATE INDEX IF NOT EXISTS idx_post_tags_tag ON post_tags(tag_id);
CREATE INDEX IF NOT EXISTS idx_post_categories_category ON post_categories(category_id);
CREATE INDEX IF NOT EXISTS idx_post_revisions_post ON post_revisions(post_id);
"""


INDEX_SQL = """
CREATE INDEX IF NOT EXISTS idx_posts_published ON posts(published);
CREATE INDEX IF NOT EXISTS idx_posts_author ON posts(author);
"""


VIEW_SQL = """
CREATE VIEW IF NOT EXISTS published_posts AS
SELECT * FROM posts WHERE status = 'published' OR published = 1;

CREATE VIEW IF NOT EXISTS draft_posts AS
SELECT * FROM posts WHERE status = 'draft' OR published = 0;

CREATE VIEW IF NOT EXISTS tag_usage AS
SELECT
    t.id AS tag_id,
    t.name AS tag_name,
    COUNT(pt.post_id) AS post_count
FROM tags t
LEFT JOIN post_tags pt ON pt.tag_id = t.id
GROUP BY t.id, t.name
ORDER BY post_count DESC, t.name ASC;

CREATE VIEW IF NOT EXISTS comment_activity AS
SELECT
    p.id AS post_id,
    p.title,
    COUNT(c.id) AS comment_count,
    SUM(CASE WHEN c.approved = 1 THEN 1 ELSE 0 END) AS approved_comments
FROM posts p
LEFT JOIN comments c ON c.post_id = p.id
GROUP BY p.id, p.title;

CREATE VIEW IF NOT EXISTS blog_overview AS
SELECT
    (SELECT COUNT(*) FROM posts) AS total_posts,
    (SELECT COUNT(*) FROM posts WHERE status = 'published' OR published = 1) AS published_posts,
    (SELECT COUNT(*) FROM posts WHERE status = 'draft' OR published = 0) AS draft_posts,
    (SELECT COUNT(*) FROM comments) AS total_comments,
    (SELECT COUNT(*) FROM tags) AS total_tags,
    (SELECT COUNT(*) FROM categories) AS total_categories,
    (SELECT COUNT(*) FROM post_revisions) AS total_revisions;
"""


def _ensure_blog_columns(db):
    existing = {row[1] for row in db.execute("PRAGMA table_info(posts)")}
    columns = {
        "summary": "TEXT NOT NULL DEFAULT ''",
        "author": "TEXT NOT NULL DEFAULT 'admin'",
        "published": "INTEGER NOT NULL DEFAULT 0",
        "view_count": "INTEGER NOT NULL DEFAULT 0",
        "updated_at": "TIMESTAMP",
    }

    for column, ddl in columns.items():
        if column not in existing:
            db.execute(f"ALTER TABLE posts ADD COLUMN {column} {ddl}")

    db.execute(
        """
        UPDATE posts
        SET
            summary = CASE
                WHEN summary IS NULL OR summary = '' THEN
                    CASE
                        WHEN content IS NULL OR content = '' THEN ''
                        WHEN length(content) > 200 THEN substr(content, 1, 200) || '...'
                        ELSE content
                    END
                ELSE summary
            END,
            author = COALESCE(author, 'admin'),
            published = CASE WHEN status = 'published' THEN 1 ELSE 0 END,
            view_count = COALESCE(view_count, 0),
            updated_at = COALESCE(updated_at, created_at)
        """
    )


def _seed_blog_indexes(db):
    posts = db.execute("SELECT id, title, content, tags, created_at FROM posts").fetchall()

    def ensure_comment(post_id, author, body, approved, sentiment_score):
        existing = db.execute(
            "SELECT 1 FROM comments WHERE post_id = ? AND author = ? AND body = ?",
            (post_id, author, body),
        ).fetchone()
        if not existing:
            db.execute(
                """
                INSERT INTO comments (post_id, author, body, approved, sentiment_score)
                VALUES (?, ?, ?, ?, ?)
                """,
                (post_id, author, body, approved, sentiment_score),
            )

    for post in posts:
        tags = []
        if post["tags"]:
            try:
                tags = json.loads(post["tags"])
            except json.JSONDecodeError:
                tags = []

        db.execute(
            """
            INSERT OR IGNORE INTO post_revisions (post_id, revision_number, title, content, tags, created_at)
            VALUES (?, 1, ?, ?, ?, ?)
            """,
            (post["id"], post["title"], post["content"], post["tags"], post["created_at"]),
        )

        if post["id"] == 1:
            ensure_comment(post["id"], "copilot", "Seeded draft post for MCP exploration.", 0, 0.15)
        elif post["id"] == 2:
            db.execute(
                "UPDATE posts SET status = 'published', published = 1 WHERE id = ?",
                (post["id"],),
            )
            ensure_comment(post["id"], "copilot", "This imported PDF summary is ready for review.", 1, 0.82)

        for tag_name in tags:
            db.execute("INSERT OR IGNORE INTO tags (name) VALUES (?)", (tag_name,))
            tag_row = db.execute("SELECT id FROM tags WHERE name = ?", (tag_name,)).fetchone()
            if tag_row:
                db.execute(
                    "INSERT OR IGNORE INTO post_tags (post_id, tag_id) VALUES (?, ?)",
                    (post["id"], tag_row["id"]),
                )

    db.execute("INSERT OR IGNORE INTO categories (name, slug) VALUES (?, ?)", ("Imported PDFs", "imported-pdfs"))
    category_row = db.execute("SELECT id FROM categories WHERE slug = ?", ("imported-pdfs",)).fetchone()
    if category_row:
        for post in posts:
            db.execute(
                "INSERT OR IGNORE INTO post_categories (post_id, category_id) VALUES (?, ?)",
                (post["id"], category_row["id"]),
            )


def init_db():
    conn = sqlite3.connect(DATABASE)
    conn.row_factory = sqlite3.Row

    try:
        conn.executescript(SCHEMA_SQL)
        _ensure_blog_columns(conn)
        conn.executescript(INDEX_SQL)
        conn.executescript(VIEW_SQL)
        _seed_blog_indexes(conn)
        conn.commit()
    finally:
        conn.close()


if __name__ == '__main__':
    init_db()
