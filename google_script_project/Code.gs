function doGet(e) {
  return HtmlService.createHtmlOutputFromFile('index');
}

function getServerResponse(message) {
  return "Hello from the server! You said: " + message;
}

function compressAndSaveData() {
  const sampleData = {
    "message": "This is some sample data to be compressed.",
    "timestamp": new Date().toISOString(),
    "data": [1, 2, 3, 4, 5]
  };

  const jsonString = JSON.stringify(sampleData);
  const textBlob = Utilities.newBlob(jsonString, 'application/json');
  const gzipBlob = Utilities.gzip(textBlob);

  // Note: This will save the file to the user's root Google Drive folder,
  // not directly into the script project's file system.
  const file = DriveApp.createFile(gzipBlob);
  file.setName('data.dat');

  return "Data compressed and saved to data.dat in your Google Drive.";
}

function readAndDecompressData() {
  const files = DriveApp.getFilesByName('data.dat');
  if (files.hasNext()) {
    const file = files.next();
    const blob = file.getBlob();
    const unzippedBlob = Utilities.unzip(blob);
    const jsonString = unzippedBlob.getDataAsString();
    const data = JSON.parse(jsonString);
    return data;
  } else {
    return "No data.dat file found in your Google Drive.";
  }
}
