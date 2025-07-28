// Deck, Card, and related logic with OOP, generators, and private fields
export class Card {
    #suit;
    #rank;
    constructor(suit, rank) {
        this.#suit = suit;
        this.#rank = rank;
    }
    get suit() { return this.#suit; }
    get rank() { return this.#rank; }
    toString() { return `${this.#rank}${this.#suit}`; }
}

export class Deck {
    #cards;
    constructor() {
        this.#cards = [];
        this.reset();
    }
    reset() {
        this.#cards = [];
        for (let suit of ['♠','♥','♦','♣']) {
            for (let rank of ['2','3','4','5','6','7','8','9','T','J','Q','K','A']) {
                this.#cards.push(new Card(suit, rank));
            }
        }
    }
    shuffle() {
        for (let i = this.#cards.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [this.#cards[i], this.#cards[j]] = [this.#cards[j], this.#cards[i]];
        }
    }
    *dealGenerator() {
        while (this.#cards.length > 0) {
            yield this.#cards.pop();
        }
    }
    dealOne() {
        return this.#cards.pop();
    }
    get count() { return this.#cards.length; }
}
