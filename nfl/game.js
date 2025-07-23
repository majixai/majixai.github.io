const FORMATIONS = {
    I_FORM_TWINS: { C: {x:0, y:0}, QB: {x:-2, y:0}, HB: {x:-4, y:0}, WR1: {x:0, y:20}, WR2: {x:0, y:23}, TE: {x:0, y:-8} },
    SHOTGUN_SPREAD: { C: {x:0, y:0}, QB: {x:-5, y:0}, WR1: {x:0, y:22}, WR2: {x:0, y:-22}, WR3: {x:0, y:12}, WR4: {x:0, y:-12} },
    SHOTGUN_TRIPS: { C: {x:0, y:0}, QB: {x:-5, y:0}, WR1: {x:0, y:22}, WR2: {x:0, y:12}, WR3: {x:0, y:28}, WR4: {x:0, y:-22} },
    SINGLEBACK_ACE: { C: {x:0, y:0}, QB: {x:-2, y:0}, HB: {x:-5, y:0}, WR1: {x:0, y:22}, WR2: {x:0, y:-22} },
    PISTOL_ACE: { C: {x:0, y:0}, QB: {x:-3, y:0}, HB: {x:-5, y:0}, WR1: {x:0, y:22}, WR2: {x:0, y:-22}},
    PUNT_FORMATION: { C: {x:0, y:0}, P: {x:-15, y:0} },
    FG_FORMATION: { C: {x:0, y:0}, H: {x:-8, y:0}, K: {x:-10, y:0} },

    DEF_4_3: { DL1: {x:1, y:3}, DL2: {x:1, y:-3}, DL3: {x:1, y:8}, DL4: {x:1, y:-8}, LB1: {x:5, y:0}, LB2: {x:5, y:10}, LB3: {x:5, y:-10}, CB1: {x:1, y:22}, CB2: {x:1, y:-22}, S1: {x:12, y:8}, S2: {x:12, y:-8} },
    DEF_3_4: { DL1: {x:1, y:0}, DL2: {x:1, y:5}, DL3: {x:1, y:-5}, LB1: {x:5, y:3}, LB2: {x:5, y:-3}, LB3: {x:2, y:10}, LB4: {x:2, y:-10}, CB1: {x:1, y:22}, CB2: {x:1, y:-22}, S1: {x:12, y:0} },
    DEF_NICKEL: { DL1: {x:1, y:3}, DL2: {x:1, y:-3}, DL3: {x:1, y:8}, DL4: {x:1, y:-8}, LB1: {x:5, y:5}, LB2: {x:5, y:-5}, CB1: {x:1, y:22}, CB2: {x:1, y:-22}, CB3: {x:5, y:12}, S1: {x:12, y:8}, S2: {x:12, y:-8} },
    DEF_PUNT_RETURN: { R: {x:40, y:0} },
    DEF_FG_BLOCK: { DL1: {x:1, y:0}, DL2: {x:1, y:3}, DL3: {x:1, y:-3} }
};

const ROUTES = {
    // Short
    SLANT: [{x:3, y:2}],
    OUT: [{x:5, y:0}, {x:5, y:5}],
    IN: [{x:5, y:0}, {x:5, y:-5}],
    DRAG: [{x:4, y:-8}],
    FLAT: [{x:1, y:4}],
    SCREEN: [{x:-2, y:3}],
    // Medium
    CURL: [{x:12, y:0}, {x:10, y:0}],
    COMEBACK: [{x:15, y:0}, {x:13, y:3}],
    POST: [{x:12, y:0}, {x:20, y:-5}],
    CORNER: [{x:12, y:0}, {x:20, y:5}],
    SEAM: [{x:22, y:0}],
    // Deep
    GO: [{x:30, y:0}],
    FADE: [{x:25, y:3}],
    POST_CORNER: [{x:12, y:0}, {x:20, y:-5}, {x:25, y:0}],
    OUT_AND_UP: [{x:10,y:0},{x:10,y:5},{x:25,y:5}],
    // HB
    DIVE: [{x:3, y:0}],
    SWEEP: [{x:1, y:5}, {x:10, y:5}],
    SWING: [{x:2, y:5}, {x:8, y:5}],
    BLOCK: [],
};

