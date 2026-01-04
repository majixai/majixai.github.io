/**
 * -------------------------------------------------------------------------
 * FILE: EmailDataLoop.gs
 * DESCRIPTION: Advanced system for sending and receiving massive data payloads
 *              via a multi-part, compressed, and hashed email chain.
 *              This bypasses standard single-email size limits.
 * -------------------------------------------------------------------------
 */

const EmailDataLoop = {

  // --- 1. CORE BROADCAST FUNCTION ---

  /**
   * Fetches unprocessed snapshots, compresses, shards, sends via email, and archives them.
   * TRIGGER: Time-driven (e.g., every 6 hours)
   */
  broadcastMarketSnapshot: function() {
    LogSystem.log("EmailLoop", "Starting massive data broadcast...");

    // 1. Get only the UNPROCESSED snapshot files from Drive
    const unprocessedFiles = this.getUnprocessedFiles();
    if (unprocessedFiles.length === 0) {
      LogSystem.log("EmailLoop", "Broadcast cancelled: No new data snapshots found.");
      return;
    }
    LogSystem.log("EmailLoop", `Found ${unprocessedFiles.length} new snapshot files to process.`);

    // 2. Extract and aggregate data from these files
    const aggregatedData = this.extractDataFromFiles(unprocessedFiles);
    if (aggregatedData.length === 0) {
      LogSystem.log("EmailLoop", "Broadcast cancelled: Failed to extract data from snapshots.", true);
      return;
    }

    // 3. Compress the payload
    const compressedBlob = this.compressData(aggregatedData);

    // 4. Generate a Unique ID for this data transfer
    const hashId = this.generateUniqueHash(compressedBlob);
    LogSystem.log("EmailLoop", `Generated unique Hash ID: ${hashId}`);

    // 5. Shard and send the emails
    const dataShards = this.createDataShards(compressedBlob);
    this.sendShardedEmails(hashId, dataShards);

    // 6. Archive the processed files to prevent re-processing
    this.archiveProcessedFiles(unprocessedFiles);

    LogSystem.log("EmailLoop", "Broadcast complete. Archived processed files.");
  },

  // --- 2. CORE INGESTION FUNCTION ---

  /**
   * Searches for unprocessed data shard emails, stitches them together,
   * validates the hash, and saves the final data payload.
   * TRIGGER: Time-driven (e.g., every 6 hours, ~15 mins after broadcast)
   */
  ingestEmailData: function() {
    LogSystem.log("EmailLoop", "Starting data ingestion process...");

    // 1. Find the latest unprocessed data email thread using Gmail API
    const mainThread = this.findLatestDataThread();
    if (!mainThread) {
      LogSystem.log("EmailLoop", "Ingestion complete: No new data threads found.");
      return;
    }

    const messages = mainThread.getMessages();
    LogSystem.log("EmailLoop", `Found data thread with ${messages.length} messages.`);

    // 2. Extract metadata from the first email's subject
    const { hashId, totalShards } = this.parseSubject(messages[0].getSubject());
    if (!hashId || !totalShards || messages.length < totalShards) {
      LogSystem.log("EmailLoop", `Ingestion failed: Invalid subject or missing shards. Expected ${totalShards}, found ${messages.length}.`, true);
      GmailApp.starMessage(messages[0]); // Star for manual review
      return;
    }

    // 3. Reconstruct the base64 data from shards
    const base64Data = this.reconstructData(messages, totalShards);

    // 4. Decode, decompress, and validate the data
    try {
      const decompressedData = this.decodeAndVerify(base64Data, hashId);

      // 5. Save the final payload to a designated Drive folder
      this.saveFinalPayload(decompressedData, hashId);
      LogSystem.log("EmailLoop", "Successfully ingested and verified data payload.");

      // 6. Mark the thread as processed (removes label)
      mainThread.removeLabel(GmailApp.getUserLabelByName("UNPROCESSED_DATA"));
      mainThread.moveToTrash(); // Cleanup

    } catch (e) {
      LogSystem.log("EmailLoop", `Ingestion CRITICAL FAIL: ${e.message}`, true);
      GmailApp.starMessage(messages[0]); // Star for manual review
    }
  },

  // --- 3. HELPER FUNCTIONS: BROADCASTING ---

  getUnprocessedFiles: function() {
    const folderName = PropertiesService.getScriptProperties().getProperty('FOLDER_NAME') || 'MarketData_DB';
    const mainFolder = DriveApp.getFoldersByName(folderName).next();
    const files = mainFolder.getFiles();
    const fileList = [];
    while (files.hasNext()) {
      fileList.push(files.next());
    }
    return fileList;
  },

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
        LogSystem.log("EmailLoop", `Failed to read or parse file ${file.getName()}: ${e.message}`, true);
      }
    });
    return allData;
  },

  archiveProcessedFiles: function(files) {
    const folderName = PropertiesService.getScriptProperties().getProperty('FOLDER_NAME') || 'MarketData_DB';
    const mainFolder = DriveApp.getFoldersByName(folderName).next();
    const archiveFolder = mainFolder.getFoldersByName('processed_snapshots').next();

    files.forEach(file => {
      try {
        file.moveTo(archiveFolder);
      } catch (e) {
        LogSystem.log("EmailLoop", `Failed to move file ${file.getName()} to archive: ${e.message}`, true);
      }
    });
  },

  compressData: function(data) {
    const jsonString = JSON.stringify(data);
    const blob = Utilities.newBlob(jsonString, 'application/json');
    return Utilities.gzip(blob);
  },

  generateUniqueHash: function(blob) {
    return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, blob.getBytes())
      .map(byte => ('0' + (byte & 0xFF).toString(16)).slice(-2))
      .join('');
  },

  createDataShards: function(blob) {
    const base64Data = Utilities.base64Encode(blob.getBytes());
    // Split into ~500KB chunks (safe for most email servers)
    const chunkSize = 500000;
    const shards = [];
    for (let i = 0; i < base64Data.length; i += chunkSize) {
      shards.push(base64Data.substring(i, i + chunkSize));
    }
    return shards;
  },

  sendShardedEmails: function(hashId, shards) {
    const recipient = PropertiesService.getScriptProperties().getProperty('EMAIL_RECIPIENT') || Session.getActiveUser().getEmail();
    const totalShards = shards.length;

    // Ensure the label exists
    if (!GmailApp.getUserLabelByName("UNPROCESSED_DATA")) {
      GmailApp.createLabel("UNPROCESSED_DATA");
    }

    for (let i = 0; i < totalShards; i++) {
      const shardNum = i + 1;
      const subject = `[DATA SHARD] ID:${hashId} | Part ${shardNum} of ${totalShards}`;
      const body = `This is part ${shardNum}/${totalShards} of a multi-part data transmission.\n\n---BEGIN SHARD---\n${shards[i]}\n---END SHARD---`;

      GmailApp.sendEmail(recipient, subject, body, {
        labelIds: [GmailApp.getUserLabelByName("UNPROCESSED_DATA").getId()]
      });
      Utilities.sleep(2000); // Avoid hitting rate limits
    }
  },

  // --- 4. HELPER FUNCTIONS: INGESTION ---

  findLatestDataThread: function() {
    const label = GmailApp.getUserLabelByName("UNPROCESSED_DATA");
    if (!label) return null;
    const threads = label.getThreads(0, 1);
    return threads.length > 0 ? threads[0] : null;
  },

  parseSubject: function(subject) {
    const match = subject.match(/ID:([a-f0-9]+) \| Part \d+ of (\d+)/);
    if (match) {
      return { hashId: match[1], totalShards: parseInt(match[2], 10) };
    }
    return {};
  },

  reconstructData: function(messages, totalShards) {
    // Sort messages to ensure correct order
    const sortedMessages = messages.sort((a, b) => {
      const partA = parseInt(a.getSubject().match(/Part (\d+)/)[1]);
      const partB = parseInt(b.getSubject().match(/Part (\d+)/)[1]);
      return partA - partB;
    });

    return sortedMessages.map(msg => {
      const body = msg.getPlainBody();
      const match = body.match(/---BEGIN SHARD---\s*([\s\S]+?)\s*---END SHARD---/);
      return match ? match[1].trim() : '';
    }).join('');
  },

  decodeAndVerify: function(base64Data, originalHash) {
    const decodedBytes = Utilities.base64Decode(base64Data);
    const newHash = this.generateUniqueHash({getBytes: () => decodedBytes});

    if (newHash !== originalHash) {
      throw new Error(`Data integrity check failed. Hash mismatch. Expected ${originalHash}, got ${newHash}.`);
    }

    const blob = Utilities.newBlob(decodedBytes);
    const decompressed = Utilities.unzip(blob);
    return JSON.parse(decompressed.getDataAsString());
  },

  saveFinalPayload: function(data, hashId) {
    const folderName = "INGESTED_DATA_PAYLOADS";
    let folder = DriveApp.getFoldersByName(folderName);
    if (!folder.hasNext()) {
      folder = DriveApp.createFolder(folderName);
    } else {
      folder = folder.next();
    }

    const fileName = `payload_${hashId}.json`;
    folder.createFile(fileName, JSON.stringify(data, null, 2));
  }
};
