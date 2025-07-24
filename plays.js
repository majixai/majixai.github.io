const formations = {
    "Shotgun": {
        QB: { x: 600, y: 480 }, C: { x: 600, y: 430 }, LG: { x: 550, y: 430 }, RG: { x: 650, y: 430 }, LT: { x: 500, y: 430 }, RT: { x: 700, y: 430 },
        WR1: { x: 150, y: 420 }, WR2: { x: 1050, y: 420 }, WR3: { x: 350, y: 420 }, TE: { x: 750, y: 430 }
    },
    "I-Form": {
        QB: { x: 600, y: 450 }, C: { x: 600, y: 400 }, LG: { x: 550, y: 400 }, RG: { x: 650, y: 400 }, LT: { x: 500, y: 400 }, RT: { x: 700, y: 400 },
        FB: { x: 600, y: 480 }, HB: { x: 600, y: 510 }, WR1: { x: 200, y: 390 }, TE: { x: 750, y: 400 }
    },
    "Singleback": {
        QB: { x: 600, y: 450 }, C: { x: 600, y: 400 }, LG: { x: 550, y: 400 }, RG: { x: 650, y: 400 }, LT: { x: 500, y: 400 }, RT: { x: 700, y: 400 },
        HB: { x: 600, y: 500 }, WR1: { x: 200, y: 390 }, WR2: { x: 1000, y: 390 }, TE: { x: 750, y: 400 }
    },
    "Pistol": {
        QB: { x: 600, y: 460 }, C: { x: 600, y: 400 }, LG: { x: 550, y: 400 }, RG: { x: 650, y: 400 }, LT: { x: 500, y: 400 }, RT: { x: 700, y: 400 },
        HB: { x: 600, y: 500 }, WR1: { x: 200, y: 390 }, WR2: { x: 1000, y: 390 }, TE: { x: 750, y: 400 }
    },
    "Empty": {
        QB: { x: 600, y: 480 }, C: { x: 600, y: 430 }, LG: { x: 550, y: 430 }, RG: { x: 650, y: 430 }, LT: { x: 500, y: 430 }, RT: { x: 700, y: 430 },
        WR1: { x: 150, y: 420 }, WR2: { x: 1050, y: 420 }, WR3: { x: 350, y: 420 }, WR4: {x: 850, y: 420}, TE: { x: 750, y: 430 }
    }
};

const routes = {
    "Fly": (p) => `M ${p.x},${p.y} l 0,-300`,
    "Slant": (p) => `M ${p.x},${p.y} l ${p.x > 600 ? -50 : 50},-50`,
    "Out": (p) => `M ${p.x},${p.y} l 0,-80 l ${p.x > 600 ? 100 : -100},0`,
    "In (Curl)": (p) => `M ${p.x},${p.y} l 0,-120 l ${p.x < 600 ? 50 : -50},0 l 0,-20`,
    "Post": (p) => `M ${p.x},${p.y} l 0,-180 l ${p.x > 600 ? -80 : 80},-80`,
    "Corner": (p) => `M ${p.x},${p.y} l 0,-180 l ${p.x < 600 ? -80 : 80},-80`,
    "HB Dive": (p) => `M ${p.x},${p.y} l 0,-120`,
    "HB Swing": (p) => `M ${p.x},${p.y} c 50,0 80,-20 80,-50`,
    "FB Lead": (p) => `M ${p.x},${p.y} l 0,-100`,
    "Block": (p) => `M ${p.x},${p.y} l 0,-10`,
};

const playbook = [];

// Generate plays to ensure 100+
Object.keys(formations).forEach(formName => {
    const formation = formations[formName];
    const receivers = Object.keys(formation).filter(p => ['WR', 'TE', 'HB', 'FB'].some(prefix => p.startsWith(prefix)));

    if (receivers.length > 0) {
        // Generate around 25 plays per formation
        for (let i = 0; i < 25 ; i++) {
            let playName = `${formName} - `;
            let playRoutes = {};
            let usedRoutes = [];
            let mainReceiverDetermined = false;

            receivers.forEach((receiver) => {
                 const isEligibleReceiver = ['WR', 'TE'].some(prefix => receiver.startsWith(prefix));
                 const isRunningBack = ['HB', 'FB'].some(prefix => receiver.startsWith(prefix));

                 // Define available routes for this position
                 let availableRoutes;
                 if (isRunningBack) {
                    availableRoutes = Object.keys(routes).filter(r => r.includes(receiver.substring(0,2)) || r === 'Block');
                 } else {
                    availableRoutes = Object.keys(routes).filter(r => !r.includes('HB') && !r.includes('FB'));
                 }

                let routeName = availableRoutes[Math.floor(Math.random() * availableRoutes.length)];

                playRoutes[receiver] = routes[routeName];

                if (!mainReceiverDetermined && isEligibleReceiver && routeName !== 'Block') {
                    playName += `${receiver} ${routeName}`;
                    mainReceiverDetermined = true;
                }
            });

            // Ensure play has a descriptive name if no eligible receiver was primary
            if (!mainReceiverDetermined) {
                playName += `Run/Screen Play`;
            }

            playbook.push({ name: playName, formation: formName, routes: playRoutes });
        }
    }
});