const PLAYBOOK = {
    // --- OFFENSE: I-FORM ---
    'hb_dive': { id: 'hb_dive', name: 'HB Dive', description: 'A direct run up the middle.', type: 'offense_run', formation: FORMATIONS.I_FORM_TWINS, formationName: 'I-Form', playCategory: 'Run', audibles: ['play_action', 'pitch_right'], routes: { HB: ROUTES.DIVE } },
    'play_action': { id: 'play_action', name: 'PA Boot', description: 'Fake the run, QB rolls out to pass.', type: 'offense_pass', formation: FORMATIONS.I_FORM_TWINS, formationName: 'I-Form', playCategory: 'Deep Pass', audibles: ['deep_bomb', 'hb_dive'], routes: { WR1: ROUTES.POST, TE: ROUTES.FLAT }, assignments: { WR1: { passButton: 'c' }, TE: { passButton: 'b' } } },
    'pitch_right': { id: 'pitch_right', name: 'HB Toss', description: 'Toss the ball to the HB running wide.', type: 'offense_run', formation: FORMATIONS.I_FORM_TWINS, formationName: 'I-Form', playCategory: 'Run', audibles: ['hb_dive', 'qb_sneak'], routes: { HB: ROUTES.SWEEP } },
    'te_attack': { id: 'te_attack', name: 'TE Attack', description: 'Routes designed to get the TE open.', type: 'offense_pass', formation: FORMATIONS.I_FORM_TWINS, formationName: 'I-Form', playCategory: 'Short Pass', audibles: ['hb_dive', 'pitch_right'], routes: { TE: ROUTES.CORNER, WR1: ROUTES.SLANT, WR2: ROUTES.GO }, assignments: { TE: { passButton: 'c' }, WR1: { passButton: 'b' } } },

    // --- OFFENSE: SHOTGUN ---
    'four_verts': { id: 'four_verts', name: 'Four Verticals', description: 'All four receivers run deep go routes.', type: 'offense_pass', formation: FORMATIONS.SHOTGUN_SPREAD, formationName: 'Shotgun', playCategory: 'Deep Pass', audibles: ['stick', 'wr_screen'], routes: { WR1: ROUTES.GO, WR2: ROUTES.GO, WR3: ROUTES.SEAM, WR4: ROUTES.SEAM }, assignments: { WR1: { passButton: 'd' }, WR2: { passButton: 'b' }, WR3: { passButton: 'c' } } },
    'stick': { id: 'stick', name: 'Stick', description: 'Quick pass concept with a vertical and a flat route.', type: 'offense_pass', formation: FORMATIONS.SHOTGUN_TRIPS, formationName: 'Shotgun', playCategory: 'Short Pass', audibles: ['four_verts', 'hb_draw'], routes: { WR1: ROUTES.GO, WR2: ROUTES.OUT, WR3: ROUTES.FLAT }, assignments: { WR2: { passButton: 'c' }, WR3: { passButton: 'b' } } },
    'wr_screen': { id: 'wr_screen', name: 'WR Screen', description: 'Quick throw to a WR behind blockers.', type: 'offense_pass', formation: FORMATIONS.SHOTGUN_SPREAD, formationName: 'Shotgun', playCategory: 'Short Pass', audibles: ['four_verts', 'hb_draw'], routes: { WR1: ROUTES.SCREEN, WR2: ROUTES.BLOCK, WR3: ROUTES.BLOCK }, assignments: { WR1: { passButton: 'b' } } },
    'hb_draw': { id: 'hb_draw', name: 'HB Draw', description: 'Fake a pass and hand off to the HB for a delayed run.', type: 'offense_run', formation: FORMATIONS.SHOTGUN_SPREAD, formationName: 'Shotgun', playCategory: 'Run', audibles: ['four_verts', 'stick'], routes: { HB: ROUTES.DIVE } },
    'mesh': { id: 'mesh', name: 'Mesh', description: 'Two receivers cross paths over the middle.', type: 'offense_pass', formation: FORMATIONS.SHOTGUN_SPREAD, formationName: 'Shotgun', playCategory: 'Short Pass', audibles: ['four_verts', 'stick'], routes: { WR3: [{x:10, y:-10}], WR4: [{x:10, y:10}], WR1: ROUTES.GO, WR2: ROUTES.CURL }, assignments: { WR3: { passButton: 'b' }, WR4: { passButton: 'c' } } },
    'qb_sneak': { id: 'qb_sneak', name: 'QB Sneak', description: 'QB runs forward for a short gain.', type: 'offense_run', formation: FORMATIONS.SHOTGUN_SPREAD, formationName: 'Shotgun', playCategory: 'Run', audibles: [], routes: { QB: [{x:2,y:0}] } },
    'double_outs': { id: 'double_outs', name: 'Double Outs', description: 'Both outside receivers run 10 yard out routes.', type: 'offense_pass', formation: FORMATIONS.SHOTGUN_SPREAD, formationName: 'Shotgun', playCategory: 'Short Pass', audibles: ['mesh', 'hb_draw'], routes: { WR1: ROUTES.OUT, WR2: ROUTES.OUT, WR3: ROUTES.SEAM, WR4: ROUTES.SEAM }, assignments: { WR1: { passButton: 'd' }, WR2: { passButton: 'b' } } },

    // --- OFFENSE: SINGLEBACK ---
    'levels': { id: 'levels', name: 'Levels', description: 'Two receivers run in-breaking routes at different depths.', type: 'offense_pass', formation: FORMATIONS.SINGLEBACK_ACE, formationName: 'Singleback', playCategory: 'Short Pass', audibles: ['pa_cross', 'hb_stretch'], routes: { WR1: ROUTES.IN, WR2: ROUTES.DRAG }, assignments: { WR1: { passButton: 'c' }, WR2: { passButton: 'b' } } },
    'pa_crossers': { id: 'pa_crossers', name: 'PA Crossers', description: 'Play action with receivers crossing deep.', type: 'offense_pass', formation: FORMATIONS.SINGLEBACK_ACE, formationName: 'Singleback', playCategory: 'Deep Pass', audibles: ['levels', 'hb_stretch'], routes: { WR1: ROUTES.POST, WR2: [{x:15, y:15}]}, assignments: { WR1: { passButton: 'c' }, WR2: { passButton: 'b' } } },
    'hb_stretch': { id: 'hb_stretch', name: 'HB Stretch', description: 'Outside run for the halfback.', type: 'offense_run', formation: FORMATIONS.SINGLEBACK_ACE, formationName: 'Singleback', playCategory: 'Run', audibles: ['levels', 'pa_crossers'], routes: { HB: ROUTES.SWEEP } },
    'sluggo': { id: 'sluggo', name: 'Slant and Go', description: 'Receiver fakes a slant then goes deep.', type: 'offense_pass', formation: FORMATIONS.SINGLEBACK_ACE, formationName: 'Singleback', playCategory: 'Deep Pass', audibles: ['levels', 'hb_stretch'], routes: { WR1: [{x:3, y:2}, {x:25,y:2}], WR2: ROUTES.DRAG }, assignments: { WR1: { passButton: 'c' }, WR2: { passButton: 'b' } } },

    // --- OFFENSE: PISTOL ---
    'pistol_pa_seam': { id: 'pistol_pa_seam', name: 'Pistol PA Seams', description: 'Deep shot to the seams out of the pistol formation.', type: 'offense_pass', formation: FORMATIONS.PISTOL_ACE, formationName: 'Pistol', playCategory: 'Deep Pass', audibles: ['pistol_dive', 'pistol_read'], routes: { WR1: ROUTES.SEAM, WR2: ROUTES.SEAM }, assignments: { WR1: { passButton: 'c' }, WR2: { passButton: 'b' } } },
    'pistol_dive': { id: 'pistol_dive', name: 'Pistol Dive', description: 'Quick handoff up the middle from the pistol.', type: 'offense_run', formation: FORMATIONS.PISTOL_ACE, formationName: 'Pistol', playCategory: 'Run', audibles: ['pistol_pa_seam', 'pistol_read'], routes: { HB: ROUTES.DIVE } },

    // --- SPECIAL TEAMS ---
    'field_goal': { id: 'field_goal', name: 'Field Goal', description: 'Attempt a field goal.', type: 'special_teams', formation: FORMATIONS.FG_FORMATION, formationName: 'Field Goal', playCategory: 'Special Teams' },
    'punt': { id: 'punt', name: 'Punt', description: 'Punt the ball downfield.', type: 'special_teams', formation: FORMATIONS.PUNT_FORMATION, formationName: 'Punt', playCategory: 'Special Teams' },

    // --- DEFENSE ---
    'cover_2': { id: 'cover_2', name: 'Cover 2', description: 'Two deep safeties, corners cover the flats.', type: 'defense', formation: FORMATIONS.DEF_4_3, formationName: '4-3', playCategory: 'Zone', assignments: { S1: { cover: 'zone', area: 'deep_half_right' }, S2: { cover: 'zone', area: 'deep_half_left' }, CB1: { cover: 'zone', area: 'flat' }, CB2: { cover: 'zone', area: 'flat' } } },
    'cover_3': { id: 'cover_3', name: 'Cover 3', description: 'Three deep defenders, four underneath.', type: 'defense', formation: FORMATIONS.DEF_4_3, formationName: '4-3', playCategory: 'Zone', assignments: { S1: { cover: 'zone', area: 'deep_middle' }, CB1: { cover: 'zone', area: 'deep_third' }, CB2: { cover: 'zone', area: 'deep_third' } } },
    'man_2_under': { id: 'man_2_under', name: '2 Man Under', description: 'Man coverage with two deep safeties.', type: 'defense', formation: FORMATIONS.DEF_4_3, formationName: '4-3', playCategory: 'Man', assignments: { S1: { cover: 'zone', area: 'deep_half_right' }, S2: { cover: 'zone', area: 'deep_half_left' }, CB1: { cover: 'man', target: 'WR1' }, CB2: { cover: 'man', target: 'WR2' }, LB1: {cover: 'man', target: 'HB'} } },
    'ss_blitz': { id: 'ss_blitz', name: 'SS Blitz', description: 'Strong safety blitzes from the edge.', type: 'defense', formation: FORMATIONS.DEF_4_3, formationName: '4-3', playCategory: 'Blitz', assignments: { S1: { cover: 'blitz' }, CB1: { cover: 'man', target: 'WR1' }, CB2: { cover: 'man', target: 'WR2' } } },
    'cover_1_man': { id: 'cover_1_man', name: 'Cover 1 Man', description: 'Man coverage with a single high safety.', type: 'defense', formation: FORMATIONS.DEF_3_4, formationName: '3-4', playCategory: 'Man', assignments: { S1: { cover: 'zone', area: 'deep_middle' }, CB1: { cover: 'man', target: 'WR1' }, CB2: { cover: 'man', target: 'WR2' }, LB1: {cover: 'man', target: 'HB'}, LB2: {cover: 'man', target: 'TE'} } },
    'olb_fire': { id: 'olb_fire', name: 'OLB Fire', description: 'Outside linebackers blitz.', type: 'defense', formation: FORMATIONS.DEF_3_4, formationName: '3-4', playCategory: 'Blitz', assignments: { LB3: { cover: 'blitz' }, LB4: { cover: 'blitz' }, S1: { cover: 'zone', area: 'deep_middle' } } },
    'nickel_blitz': { id: 'nickel_blitz', name: 'Nickel Blitz', description: 'The nickel corner blitzes from the slot.', type: 'defense', formation: FORMATIONS.DEF_NICKEL, formationName: 'Nickel', playCategory: 'Blitz', assignments: { CB3: { cover: 'blitz' }, S1: { cover: 'zone', area: 'deep_half' }, S2: { cover: 'zone', area: 'deep_half' } } },
    'cover_0_blitz': { id: 'cover_0_blitz', name: 'Cover 0 Blitz', description: 'All-out blitz with no deep help.', type: 'defense', formation: FORMATIONS.DEF_NICKEL, formationName: 'Nickel', playCategory: 'Blitz', assignments: { CB1: { cover: 'man', target: 'WR1' }, CB2: { cover: 'man', target: 'WR2' }, LB1: { cover: 'blitz' }, S1: { cover: 'blitz' } } },
    'punt_return': { id: 'punt_return', name: 'Punt Return', description: 'Set up a return for a punt.', type: 'defense', formation: FORMATIONS.DEF_PUNT_RETURN, formationName: 'Punt Return', playCategory: 'Special Teams' },
    'fg_block': { id: 'fg_block', name: 'FG Block', description: 'Attempt to block a field goal.', type: 'defense', formation: FORMATIONS.DEF_FG_BLOCK, formationName: 'FG Block', playCategory: 'Special Teams' }
};

