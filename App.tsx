import React, { useState, useEffect, useCallback, useRef } from 'react';
import { GameState, Owner, ActionType, Tile, PlayerState, TileType } from './types';
import { GRID_SIZE, TOTAL_TILES, INITIAL_PLAYER_STATE, INITIAL_AI_STATE, COSTS } from './constants';
import TileComponent, { CombatEffect } from './components/TileComponent';
import GameLog from './components/GameLog';
import { getAIMove } from './services/aiService';
import { Coins, Swords, Loader2, RefreshCw, Trophy, Skull, Castle, Zap, Wand2, Ghost, Shuffle, Hourglass, Sparkles } from 'lucide-react';

const TURN_DURATION = 30; // Seconds

const App: React.FC = () => {
  // --- Game Initialization Helper ---
  const createInitialState = (): GameState => {
    const tiles: Tile[] = [];
    for (let i = 0; i < TOTAL_TILES; i++) {
      // Determine random terrain type
      let type = TileType.VILLAGE;
      let defense = 1;
      let resourceValue = 2;
      
      const rand = Math.random();
      // 30% Mine (Rich, Weak), 20% Fortress (Poor, Strong), 50% Village (Balanced)
      if (rand < 0.3) {
         type = TileType.MINE;
         resourceValue = 4;
         defense = 0; // Mines are hard to defend
      } else if (rand < 0.5) {
         type = TileType.FORTRESS;
         resourceValue = 0;
         defense = 3; // Hard to take
      }

      tiles.push({
        id: i,
        row: Math.floor(i / GRID_SIZE),
        col: i % GRID_SIZE,
        owner: Owner.NONE,
        defense, 
        resourceValue,
        type
      });
    }

    // Force Capitals (Top-Left vs Bottom-Right)
    tiles[0].owner = Owner.PLAYER;
    tiles[0].type = TileType.CAPITAL;
    tiles[0].defense = 8;
    tiles[0].resourceValue = 5;

    tiles[TOTAL_TILES - 1].owner = Owner.AI;
    tiles[TOTAL_TILES - 1].type = TileType.CAPITAL;
    tiles[TOTAL_TILES - 1].defense = 8;
    tiles[TOTAL_TILES - 1].resourceValue = 5;

    return {
      tiles,
      player: { ...INITIAL_PLAYER_STATE },
      ai: { ...INITIAL_AI_STATE },
      turn: Owner.PLAYER,
      turnCount: 1,
      logs: ["Le monde est vaste. La guerre pour les 25 Royaumes commence."],
      gameOver: false,
      winner: null
    };
  };

  const [gameState, setGameState] = useState<GameState>(createInitialState());
  const [selectedAction, setSelectedAction] = useState<ActionType | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showCheats, setShowCheats] = useState(false);
  const [combatAnim, setCombatAnim] = useState<{ tileId: number, effect: CombatEffect } | null>(null);
  
  // Timer State
  const [timeLeft, setTimeLeft] = useState(TURN_DURATION);
  const [isShuffling, setIsShuffling] = useState(false);

  // --- Timer Logic ---
  useEffect(() => {
    if (gameState.gameOver || gameState.turn !== Owner.PLAYER || isProcessing) return;

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          performAction(Owner.PLAYER, ActionType.PASS); // Auto pass
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [gameState.turn, gameState.gameOver, isProcessing]);

  // Reset timer on new turn
  useEffect(() => {
    if (gameState.turn === Owner.PLAYER) {
      setTimeLeft(TURN_DURATION);
    }
  }, [gameState.turnCount, gameState.turn]);


  // --- Helper: Add Log ---
  const addLog = (logs: string[], turnCount: number, message: string): string[] => {
    return [...logs, `T${turnCount}: ${message}`];
  };

  // --- Helper: Check Win Condition ---
  const checkWinCondition = (currentTiles: Tile[], player: PlayerState, ai: PlayerState): Owner | null => {
    if (player.tilesControlled === 0) return Owner.AI;
    if (ai.tilesControlled === 0) return Owner.PLAYER;
    if (player.tilesControlled > TOTAL_TILES / 2) return Owner.PLAYER;
    if (ai.tilesControlled > TOTAL_TILES / 2) return Owner.AI;
    return null;
  };

  // --- Core Logic: Perform Action (With Animation Support) ---
  const performAction = async (
    actor: Owner,
    action: ActionType,
    targetTileId?: number,
    customReasoning?: string
  ) => {
    // 1. Trigger Animation if it is an attack
    if (action === ActionType.ATTACK && targetTileId !== undefined) {
      const tile = gameState.tiles.find(t => t.id === targetTileId);
      if (tile) {
        // Calculate theoretical outcome for visual cue
        const attackerArmy = actor === Owner.PLAYER ? gameState.player.army : gameState.ai.army;
        const attackCostTotal = tile.defense + COSTS.ATTACK_COST;
        const isSuccess = attackerArmy >= attackCostTotal;
        const damageDealt = isSuccess ? tile.defense : 1; // Visual number

        setCombatAnim({
          tileId: targetTileId,
          effect: {
            type: isSuccess ? 'CONQUER' : 'ATTACK',
            damage: damageDealt
          }
        });

        // Wait for animation
        await new Promise(resolve => setTimeout(resolve, 600));
        setCombatAnim(null);
      }
    }

    // 2. Update Game State
    setGameState(prev => {
      let newState = { ...prev, player: { ...prev.player }, ai: { ...prev.ai }, tiles: prev.tiles.map(t => ({...t})) };
      const activeStats = actor === Owner.PLAYER ? newState.player : newState.ai;
      const opponentStats = actor === Owner.PLAYER ? newState.ai : newState.player;
      const actorName = actor === Owner.PLAYER ? "Joueur" : "IA";

      let logMsg = "";

      if (action === ActionType.RECRUIT) {
        if (activeStats.gold >= COSTS.RECRUIT_COST) {
          activeStats.gold -= COSTS.RECRUIT_COST;
          activeStats.army += COSTS.RECRUIT_AMOUNT;
          logMsg = `${actorName} recrute (+${COSTS.RECRUIT_AMOUNT} Soldats).`;
        } else {
          logMsg = `${actorName} manque d'or.`;
        }
      } 
      else if (action === ActionType.HARVEST) {
        activeStats.gold += COSTS.HARVEST_BONUS;
        logMsg = `${actorName} récolte (+${COSTS.HARVEST_BONUS} Or).`;
      }
      else if (action === ActionType.ATTACK && targetTileId !== undefined) {
        const targetIndex = newState.tiles.findIndex(t => t.id === targetTileId);
        if (targetIndex !== -1) {
          const targetTile = newState.tiles[targetIndex];
          const attackCostTotal = targetTile.defense + COSTS.ATTACK_COST;

          if (activeStats.army >= attackCostTotal) {
            // Success
            activeStats.army -= attackCostTotal;
            
            if (targetTile.owner === Owner.PLAYER) newState.player.tilesControlled--;
            if (targetTile.owner === Owner.AI) newState.ai.tilesControlled--;
            
            targetTile.owner = actor;
            targetTile.defense = 2; // Reset defense after conquer
            
            if (targetTile.type === TileType.MINE) {
                activeStats.gold += 3; // Plunder bonus
                logMsg = `${actorName} pille la Mine #${targetTileId} (+3 Or) !`;
            } else {
                logMsg = `${actorName} conquiert #${targetTileId}.`;
            }
            activeStats.tilesControlled++;
            
          } else {
            // Fail
            activeStats.army = Math.max(0, activeStats.army - 1);
            targetTile.defense = Math.max(0, targetTile.defense - 1); // Slight attrition on fail
            logMsg = `${actorName} échoue sur #${targetTileId}.`;
          }
        }
      } 
      else {
        logMsg = `${actorName} passe.`;
      }

      // Add AI personality text
      if (actor === Owner.AI && customReasoning) {
        logMsg += ` "${customReasoning}"`;
      }

      // End of turn logic
      if (actor === Owner.AI) {
        newState.turn = Owner.PLAYER;
        newState.turnCount++;
        
        // Income phase - Player
        let playerIncome = 0;
        let playerUpkeep = Math.floor(newState.player.army * 0.5); // Simplified upkeep: 0.5 gold per unit
        
        newState.tiles.forEach(t => { 
          if(t.owner === Owner.PLAYER) playerIncome += t.resourceValue; 
          // Barracks spawn units
          if(t.owner === Owner.PLAYER && t.type === TileType.FORTRESS) {
             t.defense += 1;
          }
        });

        // Pay Upkeep
        newState.player.gold += playerIncome;
        newState.player.gold -= playerUpkeep;

        // Desertion if bankrupt
        if (newState.player.gold < 0) {
           const desertion = Math.abs(newState.player.gold); // Lose 1 unit per negative gold
           newState.player.army = Math.max(0, newState.player.army - desertion);
           newState.player.gold = 0;
           newState.logs = addLog(newState.logs, newState.turnCount, `⚠️ FAILLITE: ${desertion} soldats désertent !`);
        }
        
        newState.logs = addLog(newState.logs, newState.turnCount, logMsg);
        newState.logs.push(`💰 Revenus: +${playerIncome}, Entretien: -${playerUpkeep}`);
        
      } else {
        newState.turn = Owner.AI;
        // Income phase - AI
        let aiIncome = 0;
        let aiUpkeep = Math.floor(newState.ai.army * 0.5);

        newState.tiles.forEach(t => { 
          if(t.owner === Owner.AI) aiIncome += t.resourceValue; 
          if(t.owner === Owner.AI && t.type === TileType.FORTRESS) {
            t.defense += 1;
         }
        });
        
        newState.ai.gold += aiIncome - aiUpkeep;
        if (newState.ai.gold < 0) {
           newState.ai.army = Math.max(0, newState.ai.army - Math.abs(newState.ai.gold));
           newState.ai.gold = 0;
        }

        newState.logs = addLog(newState.logs, newState.turnCount, logMsg);
      }

      const winner = checkWinCondition(newState.tiles, newState.player, newState.ai);
      if (winner) {
        newState.gameOver = true;
        newState.winner = winner;
        newState.logs.push(`FIN: Victoire ${winner === Owner.PLAYER ? "JOUEUR" : "IA"}`);
      }

      return newState;
    });
  };

  // --- Player Action Handler ---
  const handlePlayerAction = async (action: ActionType, targetId?: number) => {
    if (gameState.turn !== Owner.PLAYER || gameState.gameOver || isProcessing) return;
    
    // Validation
    if (action !== ActionType.PASS) {
      if (action === ActionType.RECRUIT && gameState.player.gold < COSTS.RECRUIT_COST) {
        alert("Pas assez d'or !");
        return;
      }
      if (action === ActionType.ATTACK) {
        if (targetId === undefined) return;
        const tile = gameState.tiles.find(t => t.id === targetId);
        if (!tile || tile.owner === Owner.PLAYER) return;
        if (gameState.player.army < tile.defense + COSTS.ATTACK_COST) {
          alert(`Armée insuffisante ! Besoin de ${tile.defense + COSTS.ATTACK_COST} (Défense ${tile.defense} + Coût ${COSTS.ATTACK_COST})`);
          return;
        }
      }
    }

    setIsProcessing(true);
    await performAction(Owner.PLAYER, action, targetId);
    setSelectedAction(null);
    setIsProcessing(false);
  };

  // --- AI Turn Loop ---
  useEffect(() => {
    const runAITurn = async () => {
      if (gameState.turn === Owner.AI && !gameState.gameOver) {
        setIsProcessing(true);
        // Artificial thinking delay
        await new Promise(r => setTimeout(r, 1000));
        
        const aiMove = await getAIMove(gameState);
        await performAction(Owner.AI, aiMove.actionType, aiMove.targetTileId, aiMove.reasoning);
        
        setIsProcessing(false);
      }
    };
    runAITurn();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameState.turn, gameState.gameOver]); // Removed performAction from dependency to avoid loop

  // --- Cheats ---
  const applyCheat = (type: 'GOLD' | 'ARMY' | 'PLAGUE') => {
    setGameState(prev => {
      const newState = { ...prev, player: { ...prev.player }, ai: { ...prev.ai } };
      if (type === 'GOLD') newState.player.gold += 50;
      else if (type === 'ARMY') newState.player.army += 20;
      else if (type === 'PLAGUE') newState.ai.army = Math.max(0, Math.floor(newState.ai.army / 2));
      return newState;
    });
  };

  // --- UI Helpers ---
  const canRecruit = gameState.player.gold >= COSTS.RECRUIT_COST;
  const canAttack = gameState.player.army > COSTS.ATTACK_COST; 
  const progressPercent = (timeLeft / TURN_DURATION) * 100;
  const timerColor = timeLeft < 10 ? 'bg-red-600' : 'bg-yellow-500';

  return (
    <div className="min-h-[100svh] text-slate-100 flex flex-col items-center p-2 sm:p-4 font-sans selection:bg-purple-500/30">
      
      {/* Header */}
      <header className="w-full max-w-2xl mb-2 sm:mb-4 relative z-10">
        <div className="flex justify-between items-center bg-slate-900/80 backdrop-blur-md p-2 sm:p-3 rounded-2xl border border-slate-700 shadow-xl">
            <div>
              <h1 className="text-lg sm:text-2xl fantasy-font text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-purple-500 flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-yellow-400" /> Strategia
              </h1>
              <p className="text-[10px] text-purple-300 flex items-center gap-1 opacity-70">
                <Shuffle className="w-3 h-3" /> 25 Royaumes
              </p>
            </div>
            
            <div className="flex items-center gap-3 sm:gap-4">
              <button 
                onClick={() => setShowCheats(!showCheats)}
                className={`p-2 rounded-full transition-all hover:scale-110 active:scale-95 ${showCheats ? 'bg-purple-600 shadow-[0_0_15px_rgba(147,51,234,0.5)]' : 'bg-slate-800 text-purple-400 hover:bg-slate-700'}`}
              >
                <Zap className="w-4 h-4" />
              </button>
              <div className="text-right">
                <div className="text-[10px] text-slate-400 uppercase tracking-widest">Tour</div>
                <div className="text-xl sm:text-2xl font-bold font-mono text-white drop-shadow-md">{gameState.turnCount}</div>
              </div>
            </div>
        </div>

        {/* Timer Bar */}
        {!gameState.gameOver && gameState.turn === Owner.PLAYER && (
          <div className="mt-2 w-full bg-slate-800 h-1.5 rounded-full overflow-hidden shadow-lg border border-slate-700">
            <div 
              className={`h-full transition-all duration-1000 ease-linear ${timerColor}`} 
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        )}

        {/* Cheat Menu */}
        {showCheats && (
          <div className="absolute top-24 right-0 z-50 bg-slate-900/95 backdrop-blur border border-purple-500 rounded-xl p-4 shadow-2xl w-64 animate-in fade-in slide-in-from-top-2">
            <h4 className="text-purple-400 font-bold mb-3 flex items-center gap-2 text-sm uppercase">
              <Wand2 className="w-4 h-4" /> Magie Noire
            </h4>
            <div className="space-y-2">
              <button onClick={() => applyCheat('GOLD')} className="cheat-btn w-full text-left text-xs p-3 bg-slate-800 hover:bg-purple-900/50 active:bg-purple-800 rounded flex gap-2 border border-slate-700"><Coins className="w-3 h-3 text-yellow-400" /> +50 Or</button>
              <button onClick={() => applyCheat('ARMY')} className="cheat-btn w-full text-left text-xs p-3 bg-slate-800 hover:bg-purple-900/50 active:bg-purple-800 rounded flex gap-2 border border-slate-700"><Swords className="w-3 h-3 text-blue-400" /> +20 Armée</button>
              <button onClick={() => applyCheat('PLAGUE')} className="cheat-btn w-full text-left text-xs p-3 bg-slate-800 hover:bg-red-900/50 active:bg-red-800 rounded flex gap-2 border border-slate-700"><Ghost className="w-3 h-3 text-red-400" /> Peste (IA -50%)</button>
            </div>
          </div>
        )}
      </header>

      {/* Main Game Area */}
      <main className="w-full max-w-4xl grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4 items-start relative z-0">
        
        {/* Board */}
        <div className="order-2 md:order-1">
          <div className={`
             relative p-1.5 sm:p-2 bg-slate-900/40 backdrop-blur-sm rounded-xl sm:rounded-2xl shadow-2xl border border-slate-700/50
             transition-transform duration-500
          `}>

            {/* GRID 5x5 */}
            <div className="grid grid-cols-5 gap-1 sm:gap-2">
              {gameState.tiles.map((tile, idx) => {
                let isValidTarget = false;
                if (selectedAction === ActionType.ATTACK && gameState.turn === Owner.PLAYER) {
                   if (tile.owner !== Owner.PLAYER) {
                      if (gameState.player.army >= tile.defense + COSTS.ATTACK_COST) isValidTarget = true;
                   }
                }

                // Determine if this tile is currently animating combat
                const currentCombatEffect = combatAnim && combatAnim.tileId === tile.id ? combatAnim.effect : null;

                return (
                  <div key={tile.id}>
                    <TileComponent 
                      tile={tile} 
                      isSelected={false}
                      isValidTarget={isValidTarget}
                      combatEffect={currentCombatEffect}
                      onClick={(id) => {
                        if (selectedAction === ActionType.ATTACK && isValidTarget) {
                          handlePlayerAction(ActionType.ATTACK, id);
                        }
                      }}
                    />
                  </div>
                );
              })}
            </div>
            
            {/* AI Thinking Overlay */}
            {isProcessing && gameState.turn === Owner.AI && !gameState.gameOver && (
              <div className="absolute inset-0 z-20 bg-black/10 rounded-2xl flex flex-col items-center justify-center animate-in fade-in duration-300 pointer-events-none">
                 <div className="bg-slate-900/80 border border-red-500/50 p-2 px-4 rounded-full shadow-2xl flex items-center gap-3 animate-pulse">
                    <Loader2 className="w-4 h-4 animate-spin text-red-500" />
                    <span className="text-red-200 text-xs font-bold tracking-wide">Tour de l'IA</span>
                 </div>
              </div>
            )}
          </div>

          {/* Game Over Screen */}
          {gameState.gameOver && (
            <div className="mt-6 p-6 sm:p-8 bg-slate-900/95 border-2 border-yellow-500 rounded-2xl text-center shadow-[0_0_50px_rgba(234,179,8,0.2)] animate-in zoom-in duration-300">
              <h2 className="text-2xl sm:text-3xl fantasy-font mb-4 text-yellow-400 drop-shadow-lg">
                {gameState.winner === Owner.PLAYER ? "VICTOIRE LÉGENDAIRE !" : "DÉFAITE CUISANTE..."}
              </h2>
              <p className="mb-6 text-slate-300 text-sm">
                {gameState.winner === Owner.PLAYER 
                  ? "Vous avez unifié les Royaumes sous votre bannière." 
                  : "Le Seigneur Gemini règne sur les ruines."}
              </p>
              <button 
                onClick={() => {
                   setGameState(createInitialState());
                   setTimeLeft(TURN_DURATION);
                }}
                className="inline-flex items-center gap-2 bg-gradient-to-r from-yellow-600 to-yellow-500 hover:from-yellow-500 hover:to-yellow-400 text-slate-900 px-6 py-2 rounded-full font-bold transition-all transform hover:scale-105 shadow-lg active:scale-95"
              >
                <RefreshCw className="w-4 h-4" /> Nouvelle Partie
              </button>
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="flex flex-col gap-2 sm:gap-3 order-1 md:order-2">
          
          {/* Player Stats Card */}
          <div className="bg-gradient-to-br from-blue-900/60 to-slate-900/80 border border-blue-500/30 rounded-xl p-3 sm:p-4 shadow-lg relative overflow-hidden group hover:border-blue-500/50 transition-all">
            <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full blur-2xl pointer-events-none group-hover:bg-blue-500/20 transition-all"></div>
            
            <div className="flex justify-between items-start mb-2">
               <h3 className="text-blue-300 font-bold flex items-center gap-2 uppercase tracking-wider text-xs">
                 <Castle className="w-3 h-3" /> Royaume
               </h3>
               {gameState.turn === Owner.PLAYER && (
                 <div className={`text-[10px] font-bold px-2 py-0.5 rounded flex items-center gap-1 ${timeLeft < 10 ? 'bg-red-500/20 text-red-400 animate-pulse' : 'bg-slate-800 text-slate-400'}`}>
                    <Hourglass className="w-3 h-3" /> {timeLeft}s
                 </div>
               )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div key={gameState.player.gold} className="bg-slate-950/40 p-2 rounded-lg flex flex-col items-center border border-slate-700/50 backdrop-blur-sm animate-in slide-in-from-bottom-1">
                <span className="text-[9px] text-slate-400 mb-0.5 uppercase tracking-widest">Or</span>
                <div className="flex items-center gap-1 text-yellow-400 text-2xl font-bold font-mono text-shadow-glow">
                  <Coins className="w-4 h-4" /> {gameState.player.gold}
                </div>
              </div>
              <div key={gameState.player.army} className="bg-slate-950/40 p-2 rounded-lg flex flex-col items-center border border-slate-700/50 backdrop-blur-sm animate-in slide-in-from-bottom-1 delay-75">
                <span className="text-[9px] text-slate-400 mb-0.5 uppercase tracking-widest">Armée</span>
                <div className="flex items-center gap-1 text-blue-400 text-2xl font-bold font-mono text-shadow-glow">
                  <Swords className="w-4 h-4" /> {gameState.player.army}
                </div>
              </div>
            </div>
            
            <div className="mt-2 text-[10px] text-slate-500 text-center bg-slate-950/30 rounded py-1">
               Coût Entretien: <span className="text-red-400 font-mono">-{Math.floor(gameState.player.army * 0.5)}</span> Or/tour
            </div>
          </div>

          {/* AI Stats (Mini) */}
          <div className="bg-slate-900/80 border border-red-900/30 rounded-xl p-2 flex justify-between items-center shadow-md">
             <div className="flex items-center gap-2 text-red-400 font-bold text-xs">
               <Skull className="w-3 h-3" /> Ennemi (IA)
             </div>
             <div className="flex gap-4 text-xs font-mono text-slate-500">
               <span className="flex items-center gap-1" title="Or Ennemi"><Coins className="w-3 h-3 text-yellow-800"/> {gameState.ai.gold}</span>
               <span className="flex items-center gap-1" title="Armée Ennemie"><Swords className="w-3 h-3 text-red-800"/> {gameState.ai.army}</span>
             </div>
          </div>

          {/* Action Panel */}
          <div className="bg-slate-900/80 border border-slate-700 rounded-xl p-3 flex-grow flex flex-col shadow-inner backdrop-blur-sm">
            <h3 className="text-slate-300 font-bold mb-3 text-xs uppercase tracking-wider flex items-center gap-2">
               <Wand2 className="w-3 h-3 text-purple-400" /> Commandes
            </h3>
            
            {gameState.turn === Owner.PLAYER && !gameState.gameOver ? (
              <div className="grid grid-cols-1 gap-2">
                <button
                  onClick={() => handlePlayerAction(ActionType.RECRUIT)}
                  disabled={!canRecruit}
                  className={`relative overflow-hidden flex items-center justify-between p-2 rounded-lg border transition-all active:scale-98 group
                    ${canRecruit 
                      ? 'bg-slate-800 border-slate-600 hover:bg-slate-750 hover:border-green-500/50 hover:shadow-[0_0_15px_rgba(34,197,94,0.1)]' 
                      : 'bg-slate-900/50 border-slate-800 opacity-40 cursor-not-allowed'}`}
                >
                  <div className="flex items-center gap-2 relative z-10">
                    <div className={`p-1.5 rounded-full transition-colors ${canRecruit ? 'bg-green-900/30 group-hover:bg-green-500/20' : 'bg-slate-800'}`}>
                      <Coins className={`w-4 h-4 ${canRecruit ? 'text-green-400' : 'text-slate-500'}`}/>
                    </div>
                    <div className="text-left">
                      <div className="font-bold text-xs text-slate-200">Recruter</div>
                      <div className="text-[10px] text-slate-500 group-hover:text-slate-300">-{COSTS.RECRUIT_COST} Or, +{COSTS.RECRUIT_AMOUNT} Armée</div>
                    </div>
                  </div>
                </button>

                <button
                  onClick={() => {
                    if (selectedAction === ActionType.ATTACK) setSelectedAction(null);
                    else setSelectedAction(ActionType.ATTACK);
                  }}
                  disabled={!canAttack}
                  className={`flex items-center justify-between p-2 rounded-lg border transition-all active:scale-98 group
                    ${selectedAction === ActionType.ATTACK ? 'bg-red-900/30 border-red-500 ring-1 ring-red-500 shadow-[0_0_15px_rgba(239,68,68,0.2)]' : ''}
                    ${canAttack && selectedAction !== ActionType.ATTACK
                      ? 'bg-slate-800 border-slate-600 hover:bg-slate-750 hover:border-red-500/50 hover:shadow-[0_0_15px_rgba(239,68,68,0.1)]' 
                      : ''}
                    ${!canAttack ? 'bg-slate-900/50 border-slate-800 opacity-40 cursor-not-allowed' : ''}
                  `}
                >
                  <div className="flex items-center gap-2">
                    <div className={`p-1.5 rounded-full transition-colors ${canAttack ? 'bg-red-900/30 group-hover:bg-red-500/20' : 'bg-slate-800'}`}>
                      <Swords className={`w-4 h-4 ${canAttack ? 'text-red-400' : 'text-slate-500'}`}/>
                    </div>
                    <div className="text-left">
                      <div className="font-bold text-xs text-slate-200">Attaquer</div>
                      <div className="text-[10px] text-slate-500 group-hover:text-slate-300">Coût: Def + {COSTS.ATTACK_COST}</div>
                    </div>
                  </div>
                </button>

                 <button
                  onClick={() => handlePlayerAction(ActionType.HARVEST)}
                  className="flex items-center justify-between p-2 rounded-lg border bg-slate-800 border-slate-600 hover:bg-slate-750 hover:border-yellow-500/50 hover:shadow-[0_0_15px_rgba(234,179,8,0.1)] transition-all active:scale-98 group"
                >
                  <div className="flex items-center gap-2">
                    <div className="bg-yellow-900/20 p-1.5 rounded-full group-hover:bg-yellow-500/20 transition-colors">
                      <Trophy className="w-4 h-4 text-yellow-500"/>
                    </div>
                    <div className="text-left">
                      <div className="font-bold text-xs text-slate-200">Récolter</div>
                      <div className="text-[10px] text-slate-500 group-hover:text-slate-300">+{COSTS.HARVEST_BONUS} Or immédiat</div>
                    </div>
                  </div>
                </button>

                {selectedAction === ActionType.ATTACK && (
                   <div className="text-center text-[10px] text-red-300 animate-pulse mt-1 bg-red-900/20 p-1 rounded border border-red-900/50">
                     Ciblez une zone sur la carte !
                   </div>
                )}
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-slate-500 gap-2 py-6">
                {gameState.gameOver ? (
                  <span>La guerre est terminée.</span>
                ) : (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin text-slate-600"/>
                    <span className="text-xs italic">L'ennemi observe...</span>
                  </>
                )}
              </div>
            )}
          </div>

          <GameLog logs={gameState.logs} />
          
        </div>
      </main>
      
      <footer className="mt-4 text-[9px] text-slate-500 max-w-lg text-center leading-relaxed opacity-60 hover:opacity-100 transition-opacity">
        Astuce : Les Mines rapportent beaucoup d'or. Protégez-les.
      </footer>
    </div>
  );
};

export default App;