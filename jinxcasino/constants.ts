import { Type } from '@google/genai';
import type { SlotTheme } from './types';

// --- SLOT CLASH TOURNAMENT CONSTANTS ---
export const TOTAL_ROUNDS = 10;
export const CPU_NAMES = ["CPU Alpha", "CPU Bravo"];

// --- PLAYER PROGRESSION CONSTANTS ---
export const XP_PER_SPIN = 1;
export const XP_PER_ROUND_WIN = 10;
export const XP_PLACEMENT_REWARDS = [50, 25, 10]; // 1st, 2nd, 3rd in tournament
export const XP_TO_LEVEL = (level: number): number => 50 * level * level;

// --- SLOT MACHINE CONSTANTS ---
export const BIG_WIN_MULTIPLIER = 10;
export const JACKPOT_MULTIPLIER = 100;

type SlotThemes = { [key: string]: SlotTheme };

export const SLOT_THEMES: SlotThemes = {
  cosmic: {
    name: "Cosmic Fortune",
    unlockLevel: 1,
    symbols: ['Galaxy', 'Alien', 'Rocket', 'Planet', 'Star', 'BlackHole'],
    background: `linear-gradient(145deg, #071321, #00539B)`
  },
  ocean: {
    name: "Ocean's Treasure",
    unlockLevel: 1,
    symbols: ['Treasure', 'Shark', 'Octopus', 'Crab', 'Fish', 'Anchor'],
    background: `linear-gradient(145deg, #004D7A, #008793)`
  },
  classicFruit: {
    name: "Classic Fruit",
    unlockLevel: 1,
    symbols: ['Seven', 'Bell', 'Bar', 'Watermelon', 'Cherry', 'Lemon'],
    background: `radial-gradient(circle, #4a044e, #1e293b)`
  },
  gridiron: {
    name: "Gridiron Glory",
    unlockLevel: 2,
    symbols: ['Trophy', 'Helmet', 'Football', 'Goalpost', 'Cleat', 'Whistle'],
    background: `linear-gradient(145deg, #004d40, #00796b)`
  },
  spooky: {
    name: "Spooky Spins",
    unlockLevel: 3,
    symbols: ['Ghost', 'WitchHat', 'Pumpkin', 'Cauldron', 'Candy', 'Bat'],
    background: `linear-gradient(145deg, #1a237e, #5c6bc0)`
  },
  vegas: {
    name: "Vegas Nights",
    unlockLevel: 4,
    symbols: ['Diamond', 'Dice', 'Chips', 'Spade', 'Heart', 'Club'],
    background: `linear-gradient(145deg, #4a148c, #8e24aa)`
  },
  jingle: {
    name: "Jingle Reels",
    unlockLevel: 5,
    symbols: ['Santa', 'Reindeer', 'Sleigh', 'Present', 'Bell', 'Snowman'],
    background: `linear-gradient(145deg, #b71c1c, #f44336)`
  },
  newyear: {
    name: "Midnight Luck",
    unlockLevel: 6,
    symbols: ['Clock', 'Champagne', 'Fireworks', 'TopHat', 'BallDrop', 'Balloons'],
    background: `linear-gradient(145deg, #111827, #4b5563)`
  },
  egyptianGold: {
    name: "Egyptian Gold",
    unlockLevel: 7,
    symbols: ['Pharaoh', 'Ankh', 'Scarab', 'Pyramid', 'EyeOfHorus', 'Cobra'],
    background: `linear-gradient(145deg, #3d2c0b, #b58c3c)`
  }
};
export const REEL_COUNT = 3;
export const ROW_COUNT = 3;
export const INITIAL_CREDITS = 500;
export const MIN_BET = 10;
export const MAX_BET = 100;
export const BET_INCREMENT = 10;

// Defines the 5 paylines by [row, col] coordinates
export const PAYLINES: number[][][] = [
    [ [1,0], [1,1], [1,2] ], // Middle row
    [ [0,0], [0,1], [0,2] ], // Top row
    [ [2,0], [2,1], [2,2] ], // Bottom row
    [ [0,0], [1,1], [2,2] ], // Diagonal TL to BR
    [ [2,0], [1,1], [0,2] ], // Diagonal BL to TR
];

export const SLOTS_RESULT_SCHEMA = (theme: SlotTheme) => ({
    type: Type.OBJECT,
    properties: {
        finalReels: {
            type: Type.ARRAY,
            description: "The 3x3 grid of symbols for the final result, as an array of 3 rows.",
            items: {
                type: Type.ARRAY,
                items: { type: Type.STRING, enum: theme.symbols }
            }
        },
        totalWinAmount: {
            type: Type.INTEGER,
            description: "The total amount of credits won across all paylines. Can be 0."
        },
        winningLines: {
            type: Type.ARRAY,
            description: "An array of all winning lines.",
            items: {
                type: Type.OBJECT,
                properties: {
                    lineIndex: { type: Type.INTEGER, description: "Index of the winning payline (0-4)." },
                    symbols: { type: Type.ARRAY, items: { type: Type.STRING } },
                    winAmount: { type: Type.INTEGER, description: "The amount won for this specific line."}
                },
                required: ["lineIndex", "symbols", "winAmount"]
            }
        },
        message: {
            type: Type.STRING,
            description: `A fun, thematic message about the spin result for the ${theme.name} theme.`
        }
    },
    required: ['finalReels', 'totalWinAmount', 'winningLines', 'message']
});

export const AI_PLAYER_ACTION_SCHEMA = {
    type: Type.OBJECT,
    properties: {
        betAmount: {
            type: Type.INTEGER,
            description: `The chosen bet amount for this turn. Must be between ${MIN_BET} and ${MAX_BET} and in increments of ${BET_INCREMENT}.`
        },
        reasoning: {
            type: Type.STRING,
            description: "A very brief, 1-sentence explanation for the chosen bet, written from the AI's perspective (e.g., 'I'm in the lead, so I'll bet big.')."
        }
    },
    required: ['betAmount', 'reasoning']
};

export const USER_ADVICE_SCHEMA = {
    type: Type.OBJECT,
    properties: {
        advice: {
            type: Type.STRING,
            description: "A brief, helpful, 1-sentence strategic tip for the player on how much to bet and why."
        }
    },
    required: ['advice']
};
