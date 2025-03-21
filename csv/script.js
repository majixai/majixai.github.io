// This JavaScript code is designed to be included within the provided HTML file (index.html)
// and modifies the existing functionality to upload the *content* of CSV files to
// Local Storage rather than just relying on pre-existing files in the directory.

// --- Add this code within the <script> tags of index.html ---
// --- The existing code in index.html is assumed to be present ---

// --- New Global Variable to track uploaded files ---
let uploadedFiles = {};

// --- Modified Functions ---

// **1. Modify `populateCsvDropdown()`**
//    - Now checks for CSV files in local storage.
//    - Prioritizes files from local storage over the directory.
async function populateCsvDropdown() {
    const csvSelect = document.getElementById('csv-select');
    csvSelect.innerHTML = '<option value="">-- Select a CSV File --</option>';

    // First, check local storage for CSV files
    const storedCsvFiles = getCsvFilesFromLocalStorage();
    if (storedCsvFiles.length > 0) {
        storedCsvFiles.forEach(filename => {
            const optionElement = document.createElement('option');
            optionElement.value = `local:${filename}`; // Indicate it's from local storage
            optionElement.textContent = `${filename} (Local Storage)`;
            csvSelect.appendChild(optionElement);
        });
    }

    // Next, look at the ticker list for other potential options (if any)
    const tickersText = localStorage.getItem('tickerList');
    if (tickersText) {
        const tickers = tickersText.split(',').map(ticker => ticker.trim()).filter(ticker => ticker);
        const dataOptions = [
            { interval: '1m', period: '5d' },
            { interval: '1h', period: '5d' },
            { interval: '1d', period: '1y' }
        ];

        tickers.forEach(ticker => {
            dataOptions.forEach(option => {
                const filename = `${ticker}_${option.interval}_${option.period}.csv`;
                 //Check if it is already stored in local storage
                if(!storedCsvFiles.includes(filename)){
                    const displayInterval = option.interval;
                    const displayPeriod = option.period;
                    const optionElement = document.createElement('option');
                    optionElement.value = filename;
                    optionElement.textContent = `${ticker} - ${displayInterval} Interval, ${displayPeriod} Period`;
                    csvSelect.appendChild(optionElement);
                }

            });
        });
    }

    // Add upload option last
    const uploadOption = document.createElement('option');
    uploadOption.value = 'upload';
    uploadOption.textContent = 'Upload a New CSV File';
    csvSelect.appendChild(uploadOption);
}

