Here is a README.md file detailing the instructions for integrating Google Pay into the ordering system for later development.
🍕 Cammis's Artisanal Pizzeria - Google Pay Integration Guide
This document outlines the roadmap and technical steps required to integrate the Google Pay API into our custom HTML ordering system. This will allow customers to enjoy a fast, seamless checkout experience directly from their cart.
📋 Prerequisites
Before beginning development, ensure you have completed the following administrative steps:
 * Google Pay Business Console: Sign up and register the business at the Google Pay & Wallet Console.
 * Payment Gateway Setup: Ensure you have an active account with a supported payment processor (e.g., Stripe, Braintree, Square) to handle the tokenized payment data.
 * Merchant ID: Obtain your Google Pay Merchant ID (required for the production environment).
🛠️ Integration Steps
Step 1: Load the Google Pay API
Add the Google Pay script to the <head> or just before the closing </body> tag of your ordering system HTML.
<script async src="https://pay.google.com/gp/p/js/pay.js" onload="onGooglePayLoaded()"></script>

Step 2: Configure the Payment Client
Initialize the Google Pay client in your JavaScript. Always start in the TEST environment before switching to PRODUCTION.
const baseRequest = {
  apiVersion: 2,
  apiVersionMinor: 0
};

// Define allowed payment methods (e.g., Cards)
const allowedCardNetworks = ["AMEX", "DISCOVER", "INTERAC", "JCB", "MASTERCARD", "VISA"];
const allowedCardAuthMethods = ["PAN_ONLY", "CRYPTOGRAM_3DS"];

const baseCardPaymentMethod = {
  type: 'CARD',
  parameters: {
    allowedAuthMethods: allowedCardAuthMethods,
    allowedCardNetworks: allowedCardNetworks
  }
};

Step 3: Define Tokenization (Gateway)
Configure how the payment data will be tokenized and sent to your specific payment gateway (e.g., Stripe).
const tokenizationSpecification = {
  type: 'PAYMENT_GATEWAY',
  parameters: {
    'gateway': 'exampleGateway', // Replace with your gateway (e.g., 'stripe')
    'gatewayMerchantId': 'exampleGatewayMerchantId'
  }
};

const cardPaymentMethod = Object.assign(
  {},
  baseCardPaymentMethod,
  { tokenizationSpecification: tokenizationSpecification }
);

Step 4: Add the Google Pay Button
Create a container in the UI (near the "Proceed to Checkout" button) and use the API to dynamically render the Google Pay button if the user's browser/device supports it.
HTML Placeholder:
<div id="google-pay-button-container"></div>

JavaScript Rendering:
let paymentsClient = null;

function getGooglePaymentsClient() {
  if (paymentsClient === null) {
    paymentsClient = new google.payments.api.PaymentsClient({environment: 'TEST'});
  }
  return paymentsClient;
}

function onGooglePayLoaded() {
  const client = getGooglePaymentsClient();
  const isReadyToPayRequest = Object.assign({}, baseRequest);
  isReadyToPayRequest.allowedPaymentMethods = [baseCardPaymentMethod];

  client.isReadyToPay(isReadyToPayRequest)
    .then(function(response) {
      if (response.result) {
        addGooglePayButton();
      }
    })
    .catch(function(err) {
      console.error("Error determining readiness to pay:", err);
    });
}

function addGooglePayButton() {
  const client = getGooglePaymentsClient();
  const button = client.createButton({
    onClick: onGooglePaymentButtonClicked,
    buttonColor: 'black',
    buttonType: 'checkout'
  });
  document.getElementById('google-pay-button-container').appendChild(button);
}

Step 5: Process the Payment
When the user clicks the button, pull the current cart total and request the payment data.
function getGooglePaymentDataRequest() {
  const paymentDataRequest = Object.assign({}, baseRequest);
  paymentDataRequest.allowedPaymentMethods = [cardPaymentMethod];
  paymentDataRequest.transactionInfo = {
    totalPriceStatus: 'FINAL',
    totalPrice: document.getElementById('total').textContent.replace('$', ''), // Hooks into our cart system
    currencyCode: 'USD',
    countryCode: 'US'
  };
  paymentDataRequest.merchantInfo = {
    merchantName: "Cammis's Artisanal Pizzeria",
    merchantId: "12345678901234567890" // Replace in Production
  };
  return paymentDataRequest;
}

function onGooglePaymentButtonClicked() {
  const paymentDataRequest = getGooglePaymentDataRequest();
  const paymentsClient = getGooglePaymentsClient();
  
  paymentsClient.loadPaymentData(paymentDataRequest)
    .then(function(paymentData) {
      // Handle the response
      processPayment(paymentData);
    })
    .catch(function(err) {
      console.error("Payment failed or cancelled:", err);
    });
}

function processPayment(paymentData) {
  // Send paymentData.paymentMethodData.tokenizationData.token to your server/gateway
  console.log("Success! Token received:", paymentData);
  alert("Payment successful! Your pizza is being prepared.");
}

🧪 Testing and Going Live
1. Test Environment Validation
 * Ensure your PaymentsClient is set to {environment: 'TEST'}.
 * Test with real or test cards; no actual charges will be processed in the test environment.
 * Verify that the UI behaves correctly when the cart is empty versus when items are added.
2. Transitioning to Production
Once development and testing are complete:
 * Change the environment parameter to {environment: 'PRODUCTION'}.
 * Update merchantId inside merchantInfo to your actual Google Pay Merchant ID.
 * Submit your integration for review via the Google Pay Business Console.
 * Ensure your website is served over HTTPS, as this is a strict requirement for the Google Pay API in production.
