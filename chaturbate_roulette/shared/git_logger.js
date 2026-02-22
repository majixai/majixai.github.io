// --- Git Logger Module ---
// Git-as-a-Database logging with Gzip-compressed .dat files
// Records are committed as versioned objects via the GitHub Contents API.
// The PAT must be provided via the GITHUB_PAT environment variable.

const zlib = typeof require !== 'undefined' ? require('zlib') : null;

/**
 * Default Git logger configuration.
 * @returns {Object} Logger config
 */
function getDefaultLoggerConfig() {
    return {
        owner: '',
        repo: '',
        branch: 'main',
        basePath: 'roulette_logs',
        // GITHUB_PAT is read from the environment at call time – never hardcoded.
        commitAuthor: {
            name: 'roulette-bot',
            email: 'roulette-bot@users.noreply.github.com'
        }
    };
}

/**
 * Read the GitHub PAT from the environment.
 * @returns {string} The personal access token
 * @throws {Error} If the token is not set
 */
function getToken() {
    const token = typeof process !== 'undefined' && process.env
        ? process.env.GITHUB_PAT
        : undefined;
    if (!token) {
        throw new Error(
            'GITHUB_PAT environment variable is not set. ' +
            'Please export GITHUB_PAT before using git_logger.'
        );
    }
    return token;
}

// ─── Gzip helpers ────────────────────────────────────────────────────────────

/**
 * Gzip-compress a UTF-8 string and return a Base64 representation.
 * @param {string} data - Raw string data
 * @returns {Promise<string>} Base64-encoded gzipped bytes
 */
function compressToBase64(data) {
    return new Promise((resolve, reject) => {
        if (!zlib) {
            return reject(new Error('zlib is not available in this environment'));
        }
        zlib.gzip(Buffer.from(data, 'utf8'), (err, buf) => {
            if (err) return reject(err);
            resolve(buf.toString('base64'));
        });
    });
}

/**
 * Decompress a Base64-encoded gzipped payload back to a UTF-8 string.
 * @param {string} base64Data - Base64-encoded gzipped bytes
 * @returns {Promise<string>} Original UTF-8 string
 */
function decompressFromBase64(base64Data) {
    return new Promise((resolve, reject) => {
        if (!zlib) {
            return reject(new Error('zlib is not available in this environment'));
        }
        zlib.gunzip(Buffer.from(base64Data, 'base64'), (err, buf) => {
            if (err) return reject(err);
            resolve(buf.toString('utf8'));
        });
    });
}

// ─── GitHub Contents API helpers ─────────────────────────────────────────────

/**
 * Build the API URL for a file in the repository.
 * @param {Object} config - Logger config
 * @param {string} filePath - Relative path inside the repo
 * @returns {string} Full GitHub API URL
 */
function buildApiUrl(config, filePath) {
    return `https://api.github.com/repos/${config.owner}/${config.repo}/contents/${filePath}`;
}

/**
 * Read a .dat file from GitHub, auto-decompress, and return parsed JSON.
 * @param {Object} config - Logger config
 * @param {string} filePath - Path to .dat file (relative to repo root)
 * @returns {Promise<Object|null>} Parsed data or null when the file does not exist
 */
async function readDatFile(config, filePath) {
    const token = getToken();
    const url = buildApiUrl(config, filePath) + `?ref=${config.branch}`;

    const response = await fetch(url, {
        headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/vnd.github.v3+json',
            'X-GitHub-Api-Version': '2022-11-28'
        }
    });

    if (response.status === 404) {
        return null;
    }

    if (!response.ok) {
        const body = await response.text();
        throw new Error(`GitHub API error ${response.status}: ${body}`);
    }

    const json = await response.json();
    // json.content is Base64-encoded; for .dat files it holds gzipped bytes.
    const rawContent = json.content.replace(/\n/g, '');
    const decompressed = await decompressFromBase64(rawContent);
    return { data: JSON.parse(decompressed), sha: json.sha };
}

