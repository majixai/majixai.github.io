/**
 * ==========================================================================
 * FILE: Email_Ingest.gs
 * DESCRIPTION: Handles the INGESTION part of the Email Data Loop.
 *              This service is responsible for finding, reassembling,
 *              validating, and storing the data received via email shards.
 * ==========================================================================
 */

const Email_Ingest = {

  /**
   * Main ingestion function. Finds unprocessed data emails, stitches them
   * together, validates, and saves the final payload.
   */
  ingestEmailData: function() {
    System_Logger.log("EmailIngest", "Starting data ingestion process...");

    const mainThread = this.findLatestDataThread();
    if (!mainThread) {
      System_Logger.log("EmailIngest", "Ingestion complete: No new data threads found.");
      return;
    }

    const messages = mainThread.getMessages();
    System_Logger.log("EmailIngest", `Found data thread with ${messages.length} messages.`);

    const { hashId, totalShards } = this.parseSubject(messages[0].getSubject());
    if (!hashId || !totalShards || messages.length < totalShards) {
      System_Logger.log("EmailIngest", `Ingestion failed: Invalid subject or missing shards. Expected ${totalShards}, found ${messages.length}.`, true);
      GmailApp.starMessage(messages[0]); // Star for manual review
      return;
    }

    try {
      const base64Data = this.reconstructData(messages, totalShards);
      const decompressedData = this.decodeAndVerify(base64Data, hashId);

      this.saveFinalPayload(decompressedData, hashId);
      System_Logger.log("EmailIngest", "Successfully ingested and verified data payload.");

      // Cleanup: Mark thread as processed and delete
      const label = GmailApp.getUserLabelByName("UNPROCESSED_DATA");
      if (label) mainThread.removeLabel(label);
      mainThread.moveToTrash();

    } catch (e) {
      System_Logger.log("EmailIngest", `Ingestion CRITICAL FAIL: ${e.message}`, true);
      GmailApp.starMessage(messages[0]); // Star for manual review
    }
  },

  /**
   * Finds the latest unprocessed data thread using the Gmail API.
   * @returns {GmailThread|null} The latest thread with the UNPROCESSED_DATA label.
   */
  findLatestDataThread: function() {
    const labelName = "UNPROCESSED_DATA";
    const label = GmailApp.getUserLabelByName(labelName);
    if (!label) return null;

    const threads = label.getThreads(0, 1);
    return threads.length > 0 ? threads[0] : null;
  },

  /**
   * Parses the email subject to extract the hash ID and total shard count.
   * @param {string} subject The email subject line.
   * @returns {Object} An object containing the hashId and totalShards.
   */
  parseSubject: function(subject) {
    const match = subject.match(/ID:([a-f0-9]{64}) \| Part \d+ of (\d+)/);
    if (match) {
      return { hashId: match[1], totalShards: parseInt(match[2], 10) };
    }
    return {};
  },

  /**
   * Reconstructs the complete base64 data string from multiple email messages.
   * @param {Array<GmailMessage>} messages An array of Gmail message objects.
   * @param {number} totalShards The expected number of shards.
   * @returns {string} The complete, reconstructed base64 data string.
   */
  reconstructData: function(messages, totalShards) {
    // Sort messages by part number to ensure correct order
    const sortedMessages = messages.sort((a, b) => {
      const partA = parseInt(a.getSubject().match(/Part (\d+)/)[1]);
      const partB = parseInt(b.getSubject().match(/Part (\d+)/)[1]);
      return partA - partB;
    });

    return sortedMessages.map(msg => {
      const body = msg.getPlainBody();
      const match = body.match(/---BEGIN SHARD---\s*([\s\S]+?)\s*---END SHARD---/);
      return match ? match[1].trim().replace(/\s/g, '') : '';
    }).join('');
  },

  /**
   * Decodes the base64 data, re-calculates the SHA-256 hash, and verifies
   * it against the original hash to ensure data integrity.
   * @param {string} base64Data The reconstructed base64 data.
   * @param {string} originalHash The original hash from the email subject.
   * @returns {Object} The final, parsed JSON data.
   * @throws {Error} If the hash check fails.
   */
  decodeAndVerify: function(base64Data, originalHash) {
    const decodedBytes = Utilities.base64Decode(base64Data, Utilities.Charset.UTF_8);
    const blob = Utilities.newBlob(decodedBytes);

    const newHash = Email_Broadcast.generateUniqueHash(blob); // Reuse the hasher

    if (newHash !== originalHash) {
      throw new Error(`Data integrity check failed. Hash mismatch. Expected ${originalHash}, got ${newHash}.`);
    }

    const decompressed = Utilities.unzip(blob);
    return JSON.parse(decompressed.getDataAsString());
  },

  /**
   * Saves the final, verified data payload to a designated Drive subfolder.
   * @param {Object} data The final JSON data.
   * @param {string} hashId The unique hash ID of the payload.
   */
  saveFinalPayload: function(data, hashId) {
    try {
      const folderName = System_Config.getSetting('FOLDER_NAME');
      const mainFolder = DriveApp.getFoldersByName(folderName).next();
      const ingestFolder = mainFolder.getFoldersByName('ingested_payloads').next();

      const fileName = `payload_${hashId}.json`;
      ingestFolder.createFile(fileName, JSON.stringify(data, null, 2));
    } catch (e) {
      System_Logger.log("EmailIngest", `Failed to save final payload: ${e.message}`, true);
      throw e;
    }
  }
};
