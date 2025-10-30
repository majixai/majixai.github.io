// Game logic with async, OOP, and generators
import { Deck } from './deck.js';
import { Player } from './player.js';

export class Game {
    #deck;
    #players;
    #community;
    #pot;
    #currentPlayerIdx;
    #round;
    constructor(playerNames) {
        this.#deck = new Deck();
        this.#players = playerNames.map(name => new Player(name));
        this.#community = [];
        this.#pot = 0;
        this.#currentPlayerIdx = 0;
        this.#round = 0;
    }
    get players() { return this.#players; }
    get community() { return this.#community; }
    get pot() { return this.#pot; }
    get round() { return this.#round; }
    get currentPlayer() { return this.#players[this.#currentPlayerIdx]; }
    async start() {
        this.#deck.reset();
        this.#deck.shuffle();
        this.#community = [];
        this.#pot = 0;
        this.#players.forEach(p => { p.resetHand(); p.inGame = true; });
        this.#round = 0;
        for (let p of this.#players) {
            p.addCard(this.#deck.dealOne());
            p.addCard(this.#deck.dealOne());
        }
    }
    async dealCommunity() {
        if (this.#round === 0) {
            this.#community = [this.#deck.dealOne(), this.#deck.dealOne(), this.#deck.dealOne()];
        } else if (this.#round === 1 || this.#round === 2) {
            this.#community.push(this.#deck.dealOne());
        }
        this.#round++;
    }
    *activePlayers() {
        for (let p of this.#players) if (p.inGame) yield p;
    }
    async bet(amount) {
        let p = this.currentPlayer;
        await p.bet(amount);
        this.#pot += amount;
        this.#currentPlayerIdx = (this.#currentPlayerIdx + 1) % this.#players.length;
    }
    async fold() {
        let p = this.currentPlayer;
        await p.fold();
        this.#currentPlayerIdx = (this.#currentPlayerIdx + 1) % this.#players.length;
    }
}