// --- CONSTANTS & ENUMS ---
const FIELD_WIDTH_YARDS = 120; // 100 field + 2x10 endzones
const FIELD_HEIGHT_YARDS = 53.3;
const YARDS_TO_PIXELS = 10;
const PLAYER_BASE_SPEED = 50; // Adjusted for deltaTime
const BALL_SPEED = 2.5;

const TEAMS = {
    'titans': { name: 'Titans', color: '#FF5733', secondaryColor: '#272727', logo: 'https://i.imgur.com/gC2S1fC.png' },
    'bolts': { name: 'Thunderbolts', color: '#00BFFF', secondaryColor: '#FFD700', logo: 'https://i.imgur.com/gOpinG.png' },
    'vipers': { name: 'Vipers', color: '#DC143C', secondaryColor: '#FFFFFF', logo: 'https://i.imgur.com/AEd3a2h.png' },
    'sharks': { name: 'Sharks', color: '#003366', secondaryColor: '#CCCCCC', logo: 'https://i.imgur.com/e5a2s8W.png' }
};

const GameStatus = { MENU: 0, TEAM_SELECTION: 1, GAME_SETTINGS: 2, DIFFICULTY: 3, KICKOFF: 4, PLAY_SELECTION: 5, AUDIBLE_SELECTION: 6, PRE_SNAP: 7, PLAY_IN_PROGRESS: 8, POST_PLAY: 9, CONVERSION_CHOICE: 10, KICK_METER: 11, GAME_OVER: 12 };

