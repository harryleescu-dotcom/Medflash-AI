import React from 'react';
import { Flashcard } from '../types';
import { TrashIcon } from './Icons';

interface CardListProps {
  cards: Flashcard[];
  onDelete: (id: string) => void;
  onUpdate: (id: string, field: 'front' | 'back' | 'tags', value: string) => void;
}

const CardList: React.FC<CardListProps> = ({ cards, onDelete, onUpdate }) => {
  if (cards.length === 0) return null;

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6 animate-fade-in">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xl font-bold text-slate-100 flex items-center gap-2">
          Generated Cards
          <span className="text-sm font-normal text-cyan-200 bg-cyan-900/50 border border-cyan-700/50 px-2 py-0.5 rounded-full">
            {cards.length}
          </span>
        </h3>
      </div>
      
      <div className="grid grid-cols-1 gap-6">
        {cards.map((card) => (
          <div key={card.id} className="bg-slate-800 rounded-xl shadow-lg border border-slate-700 overflow-hidden hover:border-cyan-500/50 transition-colors">
            <div className="p-2 bg-slate-900/50 border-b border-slate-700 flex justify-end">
               <button 
                onClick={() => onDelete(card.id)}
                className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-red-900/20 rounded transition-colors"
                title="Delete Card"
              >
                <TrashIcon className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4 md:p-6 grid md:grid-cols-2 gap-6">
              {/* Front */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex justify-between">
                  Front
                  {card.boundingBox && <span className="text-cyan-500 text-[10px]">COORDINATES DETECTED</span>}
                </label>
                
                {/* Visual Preview if Image Exists */}
                {card.image && (
                    <div className="w-full h-40 bg-black/40 rounded border border-slate-600/50 mb-2 overflow-hidden flex items-center justify-center relative group">
                        <div className="absolute inset-0 bg-slate-800/20 pointer-events-none"></div>
                        <img 
                            src={card.image} 
                            alt="Visual Question Data" 
                            className="h-full w-auto object-contain z-10"
                        />
                    </div>
                )}

                <div className="relative">
                    <textarea
                    value={card.front}
                    onChange={(e) => onUpdate(card.id, 'front', e.target.value)}
                    className="w-full p-3 text-sm text-slate-200 bg-slate-900/50 border border-slate-700 rounded-lg focus:ring-1 focus:ring-cyan-500 focus:border-cyan-500 outline-none transition-all resize-none h-32 font-medium"
                    />
                </div>
              </div>

              {/* Back */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Back</label>
                <textarea
                  value={card.back}
                  onChange={(e) => onUpdate(card.id, 'back', e.target.value)}
                  className="w-full p-3 text-sm text-slate-200 bg-slate-900/50 border border-slate-700 rounded-lg focus:ring-1 focus:ring-cyan-500 focus:border-cyan-500 outline-none transition-all resize-none md:h-full h-32"
                />
              </div>
            </div>
            
            {/* Tags */}
            <div className="px-6 pb-4 pt-0">
               <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1 block">Tags</label>
               <input
                 type="text"
                 value={card.tags.join(" ")}
                 onChange={(e) => onUpdate(card.id, 'tags', e.target.value)}
                 className="w-full p-2 text-xs text-cyan-400 bg-cyan-950/30 border border-cyan-900/50 rounded-lg focus:ring-1 focus:ring-cyan-500 outline-none font-mono"
                 placeholder="Enter tags separated by space..."
               />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default CardList;