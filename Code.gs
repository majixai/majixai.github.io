function doGet() {
  return HtmlService.createHtmlOutputFromFile('sidebar');
}

function getUnreadEmails() {
  return GmailApp.getInboxUnreadCount();
}