// --- CONTROLLER ---
class Controller {
    constructor() {
        this.directions = { up: false, down: false, left: false, right: false };
        this.actions = { a: false, b: false, c: false, d: false, audible: false };
        this.keyMap = { 'w': 'up', 's': 'down', 'a': 'left', 'd': 'right', 'ArrowUp': 'up', 'ArrowDown': 'down', 'ArrowLeft': 'left', 'ArrowRight': 'right', ' ': 'a', 'j': 'b', 'k': 'c', 'l': 'd', 'Tab': 'audible' };
        this.addListeners();
    }
    addListeners() {
        document.addEventListener('keydown', e => this.updateKeyState(e.key, true, e));
        document.addEventListener('keyup', e => this.updateKeyState(e.key, false, e));

        const bindButton = (id, action) => {
            const btn = document.getElementById(id);
            if (!btn) return;
            const setAction = (val, e) => {
                e.preventDefault();
                if (action in this.directions) this.directions[action] = val;
                else this.actions[action] = val;
            };
            btn.addEventListener('touchstart', e => setAction(true, e), { passive: false });
            btn.addEventListener('touchend', e => setAction(false, e));
            btn.addEventListener('mousedown', e => setAction(true, e));
            btn.addEventListener('mouseup', e => setAction(false, e));
            btn.addEventListener('mouseleave', e => setAction(false, e));
        };

        bindButton('up-btn', 'up'); bindButton('down-btn', 'down');
        bindButton('left-btn', 'left'); bindButton('right-btn', 'right');
        bindButton('a-button', 'a'); bindButton('b-button', 'b');
        bindButton('c-button', 'c'); bindButton('d-button', 'd');
        bindButton('audible-btn', 'audible');
    }
    updateKeyState(key, isPressed, e) {
        const action = this.keyMap[key];
        if (!action) return;
        e.preventDefault();
        if (action in this.directions) this.directions[action] = isPressed;
        else this.actions[action] = isPressed;
    }
}

