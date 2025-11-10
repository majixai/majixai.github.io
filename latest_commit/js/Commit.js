/**
 * @typedef {object} CommitAuthor
 * @property {string} name
 * @property {string} email
 * @property {Date} date
 */

/**
 * @typedef {object} CommitData
 * @property {CommitAuthor} author
 * @property {string} message
 * @property {string} sha
 * @property {string} url
 * @property {Array<string>} affectedDirectories
 */

/**
 * Represents a single commit, including processed information about changed files.
 * This class maps the raw detailed commit data from the GitHub API to a structured object.
 * @implements {CommitData}
 */
class Commit {
    /**
     * @param {object} commitData - The raw, detailed commit data from the GitHub API.
     */
    constructor({ sha, commit, html_url, files }) {
        /** @type {string} */
        this.sha = sha;

        /** @type {string} */
        this.message = commit.message;

        /** @type {string} */
        this.url = html_url;

        /** @type {CommitAuthor} */
        this.author = {
            name: commit.author.name,
            email: commit.author.email,
            date: new Date(commit.author.date),
        };

        /** @type {Array<string>} */
        this.affectedDirectories = this.#extractDirectories(files);
    }

    /**
     * Extracts unique, top-level directory names from a list of changed files.
     * @private
     * @param {Array<{filename: string}>} files - The list of files from the commit details.
     * @returns {Array<string>} An array of unique directory names.
     */
    #extractDirectories(files) {
        if (!files) return [];
        const directories = new Set();
        files.forEach(file => {
            const pathParts = file.filename.split('/');
            // Only consider files that are in a directory
            if (pathParts.length > 1) {
                directories.add(pathParts[0]);
            }
        });
        return Array.from(directories);
    }

    /**
     * A static factory method for creating an array of Commit instances from detailed API data.
     * @param {Array<object>} apiData - An array of raw, detailed commit data.
     * @returns {Array<Commit>} An array of Commit instances.
     */
    static fromApiData(apiData) {
        return apiData.map(data => new Commit(data));
    }
}
