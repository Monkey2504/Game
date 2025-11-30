export enum Owner {
  NONE = 'NONE',
  PLAYER = 'PLAYER',
  AI = 'AI'
}

export enum ActionType {
  RECRUIT = 'RECRUIT', // Spend gold to get soldiers
  ATTACK = 'ATTACK',   // Send soldiers to take a tile
  HARVEST = 'HARVEST', // Gain extra gold immediately
  PASS = 'PASS'        // Skip turn
}

export enum TileType {
  CAPITAL = 'CAPITAL', // QG Principal
  MINE = 'MINE',       // +++ Or, - Def
  FORTRESS = 'FORTRESS', // +++ Def, - Or
  VILLAGE = 'VILLAGE'  // Balanced
}

export interface Tile {
  id: number;
  row: number;
  col: number;
  owner: Owner;
  defense: number; // Number of soldiers stationed/fortification
  resourceValue: number; // Gold generated per turn
  type: TileType;
}

export interface PlayerState {
  gold: number;
  army: number;
  tilesControlled: number;
}

export interface GameState {
  tiles: Tile[];
  player: PlayerState;
  ai: PlayerState;
  turn: Owner;
  turnCount: number;
  logs: string[];
  gameOver: boolean;
  winner: Owner | null;
}

export interface AIAction {
  actionType: ActionType;
  targetTileId?: number; // Optional, for ATTACK
  reasoning: string;
}