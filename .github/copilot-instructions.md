# Copilot Instructions for majixai.github.io

## Repository Overview

This is a GitHub Pages repository containing a diverse collection of web applications, data scrapers, financial analysis tools, and static web pages. The repository serves as a portfolio of projects hosted at https://majixai.github.io.

**Repository Type:** Polyglot monorepo with multiple independent projects  
**Primary Languages:** Python, JavaScript, TypeScript, HTML/CSS  
**Frameworks:** Flask, Node.js, React/TypeScript (for some projects)  
**Target Platform:** GitHub Pages (static hosting) + various containerized services

## Project Structure

### Major Project Categories

1. **Web Applications** (in subdirectories):
   - `best/` - Chaturbate room viewer
   - `chat/` - Gemini Financial Modeling Chat
   - `hotel_booking_app/` - Offline-first hotel booking app
   - `jinx_strategy/`, `jinxcasino/` - AI Studio and casino apps
   - `nfl/` - Node.js app using Gemini API
   - `option/`, `options/` - Options trading analyzers
   - `stock_analyzer/` - TypeScript stock projection app
   - `texas_holdem/` - Python-based poker game

2. **Data Scrapers** (Python):
   - `bedpage_scraper/`, `craigslist_scraper/`, `stock_fetcher/`

3. **Simple Web Pages:** Many directories contain standalone HTML/CSS/JS pages

### Key Root Files

- `README.md` - Comprehensive project overview with clickable links
- `requirements.txt` - Python dependencies for root-level scripts
- `package.json` - Playwright test dependencies
- `Dockerfile`, `deploy.sh` - Docker deployment for Texas Hold'em
- `.github/workflows/` - 32 GitHub Actions workflows for various automation

## Technology Stack

### Python Projects
- **Version:** Python 3.x
- **Common Dependencies:** Flask, PyPDF2, fpdf
- **Package Manager:** pip
- **Virtual Environment:** Not consistently used across projects

### Node.js/TypeScript Projects
- **Versions:** Node.js 18.x, 20.x, 22.x (matrix testing in workflows)
- **Package Manager:** npm
- **TypeScript:** Used in `stock_analyzer/`, `jinxcasino/`, `jinx_strategy/`
- **Build Tool:** esbuild (for TypeScript projects)

### Testing
- **Python:** Some projects have pytest-based tests (e.g., `reit_company/tests/`, `holdem_app/tests/`)
- **JavaScript:** Limited test infrastructure; some projects have test files
- **E2E Testing:** Playwright is available (`package.json` in root)

## Build and Test Instructions

### Python Projects

**For individual Python projects:**
```bash
cd <project_directory>
pip install -r requirements.txt
python <main_script>.py
```

**Common patterns:**
- Flask apps: Usually have `app.py` or `run.py` as entry points
- Scripts: Can be run directly with `python <script_name>.py`
- No consistent testing framework - check for `tests/` directories

### Node.js/TypeScript Projects

**Standard build process (for projects with package.json):**
```bash
cd <project_directory>
npm install
npm run build  # If build script exists
```

**Example: NFL project (from workflows/nodejs.yml):**
```bash
cd nfl
npm install
npm run build
```

**TypeScript projects:**
- Use esbuild for bundling
- Config files: `tsconfig.json` in project directories
- Build outputs typically to `dist/` or similar

### Running Tests

**Python tests (where they exist):**
```bash
cd <project_directory>
python -m pytest tests/
```

**Note:** Not all projects have tests. Do not add new test infrastructure unless required.

## GitHub Actions Workflows

The repository has 32 automated workflows in `.github/workflows/`:

**Key workflows:**
- `nodejs.yml` - Node.js CI for NFL project (tests Node 18.x, 20.x, 22.x)
- `python_action.yml` - Basic Python action trigger
- `click-analytics.yml` - Daily report generation for click tracking
- `transaction_report.yml` - Daily Visa transaction report
- Various project-specific workflows

**Workflow patterns:**
- Path-based triggers (e.g., `paths: ['nfl/**']`)
- Run on push to `main` branch
- Some workflows are scheduled (cron)

## Important Conventions

### File Organization
- Each major project is self-contained in its own directory
- Root-level files are for deployment, documentation, or cross-cutting concerns
- `.gitignore` excludes common artifacts (node_modules, __pycache__, etc.)

### Integration Patterns
- **Analytics:** Uses Google Apps Script for click tracking (`redirect.html`, `redirect.js`)
- **Payments:** Mock Visa/Google Pay integration in `visa_api/`
- **File Integrity:** SHA-256 hash verification system in `integrity/`

### API Keys and Secrets
- Projects using Gemini API expect keys in environment variables or config
- Google Apps Script endpoints are used for backend services

## Common Issues and Workarounds

### Python Dependencies
- Projects may have conflicting dependency versions
- Install dependencies in project-specific virtual environments when conflicts arise

### Node.js Builds
- Always run `npm install` before building
- Some projects may need specific Node.js versions (check workflow files)

### Static Hosting
- This is a GitHub Pages repo; changes are deployed automatically
- Projects should be accessible at `https://majixai.github.io/<project_name>/`

## Validation Steps

Before finalizing changes:

1. **For Python changes:**
   - Run the script/application to ensure it works
   - Check for syntax errors: `python -m py_compile <file>.py`
   - Run existing tests if available

2. **For Node.js/TypeScript changes:**
   - Run `npm install` and `npm run build`
   - Verify build artifacts are created
   - Check for TypeScript errors: `npx tsc --noEmit` (if tsconfig exists)

3. **For workflow changes:**
   - Validate YAML syntax
   - Test path filters match intended files

4. **General:**
   - Ensure `.gitignore` excludes build artifacts
   - Verify no secrets or credentials are committed
   - Check that links in README.md still work if modified

## Key Documentation Files

- `README.md` - Master project list with descriptions
- `CLICK_ANALYTICS.md` - Generated click tracking report
- `visa_api/TRANSACTION_REPORT.md` - Generated transaction report
- `visa_api/README.md` - Payment integration details
- Individual project directories may have their own README files

## Code Review Checklist

When making changes:
- Minimize modifications - only change what's necessary
- Respect existing code style and conventions
- Do not fix unrelated bugs or broken tests
- Update documentation if directly related to changes
- Validate changes don't break existing behavior
- Run relevant linters and tests for modified code
- Use existing tools from the ecosystem (don't create helper scripts)

## Important Notes

- **Do not** create markdown files for planning or tracking unless explicitly requested
- **Do not** add new testing infrastructure unless necessary for the specific task
- **Use relative paths** from repository root with forward slashes (e.g., `project/file.py`)
- **Trust these instructions** - only search for additional information if instructions are incomplete or incorrect
