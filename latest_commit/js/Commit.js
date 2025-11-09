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
 */

/**
 * Represents a single commit.
 * This class maps the raw commit data from the GitHub API to a structured object.
 * @implements {CommitData}
 */
class Commit {
    /**
     * @param {object} commitData - The raw commit data from the GitHub API.
     */
    constructor({ sha, commit, html_url }) {
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
    }

    /**
     * A static factory method for creating an array of Commit instances.
     * @param {Array<object>} apiData - An array of raw commit data from the GitHub API.
     * @returns {Array<Commit>} An array of Commit instances.
     */
    static fromApiData(apiData) {
        return apiData.map(data => new Commit(data));
    }
}
