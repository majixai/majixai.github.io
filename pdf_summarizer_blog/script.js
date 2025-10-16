// IIFE to encapsulate the script
(() => {
    // --- CONFIGURATION ---
    const POSTS_DIR = 'posts/';

    /**
     * Dynamically determines the GitHub repository URL from the window's location.
     * This is crucial for the upload feature to work when hosted on GitHub Pages.
     * @returns {string|null} The GitHub repository URL or null if it cannot be determined.
     */
    function getGithubRepoUrl() {
        const hostname = window.location.hostname;
        const pathParts = window.location.pathname.split('/').filter(part => part);

        // Standard GitHub Pages URL format: <username>.github.io/<repo-name>/...
        if (hostname.endsWith('github.io') && pathParts.length > 0) {
            const username = hostname.split('.')[0];
            const repoName = pathParts[0];
            return `https://github.com/${username}/${repoName}`;
        }

        // Local development environment (e.g., http://localhost:8000/)
        // In this case, the user must manually set the repository URL.
        console.warn('Could not automatically determine GitHub repo URL. Please set it manually for the upload feature to work in a local environment.');
        // You can return a default or placeholder for local testing.
        // return "https://github.com/your-username/your-repo-name";
        return null;
    }

    /**
     * @interface BlogPost
     * @property {string} title
     * @property {string} summary
     * @property {string} originalFileName
     * @property {string} uploadDate - ISO 8601 format
     */

    class Post {
        constructor(title, summary, originalFileName, uploadDate) {
            this.title = title;
            this.summary = summary;
            this.originalFileName = originalFileName;
            this.uploadDate = new Date(uploadDate);
        }
    }

    class BlogRenderer {
        constructor(containerId) {
            this.container = document.getElementById(containerId);
            if (!this.container) throw new Error(`Container with id "${containerId}" not found.`);
        }

        render(posts) {
            this.container.innerHTML = '';
            if (posts.length === 0) {
                this.container.innerHTML = '<p class="w3-center">No blog posts yet. Upload a PDF to get started!</p>';
                return;
            }
            posts.sort((a, b) => b.uploadDate - a.uploadDate);
            posts.forEach(post => {
                const postElement = document.createElement('div');
                postElement.classList.add('w3-card-4', 'w3-margin', 'w3-white');
                postElement.innerHTML = `
                    <div class="w3-container">
                        <h3><b>${post.title}</b></h3>
                        <h5>${post.originalFileName}, <span class="w3-opacity">${post.uploadDate.toLocaleDateString()}</span></h5>
                    </div>
                    <div class="w3-container">
                        <p>${post.summary}</p>
                        <div class="w3-row">
                            <div class="w3-col m8 s12"><p><button class="w3-button w3-padding-large w3-white w3-border"><b>READ MORE »</b></button></p></div>
                        </div>
                    </div>`;
                this.container.appendChild(postElement);
            });
        }
    }

    class PDFUploader {
        constructor(modalId, formSelector) {
            this.modal = document.getElementById(modalId);
            this.form = document.querySelector(formSelector);
            this.githubRepoUrl = getGithubRepoUrl();
            this.init();
        }

        init() {
            this.form.addEventListener('submit', this.handleSubmit.bind(this));
            const closeButton = this.modal.querySelector('.w3-display-topright');
            if(closeButton) closeButton.addEventListener('click', () => this.hideModal());
            const cancelButton = this.modal.querySelector('.w3-red');
            if(cancelButton) cancelButton.addEventListener('click', () => this.hideModal());
        }

        fileToBase64(file) {
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.readAsDataURL(file);
                reader.onload = () => resolve(reader.result.split(',')[1]);
                reader.onerror = error => reject(error);
            });
        }

        async handleSubmit(event) {
            event.preventDefault();

            if (!this.githubRepoUrl) {
                alert('Could not determine the GitHub repository URL. The upload feature is disabled. Please run this from a GitHub Pages URL or configure the URL manually.');
                return;
            }

            const fileInput = this.form.querySelector('input[type="file"]');
            const file = fileInput.files[0];

            if (file) {
                if (file.type !== 'application/pdf') {
                    alert('Please select a valid PDF file.');
                    return;
                }

                try {
                    const base64String = await this.fileToBase64(file);
                    const issueTitle = `PDF Upload: ${file.name}`;
                    const issueBody = `
<!-- PDF UPLOAD DATA - DO NOT EDIT -->
<details>
  <summary>Base64 Encoded PDF</summary>

  \`\`\`
  ${base64String}
  \`\`\`

  **Filename:** \`${file.name}\`
</details>
`;

                    const issueUrl = `${this.githubRepoUrl}/issues/new?title=${encodeURIComponent(issueTitle)}&body=${encodeURIComponent(issueBody)}`;

                    window.open(issueUrl, '_blank');

                    this.hideModal();
                    this.form.reset();
                    alert('Your PDF is ready to be uploaded. Please complete the submission in the new tab that just opened.');

                } catch (error) {
                    console.error('Error processing file:', error);
                    alert('An error occurred while preparing your file for upload.');
                }
            } else {
                alert("Please select a file.");
            }
        }

        showModal() {
            this.modal.style.display = 'block';
        }

        hideModal() {
            this.modal.style.display = 'none';
        }
    }

    class App {
        constructor() {
            this.posts = [];
            this.blogRenderer = new BlogRenderer('blog-posts');
            this.pdfUploader = new PDFUploader('uploadModal', '#uploadModal form');
            window.pdfUploader = this.pdfUploader;
            this.loadPosts();
        }

        async loadPosts() {
            try {
                const manifestResponse = await fetch(`${POSTS_DIR}posts.json?cachebust=${new Date().getTime()}`);
                if (!manifestResponse.ok) {
                    if (manifestResponse.status === 404) {
                        console.log("posts.json not found. Assuming no posts yet.");
                        this.render();
                        return;
                    }
                    throw new Error(`Failed to load posts manifest: ${manifestResponse.statusText}`);
                }
                const manifest = await manifestResponse.json();

                const postPromises = manifest.files.map(async (filename) => {
                    const response = await fetch(`${POSTS_DIR}${filename}`);
                    if (!response.ok) {
                        console.error(`Failed to fetch post: ${filename}`);
                        return null;
                    }
                    const compressedData = await response.arrayBuffer();
                    const decompressedData = pako.inflate(new Uint8Array(compressedData), { to: 'string' });
                    const postData = JSON.parse(decompressedData);
                    return new Post(postData.title, postData.summary, postData.originalFileName, postData.uploadDate);
                });

                this.posts = (await Promise.all(postPromises)).filter(p => p !== null);
                this.render();

            } catch (error) {
                console.error("Error loading posts:", error);
                this.blogRenderer.render([]);
            }
        }

        render() {
            this.blogRenderer.render(this.posts);
        }
    }

    document.addEventListener('DOMContentLoaded', () => {
        new App();
    });

})();