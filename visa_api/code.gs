/**
 * Serves the HTML file for the UI.
 * @param {Object} e The event parameter for a web app request.
 * @return {HtmlOutput} The HTML output for the page.
 */
function doGet(e) {
  return HtmlService.createTemplateFromFile('index').evaluate();
}

/**
 * Handles POST requests from the client-side script.
 * @param {Object} paymentData The payment data from the form.
 * @return {ContentService.TextOutput} The response to the request.
 */
function doPost(paymentData) {
  try {
    const requestData = paymentData;

    const fraudAnalysis = analyzeFraud(requestData);
    if (fraudAnalysis.riskScore > 75) {
      return ContentService.createTextOutput(JSON.stringify({ success: false, error: `High fraud risk detected (${fraudAnalysis.riskScore}/100). Payment rejected. Explanation: ${fraudAnalysis.explanation}` }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // In a real application, you would get a payment token from the client-side
    // and use it to make a payment request to the Visa API here.
    // For this example, we'll just simulate a successful payment.

    const paymentResponse = processPayment(requestData);
    paymentResponse.fraudAnalysis = fraudAnalysis;

    return ContentService.createTextOutput(JSON.stringify(paymentResponse))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    Logger.log('Error processing payment: ' + error.message);
    return ContentService.createTextOutput(JSON.stringify({ success: false, error: error.message }))
      .setMimeType(ContentService.MimeType.JSON);
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