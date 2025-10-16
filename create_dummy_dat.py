import json
import zlib
from datetime import datetime

post_data = {
    "title": "Example Post from Dat file",
    "summary": "This is a summary that has been loaded from a compressed .dat file. This demonstrates that the frontend can correctly fetch, decompress, and parse the blog post data.",
    "originalFileName": "dummy.pdf",
    "uploadDate": datetime.utcnow().isoformat()
}

# Compress and write the data
compressed_data = zlib.compress(json.dumps(post_data).encode('utf-8'))
with open('pdf_summarizer_blog/posts/example.dat', 'wb') as df:
    df.write(compressed_data)

print("dummy .dat file created successfully.")