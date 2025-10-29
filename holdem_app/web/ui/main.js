// Main entry point for the advanced JS holdem app
import { Game } from '../core/game.js';
import { calculateOuts, calculateWinProbability } from '../utils/probability.js';

let game;

window.startGame = async function() {
    const names = prompt('Enter player names (comma separated):', 'Alice,Bob,Charlie').split(',').map(s => s.trim()).filter(Boolean);
    game = new Game(names);
    await game.start();
    let currentViewerIdx = 0; // 3rd person: which player is the viewer
    render();
};

window.deal = async function() {
    await game.dealCommunity();
    render();
};

window.bet = async function() {
    await game.bet(10);
    render();
};

window.fold = async function() {
    await game.fold();
    render();
};

function render() {
    const playersDiv = document.getElementById('players');
    playersDiv.innerHTML = '';
    for (let p of game.players) {
        playersDiv.innerHTML += `<div class="w3-card w3-padding w3-margin">

    window.nextPlayer = function() {
        // 3rd person: cycle through players as viewer
        currentViewerIdx = (currentViewerIdx + 1) % game.players.length;
        render();
    };
            <b>${p.name}</b> (${p.chips} chips) ${p.inGame ? '' : '<span class="w3-text-red">(Folded)</span>'}<br>
            Hand: ${p.hand.map(card => card ? card.toString() : '').join(' ')}
        </div>`;
    }
    document.getElementById('community-cards').innerHTML = 'Community: ' + game.community.map(card => card.toString()).join(' ');
    document.getElementById('pot').innerHTML = 'Pot: ' + game.pot;
    // Probabilities
    let probDiv = document.getElementById('probabilities');
    probDiv.innerHTML = '';
    for (let p of game.players) {
        calculateWinProbability(p, game.community, null).then(prob => {
            probDiv.innerHTML += `<div><b>${p.name}</b>: Win Chance: ${(prob*100).toFixed(1)}%</div>`;
        });
    }
}

document.addEventListener('DOMContentLoaded', () => {
    startGame();
});
