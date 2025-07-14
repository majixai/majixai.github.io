import { GoogleGenAI } from "@google/genai";
import {
    SLOTS_RESULT_SCHEMA,
    MIN_BET, MAX_BET, BET_INCREMENT,
    BIG_WIN_MULTIPLIER, JACKPOT_MULTIPLIER,
    AI_PLAYER_ACTION_SCHEMA, USER_ADVICE_SCHEMA,
    REEL_COUNT, ROW_COUNT, PAYLINES
} from '../constants';
import type { SlotTheme, SlotResult, AIPlayerAction, WinningLine } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
const model = 'gemini-2.5-flash';

// --- SLOT RESULT SERVICE ---

const getSlotSystemInstruction = (theme: SlotTheme, betAmount: number, currentCredits: number): string => `
You are a '${theme.name}' themed 3x3 slot machine game engine.
Your goal is to simulate a realistic and engaging slot machine experience with an approximate Return to Player (RTP) of 96%. This means for every 100 credits wagered over many spins, the player should win back about 96 on average.

RULES:
1.  **Outcome Generation**: Most spins MUST be losses. Small wins should be common to keep the player engaged. Medium wins should be occasional. Large wins (more than ${BIG_WIN_MULTIPLIER}x the bet) must be rare. Jackpot wins (3x '${theme.symbols[0]}') must be extremely rare.
2.  **Player State Awareness**: The player's current credit balance is ${currentCredits}. The current bet is ${betAmount}.
    - If the player is on a losing streak (credits are low), consider giving a small or medium "comeback" win to boost morale.
    - If the player is winning excessively, you must increase the probability of a loss to maintain the target RTP.
3.  **Symbol Payouts**: Payouts for a 3-of-a-kind match on any payline are based on a multiplier. The final win for a line is the payout multiplier * (betAmount / ${MIN_BET}).
    - 3x ${theme.symbols[0]} (Jackpot): ${JACKPOT_MULTIPLIER}
    - 3x ${theme.symbols[1]}: 50
    - 3x ${theme.symbols[2]}: 25
    - 3x ${theme.symbols[3]}: 10
    - 3x ${theme.symbols[4]}: 5
    - 3x ${theme.symbols[5]}: 2
4.  **Response**:
    - Generate the 'finalReels' 3x3 grid based on all the rules above.
    - Calculate 'winningLines' and 'totalWinAmount' based on the generated grid.
    - Write a fun, thematic 'message' that reflects the outcome. Make it EPIC and EXCITING for big wins, encouraging for near misses ("So close!"), and brief for losses.

Your response MUST ONLY be a valid JSON object adhering to the provided schema. Do not include any other text.
`;

export const getSlotResult = async (theme: SlotTheme, betAmount: number, currentCredits: number): Promise<SlotResult> => {
    const prompt = `Generate a new spin result for the ${theme.name} slot machine. The bet is ${betAmount} and the player has ${currentCredits} credits remaining.`;

    try {
        const response = await ai.models.generateContent({
            model,
            contents: [{ text: prompt }],
            config: {
                systemInstruction: getSlotSystemInstruction(theme, betAmount, currentCredits),
                responseMimeType: "application/json",
                responseSchema: SLOTS_RESULT_SCHEMA(theme),
                temperature: 1,
            },
        });

        const jsonText = response.text.trim();
        const rawResult = JSON.parse(jsonText);

        // Validate and sanitize the received object to prevent crashes.
        const validSymbols = new Set(theme.symbols);
        const validatedReels = (rawResult.finalReels && Array.isArray(rawResult.finalReels)) ? rawResult.finalReels : [];

        // Ensure the grid is fully populated to avoid errors.
        const finalReels: string[][] = Array(ROW_COUNT).fill(null).map((_, r) =>
            Array(REEL_COUNT).fill(null).map((_, c) => {
                const symbol = validatedReels[r] && validatedReels[r][c];
                return validSymbols.has(symbol) ? symbol as string : theme.symbols[Math.floor(Math.random() * theme.symbols.length)];
            })
        );

        const validatedWinningLines: WinningLine[] = (rawResult.winningLines && Array.isArray(rawResult.winningLines)) ? rawResult.winningLines : [];

        return {
             finalReels,
             totalWinAmount: typeof rawResult.totalWinAmount === 'number' ? rawResult.totalWinAmount : 0,
             winningLines: validatedWinningLines.filter(line => line && typeof line.lineIndex === 'number' && PAYLINES[line.lineIndex]),
             message: typeof rawResult.message === 'string' ? rawResult.message : 'Spin result.'
        };

    } catch (error) {
        console.error("Error fetching slot result from Gemini:", error);
        const fallbackReels = Array(ROW_COUNT).fill(null).map(() =>
            Array(REEL_COUNT).fill(null).map(() =>
                theme.symbols[Math.floor(Math.random() * theme.symbols.length)]
            )
        );
        if(fallbackReels[1][0] === fallbackReels[1][1] && fallbackReels[1][1] === fallbackReels[1][2]) {
            fallbackReels[1][2] = theme.symbols[(theme.symbols.indexOf(fallbackReels[1][2]) + 1) % theme.symbols.length];
        }
        return { finalReels: fallbackReels, totalWinAmount: 0, winningLines: [], message: "Cosmic interference! Spin again." };
    }
};

