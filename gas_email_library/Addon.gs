/**
 * Runs when the document is opened, creating a custom menu.
 * This function is context-aware and works in Sheets, Docs, and Slides.
 *
 * @param {Object} e The event parameter.
 */
function onOpen(e) {
  const ui = getUi();
  if (ui) {
    ui.createMenu('Email Library')
      .addItem('Open Web App', 'showWebApp')
      .addItem('Open Sidebar', 'showSidebar')
      .addToUi();
  } else {
    Logger.log('Could not determine host application UI.');
  }
}

/**
 * Shows the main web app in a modal dialog.
 * This function is context-aware.
 */
function showWebApp() {
  const ui = getUi();
  if (ui) {
    const html = HtmlService.createHtmlOutputFromFile('index')
      .setWidth(600)
      .setHeight(500);
    ui.showModalDialog(html, 'GAS Email Library');
  }
}

/**
 * Shows the sidebar interface.
 * This function is context-aware.
 */
function showSidebar() {
  const ui = getUi();
  if (ui) {
    const html = HtmlService.createHtmlOutputFromFile('sidebar');
    ui.showSidebar(html);
  }
}

/**
 * Gets the UI object for the active application (Sheets, Docs, or Slides).
 * This private helper function allows the add-on to be host-aware.
 *
 * @private
 * @return {Ui|null} The UI object for the current host, or null if not in a supported host.
 */
function getUi() {
  try {
    if (typeof DocumentApp !== 'undefined' && DocumentApp.getActiveDocument()) {
      return DocumentApp.getUi();
    }
  } catch (f) { /* Suppress error if DocumentApp is not available */ }

  try {
    if (typeof SpreadsheetApp !== 'undefined' && SpreadsheetApp.getActiveSpreadsheet()) {
      return SpreadsheetApp.getUi();
    }
  } catch (f) { /* Suppress error if SpreadsheetApp is not available */ }

  try {
    if (typeof SlidesApp !== 'undefined' && SlidesApp.getActivePresentation()) {
      return SlidesApp.getUi();
    }
  } catch (f) { /* Suppress error if SlidesApp is not available */ }

  return null;
}
