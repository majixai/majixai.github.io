// Assuming React is available globally e.g. via CDN
// Types are for JSDoc
// import { GitHubExportSettings } from '../types.js';
import { ClearIcon, ExportIcon, DatabaseIcon } from '../constants.js'; // Assuming .js
import { InputField } from './SharedControls.js'; // Assuming .js

/**
 * @typedef {import('../types.js').GitHubExportSettings} GitHubExportSettings
 */

/**
 * @typedef {Object} DataManagementPanelProps
 * @property {GitHubExportSettings} githubSettings
 * @property {(field: keyof GitHubExportSettings, value: string) => void} onGitHubSettingsChange
 * @property {() => Promise<void>} onExportData
 * @property {() => void} onClearForm
 * @property {boolean} anyAppLoading
 * @property {boolean} isExporting
 */

/**
 * @param {DataManagementPanelProps} props
 * @returns {React.ReactElement}
 */
const DataManagementPanel = ({
    githubSettings, onGitHubSettingsChange, onExportData, onClearForm, anyAppLoading, isExporting
}) => {
    if (typeof React === 'undefined') {
        console.error("React is not loaded. DataManagementPanel component cannot render.");
        return null;
    }

    return React.createElement(
        React.Fragment,
        null,
        React.createElement('h3', { className: "text-lg font-semibold text-[#00407A] mb-3" }, "Data Management"),
        React.createElement(
            'button',
            {
                onClick: onClearForm,
                disabled: anyAppLoading,
                className: "w-full flex items-center justify-center bg-red-500 hover:bg-red-600 text-white text-sm font-medium py-2 px-3 rounded-md shadow-sm disabled:opacity-50 transition-all mb-6"
            },
            React.createElement(ClearIcon, null), " Clear All Data & Reset Form"
        ),
        React.createElement(
            'div',
            { className: "mt-4" },
            React.createElement('h4', { className: "text-md font-semibold text-[#00539B] mb-2" }, "GitHub Export Settings (Simulated)"),
            React.createElement(InputField, {
                label: "Personal Access Token (PAT)",
                id: "githubPat",
                type: "password",
                value: githubSettings.pat,
                onChange: e => onGitHubSettingsChange('pat', e.target.value),
                placeholder: "ghp_YourTokenHere",
                disabled: anyAppLoading || isExporting
            }),
            React.createElement(InputField, {
                label: "GitHub Username",
                id: "githubUsername",
                value: githubSettings.username,
                onChange: e => onGitHubSettingsChange('username', e.target.value),
                placeholder: "your-github-username",
                disabled: anyAppLoading || isExporting
            }),
            React.createElement(InputField, {
                label: "Repository Name",
                id: "githubRepoName",
                value: githubSettings.repoName,
                onChange: e => onGitHubSettingsChange('repoName', e.target.value),
                placeholder: "your-repo-name",
                disabled: anyAppLoading || isExporting
            }),
            React.createElement(InputField, {
                label: "File Path in Repo",
                id: "githubFilePath",
                value: githubSettings.filePath,
                onChange: e => onGitHubSettingsChange('filePath', e.target.value),
                placeholder: "path/to/your/config.json",
                disabled: anyAppLoading || isExporting
            }),
            React.createElement(
                'button',
                {
                    onClick: onExportData,
                    disabled: anyAppLoading || isExporting || !githubSettings.pat || !githubSettings.username || !githubSettings.repoName,
                    className: "mt-3 w-full flex items-center justify-center bg-gray-600 hover:bg-gray-700 text-white text-sm font-medium py-2 px-3 rounded-md shadow-sm disabled:opacity-50 transition-all"
                },
                isExporting ? React.createElement('span', { className: "animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" }) : React.createElement(ExportIcon, null),
                isExporting ? 'Exporting...' : 'Export Data to GitHub (Simulated)'
            )
        )
    );
};

export default DataManagementPanel;
