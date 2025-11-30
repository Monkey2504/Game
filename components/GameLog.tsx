import React, { useEffect, useRef } from 'react';

interface GameLogProps {
  logs: string[];
}

const GameLog: React.FC<GameLogProps> = ({ logs }) => {
  const logEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  return (
    <div className="bg-slate-900 border border-slate-700 rounded-lg p-4 h-48 overflow-y-auto font-mono text-sm shadow-inner">
      <h3 className="text-slate-400 font-bold mb-2 uppercase tracking-wider text-xs sticky top-0 bg-slate-900 pb-2 border-b border-slate-800">
        Journal de Bataille
      </h3>
      <div className="space-y-2">
        {logs.length === 0 && <p className="text-slate-600 italic">La partie commence...</p>}
        {logs.map((log, idx) => (
          <div key={idx} className="border-l-2 border-slate-700 pl-2 py-1">
            <p className={log.includes('IA') ? 'text-red-300' : log.includes('Joueur') ? 'text-blue-300' : 'text-slate-400'}>
              {log}
            </p>
          </div>
        ))}
        <div ref={logEndRef} />
      </div>
    </div>
  );
};

export default GameLog;