// --- AI PLAYER SERVICE ---

const getAIPlayerSystemInstruction = (myId: string): string => `
You are an AI player in a slot machine tournament. Your persona is a bit of a gambler, sometimes cautious, sometimes aggressive.
Your task is to decide on a bet amount for your turn.

RULES:
1.  Analyze the provided JSON game state, paying attention to your own rank and credits compared to others. Your player ID is '${myId}'.
2.  Choose a bet amount between ${MIN_BET} and ${MAX_BET}, in increments of ${BET_INCREMENT}.
3.  Your strategy should change based on the situation:
    - **Leading (Rank 1):** Be confident. Make medium to large bets to press your advantage.
    - **Middle of the pack:** Be strategic. Make medium bets, but consider a large bet if you're feeling lucky or falling behind.
    - **Losing (Last place):** Be risky. You need to catch up. Make larger bets, but don't bet more than you can afford.
    - **Early Rounds (1-3):** Play more conservatively.
    - **Late Rounds (8-10):** Play more aggressively, especially if you are not in first place.
4.  Provide a short, 1-sentence 'reasoning' for your bet from your persona's point of view.

Your response MUST ONLY be a valid JSON object adhering to the provided schema.
`;

export const getAIPlayerAction = async (gameState: any, myId: string): Promise<AIPlayerAction> => {
    const prompt = `Here is the current game state: ${JSON.stringify(gameState)}. My ID is ${myId}. What is my next bet?`;

    try {
        const response = await ai.models.generateContent({
            model,
            contents: [{ text: prompt }],
            config: {
                systemInstruction: getAIPlayerSystemInstruction(myId),
                responseMimeType: "application/json",
                responseSchema: AI_PLAYER_ACTION_SCHEMA,
                temperature: 1,
            },
        });
        const jsonText = response.text.trim();
        const rawResult = JSON.parse(jsonText);

        return {
            betAmount: typeof rawResult.betAmount === 'number' ? rawResult.betAmount : MIN_BET,
            reasoning: typeof rawResult.reasoning === 'string' ? rawResult.reasoning : "I'm playing it safe this round."
        };
    } catch (error) {
        console.error("Error fetching AI player action:", error);
        return { betAmount: MIN_BET, reasoning: "I'm playing it safe this round." }; // Fallback action
    }
};

// --- USER ADVICE SERVICE ---

const getUserAdviceSystemInstruction = (): string => `
You are a friendly and encouraging slot machine coach.
Your goal is to provide a single, actionable sentence of advice to the human player based on the game state.

RULES:
1.  Analyze the provided JSON game state. The human player is the one with 'isCPU: false'.
2.  Consider their rank, credits, and the current round.
3.  Formulate a helpful, 1-sentence tip.
    - If they are winning: "You're in the lead! A solid medium bet can keep the pressure on."
    - If they are losing late in the game: "It's getting late, a bold max bet might be what you need to catch up!"
    - If it's early: "It's still early, no need to go all-in just yet. A safe bet is smart."
4.  Your response MUST ONLY be a valid JSON object adhering to the provided schema.
`;

export const getUserAdvice = async (gameState: any): Promise<string> => {
     const prompt = `Here is the current game state: ${JSON.stringify(gameState)}. What advice do you have for the human player?`;

    try {
        const response = await ai.models.generateContent({
            model,
            contents: [{ text: prompt }],
            config: {
                systemInstruction: getUserAdviceSystemInstruction(),
                responseMimeType: "application/json",
                responseSchema: USER_ADVICE_SCHEMA,
            },
        });
        const jsonText = response.text.trim();
        const rawResult = JSON.parse(jsonText);

        const advice = typeof rawResult.advice === 'string' && rawResult.advice.length > 0
            ? rawResult.advice
            : "Trust your gut and have fun!";
        return advice;

    } catch (error) {
        console.error("Error fetching user advice:", error);
        return "Trust your gut and have fun!"; // Fallback advice
    }
};
