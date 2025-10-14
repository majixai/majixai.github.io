import sqlite3

conn = sqlite3.connect('blog.db')
c = conn.cursor()
c.execute("SELECT * FROM posts WHERE title = 'dummy2'")
posts = c.fetchall()
conn.close()

if posts:
    print("Test passed: Found 'dummy2' in the database.")
    for post in posts:
        print(post)
else:
    print("Test failed: Did not find 'dummy2' in the database.")