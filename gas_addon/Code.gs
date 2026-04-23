/**
 * @param {Object} e The event object.
 * @return {CardService.Card} The homepage card.
 */
function onHomepage(e) {
  return createCard('Homepage');
}

/**
 * Creates a card with a given name.
 * @param {string} name The name to display on the card.
 * @return {CardService.Card} The card.
 */
function createCard(name) {
  return CardService.newCardBuilder()
      .setHeader(CardService.newCardHeader().setTitle(name))
      .build();
}