// **2. Modified `loadAndAnalyzeData()`**
//    - Now handles both local storage and direct directory files.
async function loadAndAnalyzeData() {
    const csvSelect = document.getElementById('csv-select');
    const csvFileValue = csvSelect.value;
    let csvData = null;

    if (!csvFileValue) {
        alert("Please select a CSV file.");
        return;
    }

    document.getElementById('calculations-output').textContent = "Loading and processing data...";
    document.getElementById('prediction-output').textContent = "Analyzing data for prediction...";
    document.getElementById('price-chart').innerHTML = "Loading chart...";
    document.getElementById('gemini-output').textContent = "";

    try {
        if (csvFileValue.startsWith('local:')) {
            // Load from local storage
            const filename = csvFileValue.substring(6);
            csvData = localStorage.getItem(filename);
            if(!csvData){
                throw new Error("Error: File not found in local storage.");
            }
        } else if (csvFileValue === 'upload'){
             //add file uploader here:
            await promptForCsvUpload();
            return; //Stop the rest of the function and let the file upload call loadAndAnalyzeData again.
        }
        else {
            // Load from directory (original behavior)
            csvData = await fetchAndReturnCSV(csvFileValue);
        }
        if (!csvData || csvData.length === 0) {
            document.getElementById('calculations-output').textContent = "Error loading or parsing CSV data. Ensure the CSV file named: " + csvFileValue + " is in the same directory or that it is uploaded to local storage.";
            document.getElementById('prediction-output').textContent = "Prediction unavailable due to data error.";
            document.getElementById('price-chart').innerHTML = "Error loading data for chart.";
            return;
        }

        parsedData = parseCSVData(csvData);
        if (!parsedData || parsedData.length === 0) {
            document.getElementById('calculations-output').textContent = "Error processing CSV data.";
            document.getElementById('prediction-output').textContent = "Prediction unavailable due to data error.";
            document.getElementById('price-chart').innerHTML = "Error processing data for chart.";
            return;
        }

        displayIndicatorCalculations(parsedData);
        displayPrediction(parsedData);
        plotData(parsedData);
        document.getElementById('calculations-output').style.display = 'none';

    } catch (error) {
        console.error("Error:", error);
        document.getElementById('calculations-output').textContent = "An error occurred: " + error.message;
        document.getElementById('prediction-output').textContent = "Prediction unavailable due to error.";
        document.getElementById('price-chart').innerHTML = "Error generating chart.";
    }
}
//**3. New function for file upload.**/
async function promptForCsvUpload() {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.csv';
    input.multiple = false; // for now only allow 1 at a time.
    input.onchange = async (event) => {
      const file = event.target.files[0];
      if (!file) {
        alert('No file selected.');
        resolve(); // Resolve to continue normal operation if no file.
        return;
      }
      if (!file.name.endsWith('.csv')) {
        alert('Only CSV files are supported.');
        resolve();// Resolve to continue normal operation if not csv.
        return;
      }

      const reader = new FileReader();
      reader.onload = async (e) => {
        const content = e.target.result;

        if (localStorage.getItem(file.name)) {
            if (!confirm(`A file named "${file.name}" already exists. Do you want to replace it?`)) {
              alert(`Upload of ${file.name} skipped (file already exists).`);
              populateCsvDropdown(); //refresh the options
              resolve();// Resolve to continue normal operation if file already exists.
              return;
            }
        }

        localStorage.setItem(file.name, content);
        alert(`File ${file.name} uploaded successfully to local storage.`);
        uploadedFiles[file.name] = content; // Store content in uploadedFiles
        populateCsvDropdown();//refresh the options
        resolve(loadAndAnalyzeData()); // After upload, call loadAndAnalyzeData again
      };
      reader.onerror = (error) => {
        alert(`Error uploading file ${file.name}: ${error}`);
        resolve(); // Resolve to continue normal operation if error.
      };
      reader.readAsText(file);
    };
    input.click();
  });
}
// **4. New Helper Function `getCsvFilesFromLocalStorage()`**
//    - Extracts a list of CSV filenames from Local Storage.
function getCsvFilesFromLocalStorage() {
    const csvFiles = [];
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key.endsWith('.csv')) {
            csvFiles.push(key);
        }
    }
    return csvFiles;
}

// **5. Modify the `initializePage()`**
//    - now automatically populates the dropdown even if the local storage is empty.
function initializePage() {
    // Check if tickerList exists in localStorage
    let tickersText = localStorage.getItem('tickerList');
    if (!tickersText) {
        // Default ticker list if not found in localStorage
        tickersText = "AAPL,MSFT,GOOGL,GOOG,AMZN,NVDA,TSLA,META,BRK.B,JPM,V,JNJ,UNH,PG,XOM,HD,CVX,MA,ABBV,MRK,PEP,KO,COST,CRM,ADBE,NFLX,DIS,WMT,BAC,PFE,TMO,LLY,DHR,LIN,UNP,RTX,MCD,CAT,DOW,IBM,AMD,MMM,AMGN,TXN,GILD,CSCO,INTC,CMCSA,WFC,UPS,MS,GS,NKE,ORCL,T,VZ,CRM,ABT,COP,PM,MDT,HON,LOW,SBUX,C,SPGI,ISRG,ADP,TJX,BKNG,CME,CVS,DG,FDX,GM,HCA,LMT,MO,MSFT,MU,OXY,PYPL,RTX,SCHW,SHOP,SNAP,SO,TGT,UNP,USB,VRTX,WBA,XOM,X,ZM,Z,ZBRA,ZBH,ZTS";
        localStorage.setItem('tickerList', tickersText); // Save default to localStorage
        document.getElementById('ticker-list-textarea').value = tickersText; // Populate textarea too
        document.getElementById('ticker-storage-output').textContent = "Default ticker list loaded and saved to local storage.";
    } else {
        document.getElementById('ticker-list-textarea').value = tickersText; // Ensure textarea is populated on load if list exists
    }
    populateCsvDropdown(); // Finally, populate the dropdown
    displayUploadedFiles(); // Finally, populate the file listing.
}

