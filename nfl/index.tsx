

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { GoogleGenAI } from "@google/genai";
import { PLAYBOOK, FORMATIONS, ROUTES } from './playbook';

// --- CONSTANTS & ENUMS ---
const API_KEY = process.env.API_KEY;
const FIELD_WIDTH_YARDS = 120; // 100 field + 2x10 endzones
const FIELD_HEIGHT_YARDS = 53.3;
const YARDS_TO_PIXELS = 10;
const PLAYER_BASE_SPEED = 50; // Adjusted for deltaTime
const BALL_SPEED = 2.5;

const TEAMS: { [key: string]: { name: string, color: string, secondaryColor: string, logo: string } } = {
    'titans': { name: 'Titans', color: '#FF5733', secondaryColor: '#272727', logo: 'https://i.imgur.com/gC2S1fC.png' },
    'bolts': { name: 'Thunderbolts', color: '#00BFFF', secondaryColor: '#FFD700', logo: 'https://i.imgur.com/gOpinG.png' },
    'vipers': { name: 'Vipers', color: '#DC143C', secondaryColor: '#FFFFFF', logo: 'https://i.imgur.com/AEd3a2h.png' },
    'sharks': { name: 'Sharks', color: '#003366', secondaryColor: '#CCCCCC', logo: 'https://i.imgur.com/e5a2s8W.png' }
};

enum GameStatus { MENU, TEAM_SELECTION, GAME_SETTINGS, DIFFICULTY, KICKOFF, PLAY_SELECTION, AUDIBLE_SELECTION, PRE_SNAP, PLAY_IN_PROGRESS, POST_PLAY, CONVERSION_CHOICE, KICK_METER, GAME_OVER }
interface GameState { running: boolean; possession: 'player' | 'cpu'; down: number; yardsToGo: number; lineOfScrimmage: number; score: { player: number; cpu: number; }; currentPlay: any; defensivePlay?: any; }

// --- CONTROLLER ---
class Controller {
    public directions = { up: false, down: false, left: false, right: false };
    public actions = { a: false, b: false, c: false, d: false, audible: false };
    private keyMap: { [key: string]: keyof typeof this.actions | keyof typeof this.directions } = { 'w': 'up', 's': 'down', 'a': 'left', 'd': 'right', 'ArrowUp': 'up', 'ArrowDown': 'down', 'ArrowLeft': 'left', 'ArrowRight': 'right', ' ': 'a', 'j': 'b', 'k': 'c', 'l': 'd', 'Tab': 'audible' };
    
