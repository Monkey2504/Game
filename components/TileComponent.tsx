import React from 'react';
import { Tile, Owner, TileType } from '../types';
import { Castle, Shield, Coins, Crown, Pickaxe, Tent, Swords, Skull } from 'lucide-react';

export interface CombatEffect {
  type: 'ATTACK' | 'CONQUER' | 'DEFEND';
  damage?: number;
}

interface TileProps {
  tile: Tile;
  isSelected: boolean;
  isValidTarget: boolean;
  combatEffect: CombatEffect | null;
  onClick: (id: number) => void;
}

const TileComponent: React.FC<TileProps> = ({ tile, isSelected, isValidTarget, combatEffect, onClick }) => {
  
  // Base background style depending on owner
  const getBaseStyles = () => {
    switch (tile.owner) {
      case Owner.PLAYER: return 'bg-blue-950 border-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.3)]';
      case Owner.AI: return 'bg-red-950 border-red-500 shadow-[0_0_10px_rgba(239,68,68,0.3)]';
      default: return 'bg-slate-800 border-slate-700 hover:border-slate-500';
    }
  };

  // Icon Logic based on Tile Type
  const getTypeIcon = () => {
    const className = "w-5 h-5 sm:w-6 sm:h-6 transition-transform duration-300 group-hover:scale-110 drop-shadow-md";
    
    // Color logic
    let colorClass = "text-slate-400";
    if (tile.owner === Owner.PLAYER) colorClass = "text-blue-300";
    if (tile.owner === Owner.AI) colorClass = "text-red-300";

    switch (tile.type) {
      case TileType.CAPITAL:
        return <Crown className={`${className} ${tile.owner === Owner.PLAYER ? 'text-yellow-400' : 'text-red-500'}`} />;
      case TileType.MINE:
        return <Pickaxe className={`${className} ${tile.owner !== Owner.NONE ? colorClass : 'text-amber-600'}`} />;
      case TileType.FORTRESS:
        return <Castle className={`${className} ${tile.owner !== Owner.NONE ? colorClass : 'text-slate-300'}`} />;
      case TileType.VILLAGE:
      default:
        return <Tent className={`${className} ${tile.owner !== Owner.NONE ? colorClass : 'text-emerald-600'}`} />;
    }
  };

  return (
    <button
      onClick={() => onClick(tile.id)}
      className={`
        group relative h-16 sm:h-24 w-full rounded-lg border flex flex-col items-center justify-center
        transition-all duration-300 shadow-lg overflow-hidden
        ${getBaseStyles()}
        ${isSelected ? 'ring-2 ring-yellow-400 scale-105 z-10' : ''}
        ${isValidTarget ? 'cursor-pointer hover:scale-105 ring-2 ring-red-400 ring-offset-1 ring-offset-slate-900' : 'cursor-default'}
        ${!isValidTarget && !isSelected ? 'opacity-95' : ''}
        ${combatEffect ? 'animate-shake' : ''}
      `}
    >
      {/* Background Texture Overlay */}
      <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10 pointer-events-none"></div>
      
      {/* Selection/Target Overlay */}
      {isValidTarget && (
        <div className="absolute inset-0 bg-red-500/10 animate-pulse pointer-events-none" />
      )}

      {/* COMBAT EFFECT OVERLAY */}
      {combatEffect && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/40 backdrop-blur-[1px]">
           {/* Visual Clash */}
           <div className="absolute animate-clash text-white drop-shadow-[0_0_10px_rgba(255,0,0,0.8)]">
              {combatEffect.type === 'CONQUER' ? (
                <Skull className="w-10 h-10 text-white" />
              ) : (
                <Swords className="w-10 h-10 text-orange-500" />
              )}
           </div>

           {/* Floating Numbers */}
           {combatEffect.damage !== undefined && (
             <span className="animate-float-up text-3xl font-extrabold text-red-500 text-outline-red z-50">
               -{combatEffect.damage}
             </span>
           )}
        </div>
      )}

      {/* ID Badge (Tiny) */}
      <div className="absolute top-1 right-1 text-[8px] font-bold text-slate-500 font-mono bg-slate-900/50 px-1 rounded">
        {tile.id}
      </div>

      {/* Main Icon */}
      <div className="z-10 mb-0.5 sm:mb-1">
        {getTypeIcon()}
      </div>
      
      {/* Stats Row */}
      <div className="flex items-center gap-1 sm:gap-2 text-[10px] font-bold bg-slate-950/40 rounded-full px-1.5 py-0.5 backdrop-blur-sm z-10 border border-white/5">
        <div className={`flex items-center transition-colors ${combatEffect ? 'text-red-500 scale-110' : 'text-slate-300'}`} title="Défense">
          <Shield className="w-2.5 h-2.5 mr-0.5" />
          {tile.defense}
        </div>
        
        {tile.resourceValue > 0 && (
           <div className="flex items-center text-yellow-500" title="Revenu">
             <Coins className="w-2.5 h-2.5 mr-0.5" />
             +{tile.resourceValue}
           </div>
        )}
      </div>
      
      {/* Ownership Indicator Bar at bottom */}
      {tile.owner !== Owner.NONE && (
        <div className={`absolute bottom-0 left-0 right-0 h-1 ${tile.owner === Owner.PLAYER ? 'bg-blue-500' : 'bg-red-500'}`} />
      )}
    </button>
  );
};

export default TileComponent;