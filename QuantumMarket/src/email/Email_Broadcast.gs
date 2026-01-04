/**
 * ==========================================================================
 * FILE: Email_Broadcast.gs
 * DESCRIPTION: Handles the BROADCASTING part of the Email Data Loop.
 *              This service is responsible for fetching, compressing,
 *              sharding, and sending massive data payloads.
 * ==========================================================================
 */

const Email_Broadcast = {

  /**
   * Main broadcast function. Fetches unprocessed snapshots, compresses, shards,
   * sends via email, and then archives the source files.
   */
  broadcastMarketSnapshot: function() {
    System_Logger.log("EmailBroadcast", "Starting massive data broadcast...");

    const unprocessedFiles = this.getUnprocessedFiles();
    if (unprocessedFiles.length === 0) {
      System_Logger.log("EmailBroadcast", "Broadcast cancelled: No new data snapshots found.");
      return;
    }
    System_Logger.log("EmailBroadcast", `Found ${unprocessedFiles.length} new snapshot files to process.`);

    const aggregatedData = this.extractDataFromFiles(unprocessedFiles);
    if (aggregatedData.length === 0) {
      System_Logger.log("EmailBroadcast", "Broadcast cancelled: Failed to extract data from snapshots.", true);
      return;
    }

    const compressedBlob = this.compressData(aggregatedData);
    const hashId = this.generateUniqueHash(compressedBlob);
    System_Logger.log("EmailBroadcast", `Generated unique Hash ID: ${hashId}`);

    const dataShards = this.createDataShards(compressedBlob);
    this.sendShardedEmails(hashId, dataShards);

    this.archiveProcessedFiles(unprocessedFiles);
    System_Logger.log("EmailBroadcast", "Broadcast complete. Archived processed files.");
  },

  /**
   * Retrieves a list of file objects that have not yet been processed.
   * @returns {Array<File>} A list of Google Drive File objects.
   */
  getUnprocessedFiles: function() {
    try {
      const folderName = System_Config.getSetting('FOLDER_NAME');
      const mainFolder = DriveApp.getFoldersByName(folderName).next();
      const files = mainFolder.getFiles();
      const fileList = [];
      while (files.hasNext()) {
        const file = files.next();
        // Ensure we only get files, not folders that might be in the directory
        if (file.getMimeType() !== MimeType.GOOGLE_APPS_SCRIPT) { // A simple check for files
             fileList.push(file);
        }
      }
      return fileList;
    } catch (e) {
      System_Logger.log("EmailBroadcast", `Could not retrieve unprocessed files: ${e.message}`, true);
      return [];
    }
  },

  /**
   * Extracts and aggregates data from a list of snapshot files.
   * @param {Array<File>} files A list of Google Drive File objects.
   * @returns {Array<Object>} An aggregated array of all data points.
   */
  extractDataFromFiles: function(files) {
    const allData = [];
    files.forEach(file => {
      try {
        const blob = Utilities.unzip(file.getBlob());
        const content = blob.getDataAsString();
        if (content) {
          allData.push(...JSON.parse(content));
        }
      } catch (e) {
        System_Logger.log("EmailBroadcast", `Failed to read/parse file ${file.getName()}: ${e.message}`, true);
      }
    });
    return allData;
  },

  /**
   * Moves a list of files to the 'processed_snapshots' archive folder.
   * @param {Array<File>} files A list of Google Drive File objects to move.
   */
  archiveProcessedFiles: function(files) {
    try {
      const folderName = System_Config.getSetting('FOLDER_NAME');
      const mainFolder = DriveApp.getFoldersByName(folderName).next();
      const archiveFolder = mainFolder.getFoldersByName('processed_snapshots').next();

      files.forEach(file => {
        try {
          file.moveTo(archiveFolder);
        } catch (e) {
          System_Logger.log("EmailBroadcast", `Failed to move file ${file.getName()} to archive: ${e.message}`, true);
        }
      });
    } catch (e) {
       System_Logger.log("EmailBroadcast", `Could not access archive folder: ${e.message}`, true);
    }
  },

  /**
   * Compresses data into a GZIP blob.
   * @param {Array<Object>} data The data to compress.
   * @returns {Blob} A GZIP-compressed blob.
   */
  compressData: function(data) {
    const jsonString = JSON.stringify(data);
    const blob = Utilities.newBlob(jsonString, 'application/json');
    return Utilities.gzip(blob);
  },

  /**
   * Generates a SHA-256 hash for a data blob to ensure integrity.
   * @param {Blob} blob The blob to hash.
   * @returns {string} The hex string representation of the hash.
   */
  generateUniqueHash: function(blob) {
    const hashBytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, blob.getBytes());
    return hashBytes.map(byte => ('0' + (byte & 0xFF).toString(16)).slice(-2)).join('');
  },

  /**
   * Splits a blob into multiple base64-encoded strings of a safe size for email.
   * @param {Blob} blob The compressed data blob.
   * @returns {Array<string>} An array of base64-encoded data shards.
   */
  createDataShards: function(blob) {
    const base64Data = Utilities.base64Encode(blob.getBytes());
    const chunkSize = 500000; // ~500KB chunks are safe for most email servers
    const shards = [];
    for (let i = 0; i < base64Data.length; i += chunkSize) {
      shards.push(base64Data.substring(i, i + chunkSize));
    }
    System_Logger.log("EmailBroadcast", `Data sharded into ${shards.length} parts.`);
    return shards;
  },

  /**
   * Sends the sharded data as a series of emails.
   * @param {string} hashId The unique hash for this data transmission.
   * @param {Array<string>} shards The array of base64-encoded data shards.
   */
  sendShardedEmails: function(hashId, shards) {
    const recipient = System_Config.getSetting('EMAIL_RECIPIENT');
    const totalShards = shards.length;
    const labelName = "UNPROCESSED_DATA";

    // Ensure the Gmail label exists
    if (!GmailApp.getUserLabelByName(labelName)) {
      GmailApp.createLabel(labelName);
    }

    for (let i = 0; i < totalShards; i++) {
      const shardNum = i + 1;
      const subject = `[DATA SHARD] ID:${hashId} | Part ${shardNum} of ${totalShards}`;
      const body = `This is part ${shardNum}/${totalShards} of a multi-part data transmission.\n\n---BEGIN SHARD---\n${shards[i]}\n---END SHARD---`;

      GmailApp.sendEmail(recipient, subject, body, {
        labelIds: [GmailApp.getUserLabelByName(labelName).getId()]
      });
      Utilities.sleep(2500); // Avoid hitting Gmail rate limits
    }
  }
};
