class GameEngine {
    constructor() {
        this.gameState = null;
        this.betBtn = document.getElementById('bet-btn');
        this.foldBtn = document.getElementById('fold-btn');
        this.nextRoundBtn = document.getElementById('next-round-btn');
        this.potAmount = document.getElementById('pot-amount');
        this.communityCardContainer = document.getElementById('community-card-container');
        this.playersContainer = document.getElementById('players');

        this.betBtn.addEventListener('click', () => this.bet());
        this.foldBtn.addEventListener('click', () => this.fold());
        this.nextRoundBtn.addEventListener('click', () => this.nextRound());

        this.fetchGameState();
    }

    async fetchGameState() {
        const response = await fetch('/game_state');
        this.gameState = await response.json();
        this.render();
    }

    async bet() {
        // For simplicity, we'll hardcode the player and bet amount
        const playerId = this.gameState.players[0].id;
        const amount = 10;
        await fetch('/bet', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ player_id: playerId, amount: amount })
        });
        this.fetchGameState();
    }

    async fold() {
        // For simplicity, we'll hardcode the player
        const playerId = this.gameState.players[0].id;
        await fetch('/fold', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ player_id: playerId })
        });
        this.fetchGameState();
    }

    async nextRound() {
        await fetch('/next_round');
        this.fetchGameState();
    }

    render() {
        this.potAmount.textContent = this.gameState.pot;

        this.communityCardContainer.innerHTML = '';
        this.gameState.community_cards.forEach(card => {
            this.communityCardContainer.innerHTML += `<div class="card">${card}</div>`;
        });

        this.playersContainer.innerHTML = '';
        this.gameState.players.forEach(player => {
            const playerDiv = document.createElement('div');
            playerDiv.className = 'player';
            playerDiv.innerHTML = `
                <h3>${player.name}</h3>
                <p>Chips: ${player.chips}</p>
                <div class="hand">
                    ${player.hand.map(card => `<div class="card">${card}</div>`).join('')}
                </div>
            `;
            this.playersContainer.appendChild(playerDiv);
        });
    }
}

new GameEngine();
