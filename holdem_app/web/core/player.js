// Player class with OOP, private fields, async, and decorators
function logAction(target, name, descriptor) {
    const original = descriptor.value;
    descriptor.value = async function(...args) {
        console.log(`[${this.name}] Action: ${name}`);
        return await original.apply(this, args);
    };
    return descriptor;
}

export class Player {
    #chips;
    #hand;
    #inGame;
    constructor(name, chips = 1000) {
        this.name = name;
        this.#chips = chips;
        this.#hand = [];
        this.#inGame = true;
    }
    get chips() { return this.#chips; }
    get hand() { return this.#hand; }
    get inGame() { return this.#inGame; }
    set inGame(val) { this.#inGame = val; }
    addCard(card) { this.#hand.push(card); }
    resetHand() { this.#hand = []; }
    @logAction
    async bet(amount) {
        if (amount > this.#chips) throw new Error('Not enough chips');
        this.#chips -= amount;
        return amount;
    }
    @logAction
    async fold() {
        this.#inGame = false;
    }
}