    constructor() { this.addListeners(); }
    private addListeners(): void {
        document.addEventListener('keydown', e => this.updateKeyState(e.key, true, e));
        document.addEventListener('keyup', e => this.updateKeyState(e.key, false, e));

        const bindButton = (id: string, action: keyof typeof this.actions | keyof typeof this.directions) => {
            const btn = document.getElementById(id);
            if (!btn) return;
            const setAction = (val: boolean, e: Event) => {
                e.preventDefault();
                if (action in this.directions) this.directions[action as keyof typeof this.directions] = val;
                else this.actions[action as keyof typeof this.actions] = val;
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
    private updateKeyState(key: string, isPressed: boolean, e: KeyboardEvent) {
        const action = this.keyMap[key];
        if (!action) return;
        e.preventDefault();
        if (action in this.directions) this.directions[action as keyof typeof this.directions] = isPressed;
        else this.actions[action as keyof typeof this.actions] = isPressed;
    }
}

// --- AI COACH ---
class AICoach {
    private difficulty: 'easy' | 'medium' | 'hard' = 'medium';
    private useGenAI: boolean = true;
    
    constructor() { if (!API_KEY) console.warn("API_KEY not set, Gemini functionality will be disabled."); }
    public setDifficulty(d: 'easy' | 'medium' | 'hard'): void { this.difficulty = d; }
    public setUseGenAI(useGenAI: boolean): void { this.useGenAI = useGenAI; }

    public choosePlay(gameState: any, availablePlays: string[], playType: 'offense' | 'defense'): string {
        if (!this.useGenAI || !API_KEY) {
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

    private calculatePlayScore(play: any, gameState: any, playType: 'offense' | 'defense'): number {
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
    x: number; y: number; team: 'player' | 'cpu'; role: string; color: string; secondaryColor: string;
    hasBall = false; isControlled = false; assignment: any = {}; route: {x:number, y:number}[] = []; routeIndex = 0;
    speed: number; strength: number; agility: number; awareness: number; catchRating: number; throwPower: number; throwAccuracy: number;

    constructor(x: number, y: number, team: 'player' | 'cpu', role: string, pTeam: any) {
        this.x = x; this.y = y; this.team = team; this.role = role;
        this.color = pTeam.color; this.secondaryColor = pTeam.secondaryColor;
        
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

    draw(ctx: CanvasRenderingContext2D, scale: number): void {
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
    x: number = 0; y: number = 0; z: number = 0;
    targetX: number = 0; targetY: number = 0;
    inAir = false; speed = BALL_SPEED;
    targetPlayer?: Player;
    
    update(deltaTime: number, scale: number) {
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
    draw(ctx: CanvasRenderingContext2D, scale: number) {
        if(this.inAir){
            ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath();
            ctx.ellipse(this.x, this.y, 4 * scale * (1 + this.z/50), 2 * scale * (1 + this.z/50), 0, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.fillStyle = '#A52A2A'; ctx.beginPath();
        ctx.ellipse(this.x, this.y - this.z, 4 * scale, 2.5 * scale, -Math.PI/4, 0, Math.PI * 2);
        ctx.fill();
    }
    throw(startX: number, startY: number, targetX: number, targetY: number, targetPlayer: Player) {
        this.inAir = true;
        this.x = startX; this.y = startY;
        this.startX = startX; this.startY = startY;
        this.targetX = targetX; this.targetY = targetY;
        this.targetPlayer = targetPlayer;
        this.z = 0;
    }
    private startX: number = 0;
    private startY: number = 0;
}

// --- MAIN GAME CLASS ---
class Game {
    private static instance: Game;
    private canvas: HTMLCanvasElement; private ctx: CanvasRenderingContext2D;
    private controller: Controller; private aiCoach: AICoach;
    private homeTeam: any; private awayTeam: any; private players: Player[] = []; private football: Football;
    private status: GameStatus = GameStatus.MENU;
    private gameClock: number = 0; private quarter: number = 1; private quarterLength: number = 240;
    private gameState: GameState;
    private lastFrameTime = 0;
    private playerMotionTarget: Player | null = null;
    private kickPower = 0; private kickAccuracy = 0; private kickMeterPhase: 'power' | 'accuracy' | 'inactive' = 'inactive';
    
    private constructor(aiCoach: AICoach) {
        this.canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
        this.ctx = this.canvas.getContext('2d')!;
        this.controller = new Controller();
        this.aiCoach = aiCoach;
        this.football = new Football();
        this.gameState = { running: false, possession: 'player', down: 1, yardsToGo: 10, lineOfScrimmage: 25, score: { player: 0, cpu: 0 }, currentPlay: null };
    }
    public static getInstance(aiCoach: AICoach): Game {
        if (!Game.instance) Game.instance = new Game(aiCoach);
        return Game.instance;
    }
    public start(playerTeamId: string, cpuTeamId: string, difficulty: 'easy'|'medium'|'hard', qLength: number, useGenAI: boolean): void {
        this.homeTeam = TEAMS[playerTeamId]; this.awayTeam = TEAMS[cpuTeamId];
        this.aiCoach.setDifficulty(difficulty);
        this.aiCoach.setUseGenAI(useGenAI);
        this.quarterLength = qLength * 60;
        this.gameClock = this.quarterLength; this.quarter = 1;
        this.gameState = { running: true, possession: 'player', down: 1, yardsToGo: 10, lineOfScrimmage: 25, score: { player: 0, cpu: 0 }, currentPlay: null, defensivePlay: null };
        
        App.showScreen('game-screen');
        this.resizeCanvas();
        window.addEventListener('resize', this.resizeCanvas);
        
        this.prepareForPlay();
        requestAnimationFrame(this.gameLoop);
    }
    
    private resizeCanvas = () => {
        const container = document.getElementById('field-container')!;
        const containerWidth = container.clientWidth;
        const containerHeight = container.clientHeight;
    
        const fieldAspectRatio = FIELD_WIDTH_YARDS / FIELD_HEIGHT_YARDS;
        const containerAspectRatio = containerWidth / containerHeight;
    
        if (containerAspectRatio > fieldAspectRatio) {
            this.canvas.height = containerHeight;
            this.canvas.width = containerHeight * fieldAspectRatio;
        } else {
            this.canvas.width = containerWidth;
            this.canvas.height = containerWidth / fieldAspectRatio;
        }
    }

    private gameLoop = (timestamp: number): void => {
        if (!this.gameState.running) return;
        if (!this.lastFrameTime) this.lastFrameTime = timestamp;
        const deltaTime = (timestamp - this.lastFrameTime) / 1000;
        this.lastFrameTime = timestamp;

        this.update(deltaTime);
        this.render();
        requestAnimationFrame(this.gameLoop);
    }
    
    private update(deltaTime: number) {
        if (this.status === GameStatus.PRE_SNAP) { this.handlePreSnapInput(); } 
        else if (this.status === GameStatus.PLAY_IN_PROGRESS) {
            this.updatePlayInProgress(deltaTime);
        } else if (this.status === GameStatus.KICK_METER) {
            this.updateKickMeter(deltaTime);
            this.handleKickInput();
        }
        this.updateScoreboard();
    }

    private runClock(playSeconds: number) {
        this.gameClock -= playSeconds;
         if (this.gameClock <= 0) {
            this.quarter++;
            if (this.quarter > 4) { this.endGame("Time Expired"); } 
            else {
                this.gameClock = this.quarterLength;
                this.showNotification(`End of Q${this.quarter - 1}`);
                if (this.quarter === 3) { // Halftime possession change
                     this.gameState.possession = this.gameState.possession === 'player' ? 'cpu' : 'player';
                }
                this.status = GameStatus.POST_PLAY;
                setTimeout(() => this.startKickoff(), 2000);
            }
        }
    }
    
    private handlePreSnapInput() {
        if (this.controller.actions.a) { this.hikeBall(); this.controller.actions.a = false; return; }
        if (this.controller.actions.audible) { this.showAudibleSelection(); this.controller.actions.audible = false; return; }
        
        if (this.gameState.possession === 'player' && this.gameState.currentPlay.type.startsWith('offense')) {
            if (!this.playerMotionTarget) { this.playerMotionTarget = this.players.find(p => p.team === 'player' && p.role.startsWith('WR')) ?? null; }
            if (this.playerMotionTarget) {
                const scale = this.getScale();
                const motionSpeed = 3 * scale;
                if (this.controller.directions.left) this.playerMotionTarget.y -= motionSpeed;
                if (this.controller.directions.right) this.playerMotionTarget.y += motionSpeed;
            }
        }
    }

    private updatePlayInProgress(deltaTime: number) {
        this.runClock(deltaTime);
        const scale = this.getScale();
        const wasInAir = this.football.inAir;
        
        this.players.forEach(p => this.updatePlayerLogic(p, deltaTime, scale));
        this.football.update(deltaTime, scale);
        
        if (wasInAir && !this.football.inAir && this.football.targetPlayer) {
            const target = this.football.targetPlayer;
            const defender = this.players.find(p => p.team !== target.team && Math.hypot(p.x - target.x, p.y - target.y) < 15 * scale);
            const catchChance = (target.catchRating / 100) * 0.9 - (defender ? defender.awareness / 400 : 0) + (Math.random() * 0.1 - 0.05);

            if (Math.random() < catchChance) {
                this.completePass(target);
            } else {
                // Check for interception
                if (defender && Math.random() < (defender.catchRating / 100) * 0.5) {
                    this.completePass(defender);
                } else {
                    this.incompletePass();
                }
            }
            return;
        }

        const ballCarrier = this.players.find(p => p.hasBall);
        if (ballCarrier) {
            this.players.filter(d => d.team !== ballCarrier.team).forEach(defender => {
                if (Math.hypot(ballCarrier.x - defender.x, ballCarrier.y - defender.y) < 8 * scale) {
                     const breakChance = (ballCarrier.agility + ballCarrier.strength) / (defender.strength * 2.5) + (Math.random() * 0.1 - 0.05);
                     if (Math.random() > breakChance * 0.1) {
                         this.triggerScreenShake(); this.endPlay(ballCarrier); return;
                     }
                }
            });
            const yardLine = (ballCarrier.x / scale / YARDS_TO_PIXELS) - 10;
            if (yardLine >= 100) { this.endPlay(ballCarrier, true); return; }
            if (ballCarrier.y < 0 || ballCarrier.y > this.canvas.height) { this.endPlay(ballCarrier); return; }
        }
        
        if(this.gameState.currentPlay?.type !== 'offense_run' && !this.football.inAir && this.players.find(p=>p.role.startsWith('QB'))?.hasBall) {
            ['b', 'c', 'd'].forEach((button: 'b'|'c'|'d') => {
                 if (this.controller.actions[button]) {
                    const target = this.players.find(p => p.assignment.passButton === button);
                    if (target) this.throwBall(target);
                    this.controller.actions[button] = false;
                }
            });
        }
    }
    
    private updatePlayerLogic(player: Player, deltaTime: number, scale: number) {
        const baseSpeed = PLAYER_BASE_SPEED * (player.speed / 100);
        const speed = baseSpeed * scale * deltaTime;

        if (player.isControlled && player.hasBall) {
            // Player has limited control over the runner
            if (this.controller.directions.left) player.y -= speed * 0.5;
            if (this.controller.directions.right) player.y += speed * 0.5;
            
            // AI controls forward movement
            player.x += speed;

        } else {
            const ballCarrier = this.players.find(p => p.hasBall);
            const isOffense = player.team === this.gameState.possession;
            
            if (!isOffense) { // AI Defense
                const assignment = player.assignment;
                if (assignment?.cover === 'man' && !ballCarrier) {
                    const target = this.players.find(p => p.role === assignment.target && p.team !== player.team);
                    if (target) this.moveTowards(player, target, speed * 0.98);
                } else if (assignment?.cover === 'blitz') {
                    const qb = this.players.find(p => p.role.startsWith('QB') && p.team !== player.team && !p.hasBall);
                    this.moveTowards(player, ballCarrier ?? qb, speed * 1.1);
                } else {
                    if (ballCarrier) this.moveTowards(player, ballCarrier, speed * 0.9);
                }
            } else if (isOffense && !player.hasBall && this.status === GameStatus.PLAY_IN_PROGRESS) { // AI Offense
                if(player.route.length > player.routeIndex) {
                    const targetPoint = player.route[player.routeIndex];
                    const worldTarget = { 
                        x: player.assignment.startX + targetPoint.y * YARDS_TO_PIXELS * scale,
                        y: player.assignment.startY - targetPoint.x * YARDS_TO_PIXELS * scale
                    };
                    this.moveTowards(player, worldTarget, speed);
                    if(Math.hypot(player.x - worldTarget.x, player.y - worldTarget.y) < speed * 2) {
                        player.routeIndex++;
                    }
                }
            }
        }
    }
    private moveTowards(p: Player, target: { x: number, y: number } | undefined, speed: number) {
        if (!target) return;
        const dx = target.x - p.x, dy = target.y - p.y;
        const dist = Math.hypot(dx, dy);
        if (dist > speed) { p.x += (dx / dist) * speed; p.y += (dy / dist) * speed; }
    }
    
    private render(): void {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.drawField();
        
        this.players.filter(p => p.y < this.football.y + this.football.z).forEach(player => player.draw(this.ctx, this.getScale()));
        if(this.football.inAir || this.players.some(p => p.hasBall)) this.football.draw(this.ctx, this.getScale());
        this.players.filter(p => p.y >= this.football.y + this.football.z).forEach(player => player.draw(this.ctx, this.getScale()));
    }

    private drawField(): void {
        const scale = this.getScale();
        this.ctx.fillStyle = '#4a7f3d'; this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.fillStyle = '#639a55';
        for(let i = 0; i < this.canvas.width; i+= 20 * scale) {
            this.ctx.fillRect(i, 0, 10 * scale, this.canvas.height);
        }
        this.ctx.fillStyle = this.homeTeam.color; this.ctx.globalAlpha = 0.6;
        this.ctx.fillRect(0, 0, 10 * YARDS_TO_PIXELS * scale, this.canvas.height);
        this.ctx.fillStyle = this.awayTeam.color;
        this.ctx.fillRect(110 * YARDS_TO_PIXELS * scale, 0, 10 * YARDS_TO_PIXELS * scale, this.canvas.height);
        this.ctx.globalAlpha = 1.0;
        
        this.ctx.strokeStyle = 'rgba(255,255,255,0.6)'; this.ctx.lineWidth = 1;
        for (let y = 10; y <= 110; y += 5) {
            const x = y * YARDS_TO_PIXELS * scale;
            this.ctx.beginPath(); this.ctx.moveTo(x, 0); this.ctx.lineTo(x, this.canvas.height); this.ctx.stroke();
        }
        const losX = (this.gameState.lineOfScrimmage + 10) * YARDS_TO_PIXELS * scale;
        this.ctx.strokeStyle = '#3399FF'; this.ctx.lineWidth = 3 * scale;
        this.ctx.beginPath(); this.ctx.moveTo(losX, 0); this.ctx.lineTo(losX, this.canvas.height); this.ctx.stroke();
        
        const firstDownX = (this.gameState.lineOfScrimmage + this.gameState.yardsToGo + 10) * YARDS_TO_PIXELS * scale;
        if (firstDownX < 110 * YARDS_TO_PIXELS * scale) {
            this.ctx.strokeStyle = '#FFFF00'; this.ctx.lineWidth = 3 * scale;
            this.ctx.beginPath(); this.ctx.moveTo(firstDownX, 0); this.ctx.lineTo(firstDownX, this.canvas.height); this.ctx.stroke();
        }
    }
    
    private prepareForPlay() {
        this.status = GameStatus.PLAY_SELECTION;
        this.playerMotionTarget = null;
        this.runClock(Math.random() * 5 + 10);

        if (this.gameState.possession === 'player') {
            let plays = Object.values(PLAYBOOK).filter(p => p.type.startsWith('offense'));
            if(this.gameState.down === 4 && this.gameState.lineOfScrimmage >= 20) {
                 plays.push(PLAYBOOK['field_goal'], PLAYBOOK['punt']);
            }
            this.showPlaySelection(plays, 'offense');
        } else { // Player on defense
            let cpuOffensivePlays = Object.values(PLAYBOOK).filter(p => p.type.startsWith('offense')).map(p => p.id);
            if(this.gameState.down === 4 && this.gameState.lineOfScrimmage >= 20) {
                 cpuOffensivePlays.push('field_goal', 'punt');
            }
            const cpuPlayId = this.aiCoach.choosePlay(this.gameState, cpuOffensivePlays, 'offense');
            this.gameState.currentPlay = PLAYBOOK[cpuPlayId];
            if(this.gameState.currentPlay.type === 'special_teams') {
                this.handleCpuSpecialTeams();
                return;
            }
            const playerDefensivePlays = Object.values(PLAYBOOK).filter(p => p.type === 'defense');
            this.showPlaySelection(playerDefensivePlays, 'defense');
        }
    }

    private showPlaySelection(plays: any[], side: 'offense' | 'defense') {
        App.showPlaySelectionModal(plays, playId => {
            if (playId === 'field_goal' || playId === 'punt') {
                this.startKick(playId);
            } else if (side === 'offense') {
                this.selectOffensivePlay(playId);
            } else {
                this.selectDefensivePlay(playId);
            }
        }, side);
    }
    
    private showAudibleSelection() {
        this.status = GameStatus.AUDIBLE_SELECTION;
        const basePlay = this.gameState.possession === 'player' ? this.gameState.currentPlay : this.gameState.defensivePlay;
        const audibleIds = basePlay.audibles ?? [];
        const audiblePlays = audibleIds.map((id:string) => PLAYBOOK[id]);

        App.showPlaySelectionModal(audiblePlays, playId => {
            if (this.gameState.possession === 'player') {
                this.gameState.currentPlay = PLAYBOOK[playId];
            } else { 
                this.gameState.defensivePlay = PLAYBOOK[playId];
            }
            this.setupFormation();
        }, this.gameState.possession === 'player' ? 'offense' : 'defense', true);
    }

    private selectOffensivePlay(playerPlayId: string) {
        this.gameState.currentPlay = PLAYBOOK[playerPlayId];
        const defensivePlays = Object.values(PLAYBOOK).filter(p => p.type === 'defense').map(p => p.id);
        this.gameState.defensivePlay = PLAYBOOK[this.aiCoach.choosePlay(this.gameState, defensivePlays, 'defense')];
        this.setupFormation();
    }
    
    private selectDefensivePlay(playerPlayId: string) {
        this.gameState.defensivePlay = PLAYBOOK[playerPlayId];
        this.setupFormation();
    }
    
    private setupFormation(play: any = null) {
        this.players = [];
        this.football.inAir = false;
        const scale = this.getScale();
        const losX = (this.gameState.lineOfScrimmage + 10) * YARDS_TO_PIXELS * scale;
        const centerY = this.canvas.height / 2;
        
        const currentPlay = play ?? (this.gameState.possession === 'player' ? this.gameState.currentPlay : this.gameState.defensivePlay);
        const formation = currentPlay.formation;
        
        const [team, teamName] = this.gameState.possession === 'player' ? [this.homeTeam, 'player' as const] : [this.awayTeam, 'cpu' as const];
        
        Object.entries(formation).forEach(([role, pos]: [string, any]) => {
            const p = new Player(losX + (pos.x * scale), centerY + (pos.y * scale), teamName, role, team);
            this.players.push(p);
        });

        if (play) {
            this.status = GameStatus.KICK_METER;
            this.kickMeterPhase = 'power';
            this.kickPower = 0;
            document.getElementById('kick-meter-container')!.style.display = 'flex';
        } else {
             const [offTeam, defTeam] = this.gameState.possession === 'player' ? [this.homeTeam, this.awayTeam] : [this.awayTeam, this.homeTeam];
             const [offTeamName, defTeamName] = this.gameState.possession === 'player' ? ['player', 'cpu'] as const : ['cpu', 'player'] as const;

            const setupSide = (p: any, tN: 'player'|'cpu', tD: any, isOff: boolean) => {
                 Object.entries(p.formation).forEach(([role, pos]: [string, any]) => {
                    const player = new Player(losX + (pos.x * scale * (isOff ? 1 : -1)), centerY + (pos.y * scale), tN, role, tD);
                    player.assignment = { ...p.assignments?.[role] };
                    if (isOff) player.route = p.routes?.[role] ?? [];
                    player.routeIndex = 0;
                    player.assignment.startX = player.x;
                    player.assignment.startY = player.y;
                    this.players.push(player);
                });
            };
            this.players = [];
            setupSide(this.gameState.currentPlay, offTeamName, offTeam, true);
            setupSide(this.gameState.defensivePlay, defTeamName, defTeam, false);
            this.status = GameStatus.PRE_SNAP;
        }
    }
    
    private hikeBall() {
        if(this.status !== GameStatus.PRE_SNAP) return;
        this.status = GameStatus.PLAY_IN_PROGRESS;
        this.lastFrameTime = performance.now();
        
        const qb = this.players.find(p => p.role.startsWith('QB') && p.team === this.gameState.possession);
        if (!qb) return;
        
        const ballCarrier = this.gameState.currentPlay.type === 'offense_run' ? (this.players.find(p => p.role.startsWith('HB') && p.team === this.gameState.possession) ?? qb) : qb;
        
        ballCarrier.hasBall = true;
        this.football.x = ballCarrier.x; this.football.y = ballCarrier.y;
        
        this.players.forEach(p => p.isControlled = false);
        if (ballCarrier.team === 'player') ballCarrier.isControlled = true;
        
        if (this.gameState.currentPlay.type.startsWith('offense_pass')) {
            document.getElementById('passing-controls-info')!.style.display = 'block';
        }
    }
    
    private throwBall(targetPlayer: Player) {
        const qb = this.players.find(p => p.hasBall && p.role.startsWith('QB'));
        if(!qb) return;
        qb.hasBall = false;
        
        const accuracyRoll = (100 - qb.throwAccuracy) / 1.5;
        const targetX = targetPlayer.x + (Math.random() - 0.5) * accuracyRoll;
        const targetY = targetPlayer.y + (Math.random() - 0.5) * accuracyRoll;
        
        this.football.throw(qb.x, qb.y, targetX, targetY, targetPlayer);
    }
    
    private completePass(receiver: Player) {
        this.football.inAir = false;
        receiver.hasBall = true;
        if (receiver.team === 'player') {
             this.players.forEach(p => p.isControlled = false);
             receiver.isControlled = true;
        }
    }
    
    private incompletePass() {
        this.status = GameStatus.POST_PLAY;
        this.showNotification('Incomplete pass!');
        this.runClock(Math.random() * 3 + 2); // Incompletions take less time
        this.gameState.down++;
        if (this.gameState.down > 4) {
            this.turnover('Turnover on downs!');
        } else {
            setTimeout(() => this.prepareForPlay(), 2000);
        }
    }

    private endPlay(ballCarrier: Player, isTouchdown = false) {
        if(this.status !== GameStatus.PLAY_IN_PROGRESS) return;
        this.status = GameStatus.POST_PLAY;
        document.getElementById('passing-controls-info')!.style.display = 'none';
        const startLine = this.gameState.lineOfScrimmage;
        const endLine = Math.round((ballCarrier.x / this.getScale() / YARDS_TO_PIXELS) - 10);
        const gain = Math.min(100-startLine, Math.max(-startLine, endLine - startLine));
        this.runClock(Math.random() * 8 + 4);

        if (isTouchdown) {
            this.showNotification("TOUCHDOWN!");
            if (ballCarrier.team === 'player') this.gameState.score.player += 6;
            else this.gameState.score.cpu += 6;
            this.status = GameStatus.CONVERSION_CHOICE;
            document.getElementById('conversion-choice-modal')!.style.display = 'flex';
        } else {
            this.showNotification(`${gain >= 0 ? 'Gain' : 'Loss'} of ${Math.abs(gain)} yards`);
            this.gameState.lineOfScrimmage += gain;
            if (gain >= this.gameState.yardsToGo) {
                this.gameState.down = 1;
                this.gameState.yardsToGo = Math.min(10, 100 - this.gameState.lineOfScrimmage);
            } else {
                this.gameState.down++;
                this.gameState.yardsToGo -= gain;
            }
             if (this.gameState.down > 4) {
                this.turnover("Turnover on downs!");
            } else {
                setTimeout(() => this.prepareForPlay(), 2000);
            }
        }
    }
    
    public handleConversionChoice(type: 'kick' | '2pt') {
        document.getElementById('conversion-choice-modal')!.style.display = 'none';
        if (type === 'kick') {
            this.gameState.lineOfScrimmage = 15; // XP snap line
            this.startKick('field_goal');
        } else {
            this.gameState.lineOfScrimmage = 2; // 2pt conversion line
            this.gameState.down = 1;
            this.gameState.yardsToGo = 2;
            this.prepareForPlay();
        }
    }

    private startKick(type: 'field_goal' | 'punt') {
        this.gameState.currentPlay = PLAYBOOK[type];
        this.gameState.defensivePlay = PLAYBOOK[type === 'field_goal' ? 'fg_block' : 'punt_return'];
        this.setupFormation(this.gameState.currentPlay);
    }
    
    private handleCpuSpecialTeams() {
        const play = this.gameState.currentPlay;
        if(play.id === 'punt') {
            this.showNotification("CPU Punts");
            const puntDist = 40 + (Math.random() * 15);
            this.gameState.lineOfScrimmage += puntDist;
            this.turnover('Punt');
        } else if (play.id === 'field_goal') {
            const kickDist = this.gameState.lineOfScrimmage + 17;
            const success = Math.random() > (kickDist / 60);
            if(success) {
                this.showNotification(`CPU Field Goal is GOOD from ${kickDist} yards!`);
                this.gameState.score.cpu += 3;
            } else {
                this.showNotification(`CPU Field Goal is NO GOOD from ${kickDist} yards!`);
            }
             this.startKickoff();
        }
    }
    
    private updateKickMeter(deltaTime: number) {
        if(this.kickMeterPhase === 'power') {
            this.kickPower += deltaTime * 120;
            if(this.kickPower >= 100) this.kickPower = 100;
            (document.getElementById('kick-meter-power') as HTMLElement).style.width = `${this.kickPower}%`;
        }
    }

    private handleKickInput() {
        if(!this.controller.actions.a) return;
        this.controller.actions.a = false;
        
        if (this.kickMeterPhase === 'power') {
            this.kickMeterPhase = 'accuracy';
        } else if (this.kickMeterPhase === 'accuracy') {
            const indicator = document.getElementById('kick-meter-indicator')!;
            const pos = parseFloat(indicator.style.left || '0');
            this.kickAccuracy = 100 - Math.abs(pos - 87.5) * 2;
            this.resolveKick();
        }
    }

    private resolveKick() {
        this.kickMeterPhase = 'inactive';
        document.getElementById('kick-meter-container')!.style.display = 'none';
        const type = this.gameState.currentPlay.id;

        if (type === 'punt') {
            const puntDist = this.kickPower * 0.6;
            this.showNotification(`Punted ${Math.round(puntDist)} yards.`);
            this.gameState.lineOfScrimmage += puntDist;
            this.turnover('Punt');
        } else if (type === 'field_goal') {
            const kickDist = (100 - this.gameState.lineOfScrimmage) + 17;
            const requiredPower = kickDist / 60 * 100;
            
            if (this.kickPower >= requiredPower && this.kickAccuracy > 60) {
                 const points = this.gameState.down === 1 ? 1 : 3; // Is it an XP or FG?
                 this.showNotification(`Kick is GOOD from ${kickDist} yards!`);
                 if(this.gameState.possession === 'player') this.gameState.score.player += points;
                 else this.gameState.score.cpu += points;
                 this.startKickoff();
            } else {
                 this.showNotification(`Kick is NO GOOD from ${kickDist} yards!`);
                 this.turnover('Missed FG');
            }
        }
    }

    private startKickoff() {
        this.showNotification("Kickoff!");
        this.gameState.possession = this.gameState.possession === 'player' ? 'cpu' : 'player';
        this.gameState.lineOfScrimmage = 25;
        this.gameState.down = 1;
        this.gameState.yardsToGo = 10;
        setTimeout(() => this.prepareForPlay(), 2000);
    }
    
    private turnover(reason: string) {
        if (reason !== 'kickoff') this.showNotification(reason);
        this.gameState.possession = this.gameState.possession === 'player' ? 'cpu' : 'player';
        this.gameState.lineOfScrimmage = 100 - this.gameState.lineOfScrimmage;
        if (this.gameState.lineOfScrimmage < 1) this.gameState.lineOfScrimmage = 25;
        this.gameState.down = 1;
        this.gameState.yardsToGo = 10;
        setTimeout(() => this.prepareForPlay(), 2000);
    }

    private endGame(reason: string) {
        this.gameState.running = false;
        this.status = GameStatus.GAME_OVER;
        const modal = document.getElementById('game-over-modal')!;
        const scoreEl = document.getElementById('game-over-score')!;
        const titleEl = document.getElementById('game-over-title')!;
        const playerScore = this.gameState.score.player;
        const cpuScore = this.gameState.score.cpu;

        titleEl.textContent = playerScore > cpuScore ? "YOU WIN!" : playerScore < cpuScore ? "YOU LOSE" : "IT'S A TIE!";
        scoreEl.textContent = `${this.homeTeam.name}: ${playerScore} - ${this.awayTeam.name}: ${cpuScore}`;
        modal.style.display = 'flex';
    }

    private updateScoreboard(): void {
        document.getElementById('home-team-name')!.textContent = this.homeTeam.name.toUpperCase();
        document.getElementById('home-team-score')!.textContent = `${this.gameState.score.player}`;
        document.getElementById('away-team-name')!.textContent = this.awayTeam.name.toUpperCase();
        document.getElementById('away-team-score')!.textContent = `${this.gameState.score.cpu}`;
        document.getElementById('home-team-logo')!.style.backgroundImage = `url(${this.homeTeam.logo})`;
        document.getElementById('away-team-logo')!.style.backgroundImage = `url(${this.awayTeam.logo})`;
        const clock = this.gameClock > 0 ? this.gameClock : 0;
        document.getElementById('game-clock')!.textContent = `${Math.floor(clock / 60)}:${(Math.floor(clock) % 60).toString().padStart(2, '0')} | Q${this.quarter}`;
        const downNth = this.gameState.down === 1 ? '1st' : this.gameState.down === 2 ? '2nd' : this.gameState.down === 3 ? '3rd' : '4th';
        document.getElementById('down-and-distance')!.textContent = `${downNth} & ${this.gameState.yardsToGo <= 0 ? 'Goal' : Math.ceil(this.gameState.yardsToGo)}`;
        const yardLine = this.gameState.lineOfScrimmage <= 50 ? `Own ${this.gameState.lineOfScrimmage}` : `Opp ${100 - this.gameState.lineOfScrimmage}`;
        document.getElementById('ball-on')!.textContent = `Ball on ${yardLine}`;
    }
    
    private showNotification = (message: string) => {
        const container = document.getElementById('notification-container')!;
        const notif = document.createElement('div');
        notif.className = 'notification'; notif.textContent = message;
        container.appendChild(notif);
        setTimeout(() => notif.remove(), 3000);
    }
    private triggerScreenShake = () => {
        this.canvas.classList.add('shake');
        setTimeout(() => this.canvas.classList.remove('shake'), 150);
    }
    private getScale = () => this.canvas.width / (FIELD_WIDTH_YARDS * YARDS_TO_PIXELS);
}

// --- APP CLASS ---
class App {
    private static game: Game;
    private static playerTeamId: string | null = null;
    private static currentPlayFilters = { type: 'all', formation: 'all' };
    
    public static main(): void {
        if (!API_KEY) { document.body.innerHTML = `<div style="color:white; padding: 20px;"><h3>Warning</h3><p>API_KEY is not set. AI will use local probability logic.</p></div>`; }
        const aiCoach = new AICoach();
        App.game = Game.getInstance(aiCoach);
        App.setupEventListeners();
        App.populateTeamSelection();
        App.showScreen('main-menu-screen');
    }
    private static setupEventListeners(): void {
        document.getElementById('play-cpu-btn')!.onclick = () => App.showScreen('team-selection-screen');
        document.getElementById('high-scores-btn')!.onclick = () => App.showScreen('high-scores-screen');
        document.getElementById('back-to-menu-from-scores-btn')!.onclick = () => App.showScreen('main-menu-screen');
        document.getElementById('back-to-menu-from-teams-btn')!.onclick = () => App.showScreen('main-menu-screen');
        document.getElementById('back-to-menu-from-game-over-btn')!.onclick = () => {
             document.getElementById('game-over-modal')!.style.display = 'none';
             App.showScreen('main-menu-screen');
        };

        document.getElementById('extra-point-btn')!.onclick = () => App.game.handleConversionChoice('kick');
        document.getElementById('two-point-btn')!.onclick = () => App.game.handleConversionChoice('2pt');

        const qSlider = document.getElementById('quarter-length-slider') as HTMLInputElement;
        qSlider.oninput = () => { document.getElementById('quarter-length-value')!.textContent = qSlider.value; };

        document.getElementById('continue-to-difficulty-btn')!.onclick = () => App.showScreen('difficulty-screen');
        
        document.querySelectorAll('.difficulty-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const difficulty = (btn as HTMLElement).dataset.difficulty as 'easy'|'medium'|'hard';
                if (!App.playerTeamId) App.playerTeamId = 'titans';
                const availableCpuTeams = Object.keys(TEAMS).filter(id => id !== App.playerTeamId);
                const cpuTeamId = availableCpuTeams[Math.floor(Math.random() * availableCpuTeams.length)];
                const quarterLength = parseInt((document.getElementById('quarter-length-slider') as HTMLInputElement).value);
                const useGenAI = (document.getElementById('genai-toggle') as HTMLInputElement).checked;
                App.game.start(App.playerTeamId!, cpuTeamId, difficulty, quarterLength, useGenAI);
            });
        });
    }
    private static populateTeamSelection(): void {
        const list = document.getElementById('team-list')!;
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

    public static showScreen(screenId: string): void {
        document.querySelectorAll('.screen').forEach(s => (s as HTMLElement).style.display = 'none');
        const screen = document.getElementById(screenId);
        if(screen) {
            screen.style.display = 'flex';
            if (!screenId.includes('game')) screen.style.flexDirection = 'column';
        }
    }
    
    public static showPlaySelectionModal(plays: any[], onSelect: (playId: string) => void, side: 'offense' | 'defense', isAudible = false) {
        const modal = document.getElementById(isAudible ? 'audible-modal' : 'play-selection-modal')!;
        const listContainer = document.getElementById(isAudible ? 'audible-list' : 'play-list')!;
        const filterContainer = document.getElementById(isAudible ? 'play-filters-audible' : 'play-filters')!;
        
        const titleEl = document.getElementById(isAudible ? 'audible-selection-title' : 'play-selection-title')!;
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
                const target = e.currentTarget as HTMLElement;
                const filterType = target.dataset.filterType as 'type' | 'formation';
                const filterValue = target.dataset.filterValue!;
                App.currentPlayFilters[filterType] = filterValue;
                filterContainer.querySelectorAll(`.filter-btn[data-filter-type="${filterType}"]`).forEach(b => b.classList.remove('active'));
                target.classList.add('active');
                render();
            });
        });
        
        if (isAudible) {
            document.getElementById('cancel-audible-btn')!.onclick = () => {
                modal.style.display = 'none';
                App.game['status'] = GameStatus.PRE_SNAP;
            }
        }

        render();
        modal.style.display = 'flex';
    }

    private static generatePlayArtSVG(play: any, side: 'offense'|'defense'): string {
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
        Object.entries(oFormation).forEach(([role, pos]: [string, any]) => {
            const cx = width / 2 + pos.y * scale.y;
            const cy = height / 1.5 - pos.x * scale.x;
            svg += `<circle cx="${cx}" cy="${cy}" r="4" fill="${oColor}" />`;

            const route = oPlay.routes?.[role];
            if (route && route.length > 0) {
                let path = `M ${cx} ${cy}`;
                let endPoint = { x: cx, y: cy };
                route.forEach((p: {x:number, y:number}) => { 
                    endPoint = { x: cx + p.y * scale.y, y: cy - p.x * scale.x };
                    path += ` L ${endPoint.x} ${endPoint.y}`; 
                });
                svg += `<path d="${path}" stroke="${routeColor}" stroke-width="1.5" fill="none" stroke-dasharray="2 2"/>`;
                svg += `<circle cx="${endPoint.x}" cy="${endPoint.y}" r="3" fill="${routeColor}" />`;
            }
        });
        
        // Draw Defense
        Object.entries(dFormation).forEach(([role, pos]: [string, any]) => {
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

document.addEventListener('DOMContentLoaded', () => App.main());