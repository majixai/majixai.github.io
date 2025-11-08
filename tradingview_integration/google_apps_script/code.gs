// This Google Apps Script demonstrates how to read data from a source file in the repository,
// compress it, and push it back to the repository as a .dat file.

// --- CONFIGURATION ---
// Replace with your GitHub username, repository name, and the paths to the data files.
var GITHUB_USERNAME = "your-username";
var GITHUB_REPO = "your-repository";
var SOURCE_CSV_PATH = "data/sample_data.csv"; // The source data file.
var DATA_FILE_PATH = "data/my_data.dat";     // The destination for the compressed data.


/**
 * Main function to be called to update the data file in the GitHub repository.
 * This function can be triggered manually, on a schedule, or via a web app.
 */
function updateDataFile() {
  // 1. Get the GitHub Personal Access Token (PAT) from Script Properties.
  //    DO NOT hardcode your token in the script.
  //    Go to "Project Settings" > "Script Properties" and add a new property:
  //    - Key: GITHUB_TOKEN
  //    - Value: your-github-personal-access-token
  var githubToken = PropertiesService.getScriptProperties().getProperty('GITHUB_TOKEN');
  if (!githubToken) {
    Logger.log("GITHUB_TOKEN not found in Script Properties. Please add it.");
    return;
  }

  // 2. Fetch the source CSV data from the repository.
  var sourceData = fetchSourceDataFromGitHub();
  if (!sourceData) {
    Logger.log("Could not fetch source CSV data. Aborting.");
    return;
  }

  // 3. Compress the source data.
  var compressedData = Utilities.gzip(Utilities.newBlob(sourceData));

  // 4. Push the compressed data to GitHub.
  pushToGitHub(githubToken, compressedData.getBytes());
}

/**
 * Fetches the content of the source CSV file from the GitHub repository.
 * Assumes the repository is public for simplicity.
 * @return {string} The content of the CSV file, or null if an error occurs.
 */
function fetchSourceDataFromGitHub() {
  // Note: This assumes the 'main' branch. You may need to change this to 'master' or another branch name.
  var csvUrl = "https://raw.githubusercontent.com/" + GITHUB_USERNAME + "/" + GITHUB_REPO + "/main/" + SOURCE_CSV_PATH;

  try {
    var response = UrlFetchApp.fetch(csvUrl);
    if (response.getResponseCode() === 200) {
      return response.getContentText();
    } else {
      Logger.log("Error fetching source file from GitHub. Status code: " + response.getResponseCode() + " URL: " + csvUrl);
      return null;
    }
  } catch (e) {
    Logger.log("Exception fetching source file: " + e);
    return null;
  }
}

/**
 * Pushes a file to a GitHub repository using the GitHub API.
 * This will create a new file or update an existing one.
 *
 * @param {string} token The GitHub Personal Access Token.
 * @param {byte[]} content The content of the file as a byte array.
 */
function pushToGitHub(token, content) {
  var apiUrl = "https://api.github.com/repos/" + GITHUB_USERNAME + "/" + GITHUB_REPO + "/contents/" + DATA_FILE_PATH;

  // First, try to get the file to see if it exists.
  // This is necessary to get the SHA of the file if we want to update it.
  var options = {
    method: "get",
    headers: {
      "Authorization": "token " + token,
      "Accept": "application/vnd.github.v3+json"
    },
    muteHttpExceptions: true // Important to handle the case where the file doesn't exist.
  };

  var response = UrlFetchApp.fetch(apiUrl, options);
  var responseCode = response.getResponseCode();
  var responseBody = response.getContentText();
  var sha = null;

  if (responseCode === 200) {
    // File exists, get its SHA.
    sha = JSON.parse(responseBody).sha;
  } else if (responseCode !== 404) {
    // An error occurred that was not "file not found".
    Logger.log("Error getting file from GitHub: " + responseBody);
    return;
  }

  // Create the payload to create/update the file.
  var payload = {
    message: "Automated data update",
    content: Utilities.base64Encode(content),
    sha: sha // If sha is null, this will create a new file. If it has a value, it will update the existing file.
  };

  var putOptions = {
    method: "put",
    headers: {
      "Authorization": "token " + token,
      "Accept": "application/vnd.github.v3+json"
    },
    contentType: "application/json",
    payload: JSON.stringify(payload)
  };

  var putResponse = UrlFetchApp.fetch(apiUrl, putOptions);
  Logger.log("GitHub API response: " + putResponse.getContentText());
}

/**
 * Creates a web app that can be triggered by an external service like GitHub Actions.
 * To trigger the update, you would send a GET request to the deployed web app URL.
 */
function doGet(e) {
  updateDataFile();
  return ContentService.createTextOutput("Data update process triggered.");
}
