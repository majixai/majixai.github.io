import os
import json
import shutil
import sqlite3

def main():
    print("Building investing blog...")

    # Create dist directory
    if os.path.exists("dist"):
        shutil.rmtree("dist")
    os.makedirs("dist/static")

    # Copy static files
    shutil.copytree("investing_blog/static", "dist/static", dirs_exist_ok=True)

    # Connect to the database
    conn = sqlite3.connect('blog.db')
    conn.row_factory = sqlite3.Row
    c = conn.cursor()

    # Read published posts
    c.execute("SELECT * FROM posts WHERE status = 'published' ORDER BY created_at DESC")
    posts = c.fetchall()
    all_tags = set()
    for post in posts:
        if post['tags']:
            all_tags.update(json.loads(post['tags']))


    # Generate HTML for posts
    posts_html = ""
    for post in posts:
        tags_html = ""
        if post['tags']:
            for tag in json.loads(post['tags']):
                tags_html += f'<span class="tag">{tag}</span>'
        posts_html += f"""
        <div class="blog-post">
            <h2 class="blog-post-title">{post['title']}</h2>
            <p class="blog-post-meta">{post['created_at']} by Jules</p>
            <div>{tags_html}</div>
            <p>{post['content']}</p>
        </div>
        """

    # Generate HTML for tags list
    tags_list_html = "<h5>Tags</h5>"
    for tag in sorted(list(all_tags)):
        tags_list_html += f'<a href="#" class="tag">{tag}</a>'


    # Read template and generate index.html
    with open("investing_blog/templates/index.html") as f:
        template = f.read()

    html = template.replace("<!-- Blog posts will be dynamically inserted here -->", posts_html)
    html = html.replace("<!-- Tags will be dynamically inserted here -->", tags_list_html)


    with open("dist/index.html", "w") as f:
        f.write(html)

    conn.close()

    print("Blog built successfully!")

if __name__ == "__main__":
    main()