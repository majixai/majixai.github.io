// Texas Hold'em Pure JS Game Logic

const suits = ['♠', '♥', '♦', '♣'];
const ranks = ['2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K', 'A'];

function createDeck() {
    let deck = [];
    for (let suit of suits) {
        for (let rank of ranks) {
            deck.push({ suit, rank });
        }
    }
    return deck;
}

function shuffle(deck) {
    for (let i = deck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [deck[i], deck[j]] = [deck[j], deck[i]];
    }
}


let state = {
    players: [
        { name: 'Alice', hand: [], chips: 1000, inGame: true },
        { name: 'Bob', hand: [], chips: 1000, inGame: true }
    ],
    community: [],
    pot: 0,
    deck: [],
    currentPlayer: 0,
    round: 0,
    tournament: false,
    winners: [],
    eliminated: []
};

function resetGame() {
    state.deck = createDeck();
    shuffle(state.deck);
    state.community = [];
    state.pot = 0;
    state.players.forEach(p => {
        p.hand = [];
        if (p.chips <= 0) {
            p.inGame = false;
            if (!state.eliminated.includes(p.name)) state.eliminated.push(p.name);
        } else {
            p.inGame = true;
        }
    });
    state.round = 0;
    state.winners = [];
    render();
}

function deal() {
    if (state.round === 0) {
        // Deal 2 cards to each player
        state.players.forEach(p => {
            if (p.chips > 0) p.hand = [state.deck.pop(), state.deck.pop()];
        });
        state.round = 1;
    } else if (state.round === 1) {
        // Flop
        state.community = [state.deck.pop(), state.deck.pop(), state.deck.pop()];
        state.round = 2;
    } else if (state.round === 2) {
        // Turn
        state.community.push(state.deck.pop());
        state.round = 3;
    } else if (state.round === 3) {
        // River
        state.community.push(state.deck.pop());
        state.round = 4;
    }
    render();
}

function bet() {
    let player = state.players[state.currentPlayer];
    if (!player.inGame || player.chips <= 0) return;
    let amount = 10;
    if (player.chips >= amount) {
        player.chips -= amount;
        state.pot += amount;
        if (player.chips === 0) {
            player.inGame = false;
            if (!state.eliminated.includes(player.name)) state.eliminated.push(player.name);
        }
        nextPlayer();
    }
    render();
}

function fold() {
    let player = state.players[state.currentPlayer];
    player.inGame = false;
    if (!state.eliminated.includes(player.name) && player.chips === 0) state.eliminated.push(player.name);
    nextPlayer();
    render();
}

function nextPlayer() {
    let start = state.currentPlayer;
    do {
        state.currentPlayer = (state.currentPlayer + 1) % state.players.length;
    } while (!state.players[state.currentPlayer].inGame && state.currentPlayer !== start);
}


function render() {
    // Players
    let playersDiv = document.getElementById('players');
    playersDiv.innerHTML = '';
    state.players.forEach((p, i) => {
        playersDiv.innerHTML += `<div class="w3-card w3-padding w3-margin w3-${i === state.currentPlayer ? 'yellow' : 'white'}">
            <b>${p.name}</b> (${p.chips} chips) ${p.inGame ? '' : '<span class="w3-text-red">(Folded)</span>'}<br>
            Hand: ${p.hand.map(card => card ? card.rank + card.suit : '').join(' ')}
        </div>`;
    });
    // Community cards
    document.getElementById('community-cards').innerHTML = 'Community: ' + state.community.map(card => card.rank + card.suit).join(' ');
    // Pot
    document.getElementById('pot').innerHTML = 'Pot: ' + state.pot;

    // Probabilities and outs (simple estimation)
    let probDiv = document.getElementById('probabilities');
    if (state.round > 0 && state.players[0].hand.length === 2) {
        probDiv.innerHTML = '';
        state.players.forEach((p, i) => {
            if (p.inGame && p.hand.length === 2) {
                let outs = estimateOuts(p, state.community, state.deck.length);
                let prob = outs > 0 ? ((outs / state.deck.length) * 100).toFixed(1) : 'N/A';
                probDiv.innerHTML += `<div><b>${p.name}</b>: Outs: ${outs}, Win Chance: ${prob}%</div>`;
            }
        });
    } else {
        probDiv.innerHTML = '';
    }

    // Tournament status
    let tDiv = document.getElementById('tournament-status');
    if (state.eliminated.length > 0) {
        tDiv.innerHTML = 'Eliminated: ' + state.eliminated.join(', ');
    } else {
        tDiv.innerHTML = '';
    }
    // Winner
    let active = state.players.filter(p => p.chips > 0);
    if (active.length === 1 && state.players.length > 1) {
        tDiv.innerHTML += `<br><b>Winner: ${active[0].name}!</b>`;
    }
}

function estimateOuts(player, community, deckLeft) {
    // Simple: count how many cards left could make a pair for the player
    if (community.length === 0) return 0;
    let handRanks = player.hand.map(c => c.rank);
    let outs = 0;
    for (let r of handRanks) {
        outs += 3; // 3 cards left for each rank (since 1 in hand, 3 left)
    }
    return outs;
}

function addPlayer() {
    let name = document.getElementById('new-player-name').value.trim();
    if (!name) return;
    state.players.push({ name, hand: [], chips: 1000, inGame: true });
    render();
}

function removePlayer() {
    if (state.players.length > 2) {
        state.players.pop();
        render();
    }
}

// Initial render
resetGame();
