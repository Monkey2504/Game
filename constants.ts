export const GRID_SIZE = 5; // 5x5 grid = 25 tiles (approx x3 of 9)
export const TOTAL_TILES = GRID_SIZE * GRID_SIZE;

export const COSTS = {
  RECRUIT_COST: 5,     // Gold cost to get 1 army unit
  RECRUIT_AMOUNT: 3,   // Army units gained per recruit action
  ATTACK_COST: 2,      // Army units lost purely by initiating an attack (logistics)
  HARVEST_BONUS: 3     // Extra gold when choosing HARVEST action
};

export const INITIAL_GOLD = 25; // Increased for bigger map
export const INITIAL_ARMY = 10; // Increased for bigger map

// Initial Setup
export const INITIAL_PLAYER_STATE = {
  gold: INITIAL_GOLD,
  army: INITIAL_ARMY,
  tilesControlled: 1
};

export const INITIAL_AI_STATE = {
  gold: INITIAL_GOLD,
  army: INITIAL_ARMY,
  tilesControlled: 1
};