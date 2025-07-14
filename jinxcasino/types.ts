export interface Profile {
  name: string;
  level: number;
  xp: number;
}

export type Profiles = Record<string, Omit<Profile, 'name'>>;

export type View = 'profile-manager' | 'main-menu' | 'slots';

export interface SlotTheme {
  name: string;
  unlockLevel: number;
  symbols: string[];
  background: string;
}

export interface WinningLine {
    lineIndex: number;
    symbols: string[];
    winAmount: number;
}

export interface SlotResult {
    finalReels: string[][];
    totalWinAmount: number;
    winningLines: WinningLine[];
    message: string;
}

export interface AIPlayerAction {
    betAmount: number;
    reasoning: string;
}
