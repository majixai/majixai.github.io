# Stock Projection Analyzer

This application provides stock projection analysis.

## Development Setup

1.  **Navigate to the application directory:**
    ```bash
    cd stock_analyzer
    ```

2.  **Install dependencies:**
    Make sure you have Node.js and npm installed.
    ```bash
    npm install
    ```

## Available Scripts

*   **Type Check:**
    Run TypeScript compiler to check for type errors.
    ```bash
    npm run typecheck
    ```

*   **Build Project:**
    Compile and bundle the `index.tsx` file using `esbuild`. The output will be in the `dist` directory (e.g., `dist/bundle.js`).
    ```bash
    npm run build
    ```

## Running the Application Locally

After building the project (`npm run build`), the necessary files will be in the `dist` directory. To run locally:
1.  Ensure `index.html`, `index.css`, `sw.js`, and `manifest.json` are in the same root directory as the `dist` folder. (The GitHub action prepares this structure for deployment).
2.  Serve the root directory (e.g., `stock_analyzer` if you manually copied `dist` contents, or the root of the downloaded artifact) using a local web server. For example, using `serve`:
    ```bash
    # If you have 'serve' installed globally
    serve .
    ```
    Then open `index.html` in your browser.

## Deployment to GitHub Pages

This application is automatically built and deployed to GitHub Pages when changes are pushed to the `main` branch.

You should be able to access the live application at a URL similar to:
`https://<your-github-username>.github.io/<your-repository-name>/`

*(Note: You may need to configure the correct path in your repository settings if you are deploying a sub-directory or if your repository serves multiple projects.)*

## GitHub Actions Workflow

The CI/CD workflow is defined in `.github/workflows/ci.yml`. It performs the following key steps:
- Installs dependencies.
- Runs type checks.
- Builds the project.
- Prepares a runnable package (including `index.html`, `css`, `sw.js`, `manifest.json`, and the `dist` build output).
- Uploads this package as an artifact for GitHub Pages deployment.
- Deploys the application to GitHub Pages.

The artifact uploaded for GitHub Pages (typically named `github-pages`) can also be downloaded from the workflow run summary if you need a packaged version of the application.
