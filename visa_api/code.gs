/**
 * Serves the HTML file for the UI.
 * @param {Object} e The event parameter for a web app request.
 * @return {HtmlOutput} The HTML output for the page.
 */
function doGet(e) {
  if (e.parameter.page === 'report') {
    const template = HtmlService.createTemplateFromFile('report');
    template.repoUrl = PropertiesService.getScriptProperties().getProperty('REPO_URL');
    return template.evaluate();
  }
  return HtmlService.createTemplateFromFile('index').evaluate();
}

/**
 * Handles POST requests from the client-side script.
 * @param {Object} paymentData The payment data from the form.
 * @return {Object} A response object.
 */
function doPost(paymentData) {
  try {
    const scriptProperties = PropertiesService.getScriptProperties();
    const fraudRiskThreshold = parseInt(scriptProperties.getProperty('FRAUD_RISK_THRESHOLD'), 10) || 75;

    const fraudAnalysis = analyzeFraud(paymentData);

    if (fraudAnalysis.riskScore > fraudRiskThreshold) {
      const errorResponse = {
        success: false,
        error: `High fraud risk detected (${fraudAnalysis.riskScore}/${fraudRiskThreshold}). Payment rejected. Explanation: ${fraudAnalysis.explanation}`
      };
      logTransaction(paymentData, errorResponse, fraudAnalysis);
      return errorResponse;
    }

    const paymentResponse = processPayment(paymentData);
    paymentResponse.fraudAnalysis = fraudAnalysis;

    logTransaction(paymentData, paymentResponse, fraudAnalysis);
    return paymentResponse;

  } catch (error) {
    Logger.log('Error processing payment: ' + error.message);
    const errorResponse = { success: false, error: error.message };
    logTransaction(paymentData, errorResponse, null);
    return errorResponse;
  }
}

/**
 * Logs a transaction attempt to the configured Google Sheet.
 * @param {Object} paymentData The payment data from the form.
 * @param {Object} response The response from the payment processing.
 * @param {Object} fraudAnalysis The fraud analysis result.
 */
function logTransaction(paymentData, response, fraudAnalysis) {
  try {
    const logSheetId = PropertiesService.getScriptProperties().getProperty('LOG_SHEET_ID');
    if (!logSheetId) {
      Logger.log('LOG_SHEET_ID is not configured. Skipping transaction log.');
      return;
    }
    const sheet = SpreadsheetApp.openById(logSheetId).getSheets()[0];
    const lastFourDigits = paymentData.cardNumber ? paymentData.cardNumber.slice(-4) : (paymentData.cardDescription || 'N/A');

    sheet.appendRow([
      new Date(),
      paymentData.cardHolder || 'N/A',
      lastFourDigits,
      paymentData.paymentMethod,
      response.success ? 'Success' : 'Failed',
      response.transactionId || 'N/A',
      fraudAnalysis ? fraudAnalysis.riskScore : 'N/A',
      fraudAnalysis ? fraudAnalysis.explanation : 'N/A',
      response.error || ''
    ]);
  } catch (error) {
    Logger.log('Error logging transaction: ' + error.message);
  }
}

/**
 * Simulates processing a payment. In a real application, this would
 * make a call to the Visa API.
 * @param {Object} paymentData The data for the payment.
 * @return {Object} A simulated response object.
 */
function processPayment(paymentData) {
  // This is a mock implementation.
  // A real implementation would use UrlFetchApp to call the Visa API.
  Logger.log('Processing payment for: ' + JSON.stringify(paymentData));

  // Simulate a successful payment
  const transactionId = 'txn_' + Math.random().toString(36).substr(2, 9);
  return {
    success: true,
    transactionId: transactionId,
    message: 'Payment processed successfully.'
  };
}

/**
 * Analyzes the transaction for potential fraud using a generative AI model.
 * @param {Object} transactionData The data for the transaction.
 * @return {Object} An object containing the fraud risk assessment.
 */
function analyzeFraud(transactionData) {
  const apiKey = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
  const apiEndpoint = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=' + apiKey;

  const prompt = `Analyze the following transaction for fraud risk. Respond with only a JSON object containing 'riskScore' (an integer from 0 to 100) and 'explanation' (a brief string). Transaction data: ${JSON.stringify(transactionData)}`;

  const requestBody = {
    contents: [{
      parts: [{
        text: prompt
      }]
    }]
  };

  const options = {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(requestBody)
  };

  try {
    const response = UrlFetchApp.fetch(apiEndpoint, options);
    const responseBody = JSON.parse(response.getContentText());
    let analysisText = responseBody.candidates[0].content.parts[0].text;

    // Clean the response to ensure it is valid JSON
    analysisText = analysisText.replace(/```json/g, '').replace(/```/g, '').trim();

    const analysis = JSON.parse(analysisText);

    return {
      riskScore: analysis.riskScore,
      explanation: analysis.explanation
    };
  } catch (error) {
    Logger.log('Error analyzing fraud: ' + error.message);
    return {
      riskScore: -1,
      explanation: 'Error analyzing fraud risk.'
    };
  }
}

/**
 * Sets the API credentials in the script properties.
 * This should be run once from the script editor to set the credentials.
 * @param {string} visaApiKey The Visa API key.
 * @param {string} visaApiSecret The Visa API secret.
 * @param {string} geminiApiKey The Gemini API key.
 */
function setApiCredentials(visaApiKey, visaApiSecret, geminiApiKey) {
  const properties = PropertiesService.getScriptProperties();
  properties.setProperty('VISA_API_KEY', visaApiKey);
  properties.setProperty('VISA_API_SECRET', visaApiSecret);
  properties.setProperty('GEMINI_API_KEY', geminiApiKey);
  Logger.log('API credentials set.');
}

/**
 * Sets the configuration for the transaction logging.
 * This should be run once from the script editor.
 * @param {string} sheetId The ID of the Google Sheet for logging.
 * @param {number} threshold The fraud risk threshold.
 * @param {string} repoUrl The repository URL (e.g., 'owner/repo').
 */
function setConfiguration(sheetId, threshold, repoUrl) {
  const properties = PropertiesService.getScriptProperties();
  properties.setProperty('LOG_SHEET_ID', sheetId);
  properties.setProperty('FRAUD_RISK_THRESHOLD', threshold);
  properties.setProperty('REPO_URL', repoUrl);
  Logger.log('Configuration set.');
}