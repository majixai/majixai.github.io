import os
import json
import shutil

def main():
    print("Building investing blog...")

    # Create dist directory
    if os.path.exists("dist"):
        shutil.rmtree("dist")
    os.makedirs("dist/static")

    # Copy static files
    shutil.copytree("investing_blog/static", "dist/static", dirs_exist_ok=True)


    # Read posts
    posts = []
    all_tags = set()
    for filename in os.listdir("investing_blog/posts"):
        if filename.endswith(".json"):
            with open(os.path.join("investing_blog/posts", filename)) as f:
                post = json.load(f)
                posts.append(post)
                if "tags" in post:
                    all_tags.update(post["tags"])

    # Sort posts by date
    posts.sort(key=lambda x: x["date"], reverse=True)

    # Generate HTML for posts
    posts_html = ""
    for post in posts:
        tags_html = ""
        if "tags" in post:
            for tag in post["tags"]:
                tags_html += f'<span class="tag">{tag}</span>'
        posts_html += f"""
        <div class="blog-post">
            <h2 class="blog-post-title">{post['title']}</h2>
            <p class="blog-post-meta">{post['date']} by {post['author']}</p>
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

    print("Blog built successfully!")

if __name__ == "__main__":
    main()