// --- AI COACH ---
class AICoach {
    constructor() {
        this.difficulty = 'medium';
    }
    setDifficulty(d) { this.difficulty = d; }

    choosePlay(gameState, availablePlays, playType) {
        const playObjects = availablePlays.map(id => PLAYBOOK[id]);

        const playScores = playObjects.map(play => {
            const score = this.calculatePlayScore(play, gameState, playType);
            const weight = this.difficulty === 'easy' ? score : this.difficulty === 'medium' ? Math.pow(score, 2) : this.difficulty === 'hard' ? Math.pow(score, 3) : score;
            return { playId: play.id, score: weight };
        });

        const totalScore = playScores.reduce((sum, current) => sum + current.score, 0);
        if (totalScore === 0) {
            return availablePlays[Math.floor(Math.random() * availablePlays.length)];
        }

        let randomVal = Math.random() * totalScore;
        for (const play of playScores) {
            randomVal -= play.score;
            if (randomVal <= 0) {
                return play.playId;
            }
        }

        return playScores[playScores.length - 1].playId;
    }

    calculatePlayScore(play, gameState, playType) {
        let score = 10;

        const { down, yardsToGo, lineOfScrimmage, quarter, gameClock, score: gameScore } = gameState;
        const currentTeamScore = gameState.possession === 'player' ? gameScore.cpu : gameScore.player;
        const opponentScore = gameState.possession === 'player' ? gameScore.player : gameScore.cpu;

        const isLosing = currentTeamScore < opponentScore;
        const isWinning = currentTeamScore > opponentScore;
        const isLateGame = quarter >= 4 || (quarter === 2 && gameClock < 120);

        if (playType === 'offense') {
            if(play.playCategory === 'Special Teams'){
                if(play.id === 'punt') return down === 4 ? 1000 : 0;
                if(play.id === 'field_goal') {
                    if(down === 4 && lineOfScrimmage >= 60) return 1000;
                    return 0;
                }
            }
            if (yardsToGo >= 10) {
                if (play.playCategory === 'Deep Pass') score += 20;
                if (play.playCategory === 'Short Pass') score += 10;
                if (play.playCategory === 'Run') score -= 5;
            } else if (yardsToGo <= 3) {
                if (play.playCategory === 'Run') score += 20;
                if (play.playCategory === 'Short Pass') score += 10;
                if (play.playCategory === 'Deep Pass') score -= 10;
            }

            if (down === 3) {
                 if (yardsToGo >= 8) {
                    if (play.playCategory === 'Deep Pass') score += 30;
                    if (play.playCategory === 'Short Pass') score += 15;
                    if (play.playCategory === 'Run' && play.id !== 'hb_draw') score = 1;
                 } else if (yardsToGo <= 2) {
                    if (play.playCategory === 'Run') score += 30;
                    if (play.playCategory === 'Short Pass') score += 20;
                    if (play.playCategory === 'Deep Pass') score = 1;
                 }
            }

            if (isLateGame && isLosing) {
                if (play.playCategory.includes('Pass')) score += 20;
                if (play.playCategory === 'Run') score -= 10;
            }
            if (isLateGame && isWinning) {
                if (play.playCategory === 'Run') score += 20;
                if (play.playCategory.includes('Pass')) score -= 10;
            }
        } else { // Defense
            if (yardsToGo >= 10) {
                if (play.playCategory === 'Zone') score += 20;
                if (play.playCategory === 'Man') score += 10;
                if (play.playCategory === 'Blitz') score -= 5;
            } else if (yardsToGo <= 3) {
                if (play.playCategory === 'Blitz') score += 20;
                if (play.playCategory === 'Man') score += 15;
                if (play.playCategory === 'Zone') score -= 5;
            }

            if (down === 3) {
                 if (yardsToGo >= 8) {
                    if (play.playCategory === 'Zone') score += 30;
                    if (play.playCategory === 'Man') score += 15;
                    if (play.playCategory === 'Blitz') score += 5;
                 } else if (yardsToGo <= 2) {
                    if (play.playCategory === 'Blitz') score += 30;
                    if (play.playCategory === 'Man') score += 20;
                 }
            }
        }

        return Math.max(1, score);
    }
}

