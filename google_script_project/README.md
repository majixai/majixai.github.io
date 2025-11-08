# Google Apps Script Project

This project is a web app built with Google Apps Script. It demonstrates two key features:

1.  **Client-Server Communication:** The web app can send messages to the server-side Google Apps Script and receive responses.
2.  **GZIP Compression:** The web app can compress and save data to a `.dat` file in the user's Google Drive, and then read and decompress the data from that file.

## How to Use

1.  **Deploy the script as a web app.**
2.  **Open the web app in your browser.**
3.  **Client-Server Communication:**
    *   Click the "Call Server" button to send a message to the server.
    *   The server will respond with a message, which will be displayed on the page.
4.  **GZIP Compression:**
    *   Click the "Compress and Save Data" button to compress a sample JSON object and save it to a file named `data.dat` in your Google Drive.
    *   Click the "Read and Decompress Data" button to read the `data.dat` file from your Google Drive, decompress it, and display the original JSON object on the page.