// --- End of Added Code ---
// Helper function to update the status message
function updateStatus(message, type = 'info') {
  const statusDiv = document.getElementById('file-storage-status');
  const statusMessage = document.createElement('p');
  statusMessage.textContent = message;
  statusMessage.classList.add(`status-${type}`);
  statusDiv.appendChild(statusMessage);
  // add style in head in html file:
  /*
  <style>
    .status-success { color: green; }
    .status-warning { color: orange; }
    .status-error { color: red; }
    .status-info { color: blue; }
  </style>
  */
}

// Function to display a list of uploaded files
function displayUploadedFiles() {
  const fileListDiv = document.getElementById('uploaded-files-list');
  fileListDiv.innerHTML = ''; // Clear previous list
  const fileNames = Object.keys(localStorage).filter(key => key.endsWith('.csv'));

  if (fileNames.length === 0) {
    updateStatus('No CSV files have been uploaded yet.', 'info');
    return;
  }

  const fileList = document.createElement('ul');
  fileNames.forEach(filename => {
    const listItem = document.createElement('li');
    listItem.textContent = filename;

    // Add a delete button for each file
    const deleteButton = document.createElement('button');
    deleteButton.textContent = 'Delete';
    deleteButton.addEventListener('click', () => deleteFile(filename));
    listItem.appendChild(deleteButton);
    fileList.appendChild(listItem);
  });
  fileListDiv.appendChild(fileList);
}

// Function to delete a file from Local Storage
function deleteFile(filename) {
  if (confirm(`Are you sure you want to delete ${filename}?`)) {
    localStorage.removeItem(filename);
    updateStatus(`File ${filename} deleted.`, 'success');
    displayUploadedFiles(); // Refresh the list
    populateCsvDropdown(); //Refresh the dropdown list
  }
}

// Function to clear all uploaded files
function clearAllUploadedFiles() {
  if (confirm("Are you sure you want to delete ALL uploaded CSV files?")) {
    const csvFiles = Object.keys(localStorage).filter(key => key.endsWith('.csv'));
    csvFiles.forEach(filename => localStorage.removeItem(filename));
    updateStatus('All CSV files deleted.', 'success');
    displayUploadedFiles(); // Refresh the list
    populateCsvDropdown(); //Refresh the dropdown list
  }
}

//Display the Gemini API output.
function getGeminiAnalysis(){
   //dummy function for now:
    document.getElementById('gemini-output').textContent = "Gemini API analysis will be displayed here. This is a placeholder for Gemini API call functionality.";
}
// --- End of Added Code ---
// Helper function to update the status message
function updateStatus(message, type = 'info') {
  const statusDiv = document.getElementById('file-storage-status');
  const statusMessage = document.createElement('p');
  statusMessage.textContent = message;
  statusMessage.classList.add(`status-${type}`);
  statusDiv.appendChild(statusMessage);
  // add style in head in html file:
  /*
  <style>
    .status-success { color: green; }
    .status-warning { color: orange; }
    .status-error { color: red; }
    .status-info { color: blue; }
  </style>
  */
}

//Function to fetch the csv file from the directory and return its contents.
async function fetchAndReturnCSV(filename) {
        try {
            const response = await fetch(filename);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return await response.text();
        } catch (error) {
            console.error("Error fetching CSV:", error);
            return null;
        }
    }
// Simplified Black-Scholes function (for demonstration)
function blackScholesSimplified(spotPrice, strikePrice, riskFreeRate, timeToExpiry, volatility) {
        const d1 = (Math.log(spotPrice / strikePrice) + (riskFreeRate + 0.5 * volatility ** 2) * timeToExpiry) / (volatility * Math.sqrt(timeToExpiry));
        const d2 = d1 - volatility * Math.sqrt(timeToExpiry);

        const normCDF = (x) => {
          return 0.5 + 0.5 * erf(x / Math.sqrt(2));
        };
        const erf = (x) => {
            const a1 = 0.254829592;
            const a2 = -0.284496736;
            const a3 = 1.421413741;
            const a4 = -1.453152027;
            const a5 = 1.061405429;
            const p = 0.3275911;

            const sign = x < 0 ? -1 : 1;
            x = Math.abs(x);

            const t = 1 / (1 + p * x);
            const y = 1 - ((((a5 * t + a4) * t) + a3) * t + a2) * t + a1 * t * Math.exp(-x * x);
            return sign * y;
        };
        const callPrice = spotPrice * normCDF(d1) - strikePrice * Math.exp(-riskFreeRate * timeToExpiry) * normCDF(d2);
        return callPrice;
    }