class Player {
    constructor(x, y, team, role, pTeam) {
        this.x = x; this.y = y; this.team = team; this.role = role;
        this.color = pTeam.color; this.secondaryColor = pTeam.secondaryColor;
        this.hasBall = false; this.isControlled = false; this.assignment = {}; this.route = []; this.routeIndex = 0;

        let stats = { speed: 60, strength: 60, agility: 60, awareness: 60, catchRating: 60, throwPower: 20, throwAccuracy: 20 };
        if (role.startsWith('QB')) { stats = { ...stats, speed: 70, agility: 75, awareness: 85, throwPower: 88, throwAccuracy: 85 }; }
        else if (role.startsWith('HB')) { stats = { ...stats, speed: 88, strength: 75, agility: 88, awareness: 75, catchRating: 70 }; }
        else if (role.startsWith('WR')) { stats = { ...stats, speed: 92, agility: 90, awareness: 80, catchRating: 88 }; }
        else if (role.startsWith('TE')) { stats = { ...stats, speed: 80, strength: 82, agility: 75, awareness: 80, catchRating: 85 }; }
        else if (role.startsWith('OL') || role === 'C') { stats = { ...stats, speed: 55, strength: 92, agility: 50, awareness: 70, catchRating: 30 }; }
        else if (role.startsWith('DL')) { stats = { ...stats, speed: 70, strength: 90, agility: 65, awareness: 75 }; }
        else if (role.startsWith('LB')) { stats = { ...stats, speed: 82, strength: 85, agility: 80, awareness: 85, catchRating: 65 }; }
        else if (role.startsWith('CB')) { stats = { ...stats, speed: 91, agility: 88, awareness: 82, catchRating: 70 }; }
        else if (role.startsWith('S')) { stats = { ...stats, speed: 88, agility: 85, awareness: 88, catchRating: 75 }; }
        else if (role === 'K' || role === 'P') { stats = { ...stats, speed: 60, strength: 70, agility: 60, awareness: 80 };}
        Object.assign(this, stats);
    }

    draw(ctx, scale) {
        const r = 8 * scale;
        const headR = 5 * scale;
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, r, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = this.secondaryColor;
        ctx.beginPath();
        ctx.arc(this.x, this.y - r * 0.5, headR, 0, Math.PI * 2);
        ctx.fill();

        if (this.isControlled) {
            ctx.strokeStyle = '#FFFF00'; ctx.lineWidth = 2 * scale;
            ctx.beginPath(); ctx.arc(this.x, this.y, r + 4 * scale, 0, Math.PI * 2); ctx.stroke();
        }

        if (this.assignment.passButton) {
             const buttonColor = { b: '#dc3545', c: '#ffc107', d: '#17a2b8' }[this.assignment.passButton] || 'white';
             ctx.fillStyle = buttonColor;
             ctx.font = `bold ${12 * scale}px ${getComputedStyle(document.body).fontFamily}`;
             ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
             ctx.globalAlpha = 0.9;
             ctx.beginPath();
             ctx.arc(this.x, this.y - r * 2.2, 8*scale, 0, Math.PI * 2);
             ctx.fill();
             ctx.fillStyle = 'white';
             ctx.fillText(this.assignment.passButton.toUpperCase(), this.x, this.y - r * 2.2);
             ctx.globalAlpha = 1.0;
        }
    }
}

class Football {
    constructor() {
        this.x = 0; this.y = 0; this.z = 0;
        this.targetX = 0; this.targetY = 0;
        this.inAir = false; this.speed = BALL_SPEED;
        this.startX = 0; this.startY = 0;
    }

