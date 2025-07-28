// Poker probability and outs calculation (async, generator)
export async function* calculateOuts(player, community, deck) {
    // Dummy: yield a few possible outs for demo
    yield { type: 'pair', outs: 6 };
    yield { type: 'flush', outs: 9 };
}

export async function calculateWinProbability(player, community, deck) {
    // Dummy: returns a random probability for demo
    return Math.random();
}