/**
 * Write (create or update) a .dat file on GitHub with Gzip compression.
 * Data is JSON-stringified → Gzip-compressed → Base64-encoded before commit.
 * @param {Object} config - Logger config
 * @param {string} filePath - Destination path (should end in .dat)
 * @param {Object} data - Payload to store
 * @param {string} commitMessage - Git commit message
 * @param {string|null} sha - SHA of the existing blob (null for new files)
 * @returns {Promise<Object>} GitHub API response JSON
 */
async function writeDatFile(config, filePath, data, commitMessage, sha) {
    const token = getToken();
    const url = buildApiUrl(config, filePath);

    const compressed = await compressToBase64(JSON.stringify(data));

    const body = {
        message: commitMessage,
        content: compressed,
        branch: config.branch,
        committer: config.commitAuthor
    };
    if (sha) {
        body.sha = sha;
    }

    const response = await fetch(url, {
        method: 'PUT',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/vnd.github.v3+json',
            'Content-Type': 'application/json',
            'X-GitHub-Api-Version': '2022-11-28'
        },
        body: JSON.stringify(body)
    });

    if (!response.ok) {
        const errBody = await response.text();
        throw new Error(`GitHub API error ${response.status}: ${errBody}`);
    }

    return response.json();
}

// ─── High-level logging API ──────────────────────────────────────────────────

/**
 * Append a record to a .dat log file stored on GitHub.
 * The log is an array of objects; each call appends one entry and commits.
 * @param {Object} config - Logger config
 * @param {string} logName - Logical log name (e.g. 'spins', 'ledger')
 * @param {Object} record - Record to append
 * @returns {Promise<Object>} Commit result
 */
async function appendLog(config, logName, record) {
    const filePath = `${config.basePath}/${logName}.dat`;
    let existing = null;

    try {
        existing = await readDatFile(config, filePath);
    } catch (e) {
        console.error(`[git_logger] Error reading ${filePath}:`, e.message);
    }

    const entries = existing ? existing.data : [];
    if (!Array.isArray(entries)) {
        throw new Error(`Expected array in ${filePath}, got ${typeof entries}`);
    }

    entries.push({ ...record, _ts: new Date().toISOString() });

    const sha = existing ? existing.sha : null;
    const message = `log(${logName}): ${record._action || 'append'} at ${new Date().toISOString()}`;
    return writeDatFile(config, filePath, entries, message, sha);
}

/**
 * Write a full snapshot (e.g. tracking data) to a .dat file on GitHub.
 * @param {Object} config - Logger config
 * @param {string} snapshotName - File name without extension
 * @param {Object} data - Complete data payload
 * @returns {Promise<Object>} Commit result
 */
async function writeSnapshot(config, snapshotName, data) {
    const filePath = `${config.basePath}/${snapshotName}.dat`;
    let sha = null;

    try {
        const existing = await readDatFile(config, filePath);
        if (existing) {
            sha = existing.sha;
        }
    } catch (e) {
        // File does not exist yet – will create.
    }

    const message = `snapshot(${snapshotName}): updated at ${new Date().toISOString()}`;
    return writeDatFile(config, filePath, data, message, sha);
}

/**
 * Read a snapshot .dat file from GitHub (auto-decompresses).
 * @param {Object} config - Logger config
 * @param {string} snapshotName - File name without extension
 * @returns {Promise<Object|null>} Parsed data or null
 */
async function readSnapshot(config, snapshotName) {
    const filePath = `${config.basePath}/${snapshotName}.dat`;
    try {
        const result = await readDatFile(config, filePath);
        return result ? result.data : null;
    } catch (e) {
        console.error(`[git_logger] Error reading snapshot ${snapshotName}:`, e.message);
        return null;
    }
}

// ─── Exports ─────────────────────────────────────────────────────────────────

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        getDefaultLoggerConfig,
        getToken,
        compressToBase64,
        decompressFromBase64,
        readDatFile,
        writeDatFile,
        appendLog,
        writeSnapshot,
        readSnapshot
    };
}