    update(deltaTime, scale) {
        if (!this.inAir) return;
        const dx = this.targetX - this.x, dy = this.targetY - this.y;
        const dist = Math.hypot(dx, dy);
        const totalDist = Math.hypot(this.targetX - this.startX, this.targetY - this.startY);
        const moveSpeed = this.speed * scale * 100 * deltaTime;

        if (dist < moveSpeed) {
             this.inAir = false; this.x = this.targetX; this.y = this.targetY; this.z = 0;
        } else {
            this.x += (dx / dist) * moveSpeed;
            this.y += (dy / dist) * moveSpeed;
            const progress = Math.hypot(this.x - this.startX, this.y - this.startY) / totalDist;
            this.z = Math.sin(progress * Math.PI) * (totalDist * 0.2);
        }
    }
    draw(ctx, scale) {
        if(this.inAir){
            ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath();
            ctx.ellipse(this.x, this.y, 4 * scale * (1 + this.z/50), 2 * scale * (1 + this.z/50), 0, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.fillStyle = '#A52A2A'; ctx.beginPath();
        ctx.ellipse(this.x, this.y - this.z, 4 * scale, 2.5 * scale, -Math.PI/4, 0, Math.PI * 2);
        ctx.fill();
    }
    throw(startX, startY, targetX, targetY, targetPlayer) {
        this.inAir = true;
        this.x = startX; this.y = startY;
        this.startX = startX; this.startY = startY;
        this.targetX = targetX; this.targetY = targetY;
        this.targetPlayer = targetPlayer;
        this.z = 0;
    }
}


// --- APP CLASS ---
class App {
    static main() {
        const aiCoach = new AICoach();
        App.game = Game.getInstance(aiCoach);
        App.setupEventListeners();
        App.populateTeamSelection();
        App.showScreen('main-menu-screen');
    }
    static setupEventListeners() {
        document.getElementById('play-cpu-btn').onclick = () => App.showScreen('team-selection-screen');
        document.getElementById('high-scores-btn').onclick = () => App.showScreen('high-scores-screen');
        document.getElementById('back-to-menu-from-scores-btn').onclick = () => App.showScreen('main-menu-screen');
        document.getElementById('back-to-menu-from-teams-btn').onclick = () => App.showScreen('main-menu-screen');
        document.getElementById('back-to-menu-from-game-over-btn').onclick = () => {
             document.getElementById('game-over-modal').style.display = 'none';
             App.showScreen('main-menu-screen');
        };

        document.getElementById('extra-point-btn').onclick = () => App.game.handleConversionChoice('kick');
        document.getElementById('two-point-btn').onclick = () => App.game.handleConversionChoice('2pt');

        const qSlider = document.getElementById('quarter-length-slider');
        qSlider.oninput = () => { document.getElementById('quarter-length-value').textContent = qSlider.value; };

        document.getElementById('continue-to-difficulty-btn').onclick = () => App.showScreen('difficulty-screen');

        document.querySelectorAll('.difficulty-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const difficulty = btn.dataset.difficulty;
                if (!App.playerTeamId) App.playerTeamId = 'titans';
                const availableCpuTeams = Object.keys(TEAMS).filter(id => id !== App.playerTeamId);
                const cpuTeamId = availableCpuTeams[Math.floor(Math.random() * availableCpuTeams.length)];
                const quarterLength = parseInt(document.getElementById('quarter-length-slider').value);
                App.game.start(App.playerTeamId, cpuTeamId, difficulty, quarterLength);
            });
        });
    }
    static populateTeamSelection() {
        const list = document.getElementById('team-list');
        list.innerHTML = '';
        Object.entries(TEAMS).forEach(([id, team]) => {
            const card = document.createElement('div');
            card.className = 'team-card';
            card.innerHTML = `<div class="team-logo-lg" style="background-image: url(${team.logo})"></div><h4>${team.name}</h4>`;
            card.onclick = () => {
                document.querySelectorAll('.team-card').forEach(c => c.classList.remove('selected'));
                card.classList.add('selected');
                App.playerTeamId = id;
                App.showScreen('game-settings-screen');
            };
            list.appendChild(card);
        });
    }

    static showScreen(screenId) {
        document.querySelectorAll('.screen').forEach(s => s.style.display = 'none');
        const screen = document.getElementById(screenId);
        if(screen) {
            screen.style.display = 'flex';
            if (!screenId.includes('game')) screen.style.flexDirection = 'column';
        }
    }

    static showPlaySelectionModal(plays, onSelect, side, isAudible = false) {
        const modal = document.getElementById(isAudible ? 'audible-modal' : 'play-selection-modal');
        const listContainer = document.getElementById(isAudible ? 'audible-list' : 'play-list');
        const filterContainer = document.getElementById(isAudible ? 'play-filters-audible' : 'play-filters');

        const titleEl = document.getElementById(isAudible ? 'audible-selection-title' : 'play-selection-title');
        titleEl.textContent = isAudible ? 'Choose an Audible' : side === 'offense' ? 'Choose Your Offensive Play' : 'Choose Your Defensive Play';

        const render = () => {
            listContainer.innerHTML = '';

            const filteredPlays = plays.filter(p =>
                (App.currentPlayFilters.type === 'all' || p.playCategory === App.currentPlayFilters.type) &&
                (App.currentPlayFilters.formation === 'all' || p.formationName === App.currentPlayFilters.formation)
            );

            filteredPlays.forEach(play => {
                const card = document.createElement('div');
                card.className = 'play-card';
                const svgArt = App.generatePlayArtSVG(play, side);
                card.innerHTML = `
                    <div class="play-art-svg-small">${svgArt}</div>
                    <div class="play-card-name">${play.name}</div>
                    <div class="play-card-desc">${play.description}</div>
                `;
                card.onclick = () => { onSelect(play.id); modal.style.display = 'none'; };
                listContainer.appendChild(card);
            });
        };

        const formations = [...new Set(plays.map(p => p.formationName))].filter(f=>f);
        const categories = [...new Set(plays.map(p => p.playCategory))].filter(c=>c);

        filterContainer.innerHTML = `
            <div class="filter-group">
                <button class="filter-btn ${App.currentPlayFilters.type === 'all' ? 'active' : ''}" data-filter-type="type" data-filter-value="all">All Types</button>
                ${categories.map(c => `<button class="filter-btn ${App.currentPlayFilters.type === c ? 'active' : ''}" data-filter-type="type" data-filter-value="${c}">${c}</button>`).join('')}
            </div>
            <div class="filter-group">
                <button class="filter-btn ${App.currentPlayFilters.formation === 'all' ? 'active' : ''}" data-filter-type="formation" data-filter-value="all">All Formations</button>
                ${formations.map(f => `<button class="filter-btn ${App.currentPlayFilters.formation === f ? 'active' : ''}" data-filter-type="formation" data-filter-value="${f}">${f}</button>`).join('')}
            </div>
        `;

        filterContainer.querySelectorAll('.filter-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const target = e.currentTarget;
                const filterType = target.dataset.filterType;
                const filterValue = target.dataset.filterValue;
                App.currentPlayFilters[filterType] = filterValue;
                filterContainer.querySelectorAll(`.filter-btn[data-filter-type="${filterType}"]`).forEach(b => b.classList.remove('active'));
                target.classList.add('active');
                render();
            });
        });

        if (isAudible) {
            document.getElementById('cancel-audible-btn').onclick = () => {
                modal.style.display = 'none';
                App.game['status'] = GameStatus.PRE_SNAP;
            }
        }

        render();
        modal.style.display = 'flex';
    }

    static generatePlayArtSVG(play, side) {
        const width = 200, height = 120;
        const oColor = '#dc3545';
        const dColor = '#00BFFF';
        const routeColor = '#ffc107';
        const scale = { x: 2.5, y: 2 };

        let svg = `<svg class="play-art-svg" viewBox="0 0 ${width} ${height}">`;
        svg += `<rect width="${width}" height="${height}" fill="transparent"/>`;

        const oPlay = side === 'offense' ? play : PLAYBOOK['i_form_twins'];
        const dPlay = side === 'defense' ? play : PLAYBOOK['cover_3'];
        const oFormation = oPlay.formation;
        const dFormation = dPlay.formation;

        // Draw Offense
        Object.entries(oFormation).forEach(([role, pos]) => {
            const cx = width / 2 + pos.y * scale.y;
            const cy = height / 1.5 - pos.x * scale.x;
            svg += `<circle cx="${cx}" cy="${cy}" r="4" fill="${oColor}" />`;

            const route = oPlay.routes?.[role];
            if (route && route.length > 0) {
                let path = `M ${cx} ${cy}`;
                let endPoint = { x: cx, y: cy };
                route.forEach((p) => {
                    endPoint = { x: cx + p.y * scale.y, y: cy - p.x * scale.x };
                    path += ` L ${endPoint.x} ${endPoint.y}`;
                });
                svg += `<path d="${path}" stroke="${routeColor}" stroke-width="1.5" fill="none" stroke-dasharray="2 2"/>`;
                svg += `<circle cx="${endPoint.x}" cy="${endPoint.y}" r="3" fill="${routeColor}" />`;
            }
        });

        // Draw Defense
        Object.entries(dFormation).forEach(([role, pos]) => {
            const cx = width / 2 + pos.y * scale.y;
            const cy = height / 1.5 + pos.x * scale.x + 10;
            svg += `<text x="${cx}" y="${cy+1.5}" font-family="monospace" font-weight="bold" font-size="10" fill="${dColor}" text-anchor="middle">X</text>`;

            const assignment = dPlay.assignments?.[role];
            if (assignment?.cover === 'blitz') {
                 const startY = cy - 5;
                 const endY = cy - 15;
                 svg += `<path d="M ${cx} ${startY} L ${cx} ${endY}" stroke="${dColor}" stroke-width="2" fill="none"/>`;
                 svg += `<path d="M ${cx} ${endY} L ${cx-3} ${endY+3} L ${cx+3} ${endY+3} Z" fill="${dColor}"/>`;
            }
        });

        svg += '</svg>';
        return svg;
    }
}
App.currentPlayFilters = { type: 'all', formation: 'all' };

document.addEventListener('DOMContentLoaded', () => App.main());

[end of nfl/game.js]
