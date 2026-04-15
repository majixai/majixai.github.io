// ─── Slot Machine Overlay — JavaScript ───────────────────────────────────────
// Paste into: Broadcast Overlays → Your Slot Overlay → JavaScript
// Expects matching HTML from slot_machine.html

console.log("--- Slot Machine Overlay JS Loading ---");

(async () => {
    // ─── Constants ────────────────────────────────────────────────────────────
    const SYMBOL_HEIGHT       = 120;   // Must match CSS --symbol-height
    const BASE_SPIN_DURATION  = 2200;  // ms
    const SYMBOLS_IN_STRIP    = 32;    // Symbols pre-rendered per reel
    const MAX_HISTORY         = 50;    // Maximum spin history entries
    const RESULT_DISPLAY_MS   = 9000;  // How long to show result before hiding

    const MEDALS = ['🥇', '🥈', '🥉', '4.', '5.', '6.', '7.', '8.', '9.', '10.'];

    // ─── State ────────────────────────────────────────────────────────────────
    let symbols      = [];
    let reelCount    = 0;
    let reelElements = [];
    let isSpinning   = false;
    let spinHistory  = [];
    let jackpot      = 0;
    let goalAmount   = 0;
    let goalProgress = 0;
    let goalLabel    = 'Show Goal';
    let messageCallback = null;

    // ─── DOM Refs ─────────────────────────────────────────────────────────────
    const reelsContainer   = document.getElementById('reelsContainer');
    const resultDisplay    = document.getElementById('resultDisplay');
    const statusText       = document.getElementById('statusText');
    const winDisplay       = document.getElementById('winDisplay');
    const jackpotTicker    = document.getElementById('jackpotTicker');
    const streakBanner     = document.getElementById('streakBanner');
    const leaderboardEl    = document.getElementById('leaderboard');
    const leaderboardEntries = document.getElementById('leaderboardEntries');
    const tipGoalSection   = document.getElementById('tipGoalSection');
    const tipGoalLabel     = document.getElementById('tipGoalLabel');
    const tipGoalFill      = document.getElementById('tipGoalFill');
    const tipGoalText      = document.getElementById('tipGoalText');
    const spinButton       = document.getElementById('spinButton');
    const historyButton    = document.getElementById('historyButton');
    const historyModal     = document.getElementById('historyModal');
    const historyList      = document.getElementById('historyList');
    const modalCloseBtn    = document.getElementById('modalCloseBtn');
    const clearHistoryBtn  = document.getElementById('clearHistoryButton');
    const followerAlert    = document.getElementById('followerAlert');

    if (!reelsContainer || !resultDisplay || !winDisplay) {
        console.error("[Overlay] Required DOM elements not found!");
        return;
    }

    // ─── Utilities ────────────────────────────────────────────────────────────

    function pickRandom(arr) {
        return arr[Math.floor(Math.random() * arr.length)];
    }

    function formatNumber(n) {
        return Number(n || 0).toLocaleString('en-US');
    }

    function setStatus(msg, visible = true) {
        if (statusText) statusText.textContent = msg;
        if (visible) {
            resultDisplay.classList.add('visible');
        } else {
            resultDisplay.classList.remove('visible');
        }
    }

    function clearResult() {
        resultDisplay.classList.remove('visible');
        winDisplay.classList.remove('visible');
        winDisplay.textContent = '';
        document.getElementById('slotMachine').classList.remove('jackpot-mode');
    }

    // ─── Jackpot Ticker ───────────────────────────────────────────────────────

    function updateJackpotTicker(amount) {
        jackpot = amount;
        if (jackpotTicker) {
            jackpotTicker.textContent = `💰 JACKPOT POOL: ${formatNumber(amount)} TOKENS — TIP TO SPIN & WIN! 💰`;
        }
    }

    // ─── Tip Goal Bar ─────────────────────────────────────────────────────────

    function updateTipGoal(current, total, label) {
        goalProgress = current;
        goalAmount   = total;
        if (label) goalLabel = label;

        if (!total || total <= 0) {
            tipGoalSection.classList.remove('visible');
            return;
        }
        tipGoalSection.classList.add('visible');
        const pct = Math.min(100, Math.floor((current / total) * 100));
        tipGoalFill.style.width = `${pct}%`;
        tipGoalLabel.textContent = `🎯 ${goalLabel} (${pct}%)`;
        tipGoalText.textContent  = `${formatNumber(current)} / ${formatNumber(total)} tokens`;
    }

    // ─── Leaderboard ──────────────────────────────────────────────────────────

    function updateLeaderboard(entries) {
        if (!entries || entries.length === 0) {
            leaderboardEl.classList.remove('visible');
            return;
        }
        leaderboardEl.classList.add('visible');
        leaderboardEntries.innerHTML = '';
        entries.slice(0, 5).forEach((e, i) => {
            const row  = document.createElement('div');
            row.className = 'lb-entry';

            const left  = document.createElement('span');
            const medal = document.createTextNode(`${MEDALS[i]} `);
            const name  = document.createElement('span');
            name.className   = 'lb-name';
            name.textContent = e.username;
            left.appendChild(medal);
            left.appendChild(name);

            const right = document.createElement('span');
            right.className   = 'lb-score';
            right.textContent = formatNumber(e.score);

            row.appendChild(left);
            row.appendChild(right);
            leaderboardEntries.appendChild(row);
        });
    }

    // ─── Streak Banner ────────────────────────────────────────────────────────

    function showStreak(username, streak) {
        if (!streak || streak < 2) {
            streakBanner.classList.remove('visible');
            return;
        }
        const emoji = streak >= 10 ? '👑' : streak >= 5 ? '💥' : streak >= 3 ? '⚡' : '🔥';
        streakBanner.textContent = `${emoji} ${username} — ${streak}-Win Streak!`;
        streakBanner.classList.add('visible');
        setTimeout(() => streakBanner.classList.remove('visible'), 8000);
    }

    // ─── New Follower Alert ───────────────────────────────────────────────────

    function showFollowerAlert(username) {
        if (!followerAlert) return;
        followerAlert.textContent = `❤️ ${username} just followed! Welcome!`;
        followerAlert.classList.add('pop');
        setTimeout(() => followerAlert.classList.remove('pop'), 4500);
    }

    // ─── Confetti ─────────────────────────────────────────────────────────────

    function launchConfetti(count = 60) {
        const colors = ['#FFD700', '#FF6B6B', '#4ECDC4', '#FF69B4', '#00FF7F', '#FF4500'];
        for (let i = 0; i < count; i++) {
            setTimeout(() => {
                const piece  = document.createElement('div');
                piece.className = 'confetti-piece';
                piece.style.left             = `${Math.random() * 100}vw`;
                piece.style.top              = '-10px';
                piece.style.backgroundColor  = pickRandom(colors);
                piece.style.width            = `${6 + Math.random() * 8}px`;
                piece.style.height           = piece.style.width;
                piece.style.animationDuration = `${2 + Math.random() * 2}s`;
                piece.style.animationDelay   = '0s';
                document.body.appendChild(piece);
                setTimeout(() => piece.remove(), 5000);
            }, i * 30);
        }
    }

    // ─── Reel Construction ────────────────────────────────────────────────────

    function buildReels(count, symbolsArray) {
        reelsContainer.innerHTML = '';
        reelElements = [];

        for (let i = 0; i < count; i++) {
            const reelDiv   = document.createElement('div');
            reelDiv.classList.add('reel');
            reelDiv.style.width = `${Math.floor(320 / count)}px`;

            const symbolsDiv = document.createElement('div');
            symbolsDiv.classList.add('reel-symbols');

            reelDiv.appendChild(symbolsDiv);
            reelsContainer.appendChild(reelDiv);
            reelElements.push(symbolsDiv);
        }

        populateReels(symbolsArray);
        setStatus('Ready to spin! 🎰');
        console.log(`[Overlay] Built ${count} reels with ${symbolsArray.length} symbol types.`);
    }

    function populateReels(symbolsArray) {
        reelElements.forEach(reel => {
            const shuffled = symbolsArray.slice().sort(() => Math.random() - 0.5);

            // Build symbols strip safely without innerHTML on user data
            reel.innerHTML = '';
            const fragment = document.createDocumentFragment();
            const allSyms = [];
            for (let i = 0; i < SYMBOLS_IN_STRIP; i++) {
                allSyms.push(shuffled[i % shuffled.length]);
            }
            symbolsArray.forEach(sym => allSyms.push(sym));

            allSyms.forEach(sym => {
                const div = document.createElement('div');
                div.className = `symbol symbol-${sym.trim().replace(/\s+/g, '-')}`;
                div.textContent = sym;
                fragment.appendChild(div);
            });
            reel.appendChild(fragment);
            reel.style.transition = 'none';
            reel.style.transform  = 'translateY(0)';
            reel.offsetHeight; // force reflow
        });
    }

    // ─── Target Position Calculator ──────────────────────────────────────────

    function getTargetY(reelIndex, targetSymbol) {
        const reel    = reelElements[reelIndex];
        const syms    = reel.querySelectorAll('.symbol');
        const trimmed = targetSymbol.trim();
        let targetIdx = -1;

        for (let i = syms.length - 1; i >= 0; i--) {
            if (syms[i].textContent.trim() === trimmed) {
                targetIdx = i;
                break;
            }
        }
        if (targetIdx === -1) {
            console.warn(`[Overlay] Symbol "${trimmed}" not found in reel ${reelIndex + 1}. Using index 0.`);
            targetIdx = 0;
        }

        const finalTargetY = -(targetIdx * SYMBOL_HEIGHT);
        const extraSpins   = 4;
        const stripHeight  = syms.length * SYMBOL_HEIGHT;
        return -((extraSpins * stripHeight) - finalTargetY);
    }

    // ─── Spin Animation ───────────────────────────────────────────────────────

    async function spinToOutcome(outcome) {
        if (isSpinning) return;
        if (!outcome || outcome.length !== reelElements.length) {
            console.error("[Overlay] Invalid outcome for spin:", outcome);
            return;
        }

        isSpinning = true;
        clearResult();
        spinButton.disabled = true;

        const promises = reelElements.map((reel, i) => {
            const targetSym = outcome[i];
            const targetY   = getTargetY(i, targetSym);
            const delay     = i * 160;
            const duration  = BASE_SPIN_DURATION + i * 250 + Math.random() * 400;

            return new Promise(resolve => {
                setTimeout(() => {
                    reel.style.transition = `transform ${duration}ms cubic-bezier(0.25, 0.1, 0.25, 1.0)`;
                    reel.style.transform  = `translateY(${targetY}px)`;

                    const onEnd = () => {
                        reel.removeEventListener('transitionend', onEnd);
                        reel.style.transition = 'none';
                        reel.style.transform  = `translateY(${targetY}px)`;
                        reel.offsetHeight;
                        resolve();
                    };
                    reel.addEventListener('transitionend', onEnd);
                    setTimeout(() => { reel.removeEventListener('transitionend', onEnd); resolve(); }, duration + 250);
                }, delay);
            });
        });

        await Promise.all(promises);
        isSpinning = false;
        spinButton.disabled = false;
        console.log(`[Overlay] Spin complete. Outcome: ${outcome.join(' | ')}`);
    }

    // ─── Result Display ───────────────────────────────────────────────────────

    function displayResult(isWin, prize, username, isJackpot = false) {
        const prefix = isJackpot ? '🏆 JACKPOT!' : isWin ? '🎉 WIN!' : '🎰 Result:';
        setStatus(`${prefix} ${prize}`, true);

        if (isWin || isJackpot) {
            winDisplay.textContent = isJackpot
                ? `💰 ${username} WON THE JACKPOT! 💰`
                : `🎉 ${username} wins! ${prize}`;
            winDisplay.classList.add('visible');
            launchConfetti(isJackpot ? 120 : 60);

            if (isJackpot) {
                document.getElementById('slotMachine').classList.add('jackpot-mode');
            }
        }

        setTimeout(clearResult, RESULT_DISPLAY_MS);
    }

    // ─── History ──────────────────────────────────────────────────────────────

    function addToHistory(entry) {
        spinHistory.unshift(entry);
        if (spinHistory.length > MAX_HISTORY) spinHistory.length = MAX_HISTORY;
        try { localStorage.setItem('slotHistory', JSON.stringify(spinHistory)); } catch (_) {}
    }

    function loadHistory() {
        try {
            const raw = localStorage.getItem('slotHistory');
            if (raw) spinHistory = JSON.parse(raw);
        } catch (_) {}
    }

    function renderHistory() {
        historyList.innerHTML = '';
        if (spinHistory.length === 0) {
            historyList.innerHTML = '<li style="color:#888; text-align:center; padding:12px;">No spin history yet.</li>';
            return;
        }
        spinHistory.forEach(e => {
            const li = document.createElement('li');
            li.className = `history-item${e.isJackpot ? ' jackpot' : e.isWin ? ' win' : ''}`;

            const userLine = document.createElement('div');
            userLine.className = 'history-item-user';
            userLine.textContent = `${e.username || '?'} ${e.isJackpot ? '💰' : e.isWin ? '🎉' : ''}`;

            const detailLine = document.createElement('span');
            detailLine.className = 'history-item-details';
            const ts = e.ts ? new Date(e.ts).toLocaleTimeString() : '';
            const outcomeStr = Array.isArray(e.outcome) ? e.outcome.join(' ') : '';
            detailLine.textContent = `${outcomeStr} — ${e.prize || '—'}${ts ? ` (${ts})` : ''}`;

            li.appendChild(userLine);
            li.appendChild(detailLine);
            historyList.appendChild(li);
        });
    }

    // ─── Message Handler ──────────────────────────────────────────────────────

    messageCallback = async (event) => {
        if (!event.data || event.data.type !== 'overlayMessage') return;
        const msg = event.data.payload;
        if (!msg || !msg.eventName) return;

        console.log('[Overlay] Message received:', msg.eventName, msg);

        switch (msg.eventName) {

            case 'setConfig': {
                const cfg = msg.payload || {};
                symbols   = Array.isArray(cfg.symbols) && cfg.symbols.length > 0
                    ? cfg.symbols : ["🍒", "🔔", " BAR ", " 7 ", "💎"];
                reelCount = (typeof cfg.reelCount === 'number' && cfg.reelCount >= 2)
                    ? cfg.reelCount : 3;
                buildReels(reelCount, symbols);
                break;
            }

            case 'liveState': {
                if (typeof msg.jackpot === 'number') updateJackpotTicker(msg.jackpot);
                if (msg.goalAmount) updateTipGoal(msg.goalProgress || 0, msg.goalAmount, msg.goalLabel);
                if (msg.leaderboard) updateLeaderboard(msg.leaderboard);
                break;
            }

            case 'slotResult': {
                if (isSpinning) return;
                if (!reelCount || !symbols.length) {
                    console.warn('[Overlay] slotResult received but config not loaded.');
                    return;
                }
                if (!Array.isArray(msg.outcome) || msg.outcome.length !== reelCount) {
                    console.error('[Overlay] Invalid outcome:', msg.outcome);
                    return;
                }

                await spinToOutcome(msg.outcome);
                displayResult(msg.isWin, msg.prize, msg.user, msg.isJackpot);

                // Update jackpot if provided
                if (typeof msg.jackpot === 'number') updateJackpotTicker(msg.jackpot);

                // Streak banner
                if (msg.streak && msg.streak >= 2) showStreak(msg.user, msg.streak);

                // Log history
                addToHistory({
                    username: msg.user,
                    outcome:  msg.outcome,
                    prize:    msg.prize,
                    isWin:    msg.isWin,
                    isJackpot: msg.isJackpot,
                    ts: Date.now(),
                });
                break;
            }

            case 'newFollower': {
                showFollowerAlert(msg.username || 'New Fan');
                break;
            }

            case 'tipGoalUpdate': {
                updateTipGoal(msg.current, msg.total, msg.label);
                break;
            }

            case 'broadcastIsLive': {
                if (typeof msg.jackpot === 'number') updateJackpotTicker(msg.jackpot);
                if (msg.goalAmount) updateTipGoal(0, msg.goalAmount, msg.goalLabel);
                setStatus('🟢 Stream is LIVE!');
                setTimeout(clearResult, 5000);
                break;
            }

            case 'statusOffline': {
                setStatus('🌙 Stream Offline — See you next time!');
                break;
            }
        }
    };

    window.addEventListener('message', messageCallback);
    console.log('[Overlay] Message listener registered.');

    // ─── Test Spin Button ─────────────────────────────────────────────────────

    spinButton.addEventListener('click', async () => {
        if (isSpinning) return;
        if (!reelCount || !symbols.length) {
            setStatus('Config not loaded yet! Waiting...');
            return;
        }

        const simulateWin = Math.random() < 0.3;
        let outcome;
        if (simulateWin) {
            const winSym = pickRandom(symbols);
            outcome = Array(reelCount).fill(winSym);
        } else {
            outcome = Array.from({ length: reelCount }, () => pickRandom(symbols));
        }

        const isJackpot = simulateWin && Math.random() < 0.15;
        const prize     = simulateWin
            ? (isJackpot ? `JACKPOT! ${formatNumber(jackpot)} tokens!` : `${outcome[0].trim()} x${reelCount}!`)
            : 'Better luck next time!';

        await spinToOutcome(outcome);
        displayResult(simulateWin, prize, 'TestUser', isJackpot);
        addToHistory({ username: 'TestUser', outcome, prize, isWin: simulateWin, isJackpot, ts: Date.now() });
    });

    // ─── History Modal Controls ───────────────────────────────────────────────

    historyButton.addEventListener('click', () => {
        renderHistory();
        historyModal.classList.add('visible');
    });

    modalCloseBtn.addEventListener('click', () => historyModal.classList.remove('visible'));
    historyModal.addEventListener('click', e => { if (e.target === historyModal) historyModal.classList.remove('visible'); });

    clearHistoryBtn.addEventListener('click', () => {
        spinHistory = [];
        try { localStorage.removeItem('slotHistory'); } catch (_) {}
        renderHistory();
    });

    // ─── Init ─────────────────────────────────────────────────────────────────

    loadHistory();
    updateJackpotTicker(0);
    setStatus('Waiting for config...');

    // Request config from backend if available
    if (window.parent && window.parent !== window) {
        window.parent.postMessage({ type: 'overlayReady', overlayName: 'Slots' }, '*');
        console.log('[Overlay] Sent overlayReady to parent window.');
    }

    console.log('--- Slot Machine Overlay JS Ready ---');

})();
