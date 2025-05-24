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

## Running the Application

After building the project, you can open the `index.html` file in your browser. For a better experience, serve the `stock_analyzer` directory using a local web server. Many simple HTTP servers are available, for example, `serve` (which you can install via `npm install -g serve` and then run `serve .` from within the `stock_analyzer` directory).

The application expects `index.html`, `dist/bundle.js`, and `sw.js` to be served from the same root.

## GitHub Actions

A CI workflow is set up in `.github/workflows/ci.yml`. It will:
- Install dependencies.
- Run type checks.
- Build the project.
- Upload the build output (`dist` directory) as an artifact named `stock-analyzer-build`.
