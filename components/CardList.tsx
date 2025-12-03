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
    <div className="w-full max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
          Generated Cards
          <span className="text-sm font-normal text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
            {cards.length}
          </span>
        </h3>
      </div>
      
      <div className="grid grid-cols-1 gap-6">
        {cards.map((card) => (
          <div key={card.id} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden hover:shadow-md transition-shadow">
            <div className="p-1 bg-slate-50 border-b border-slate-100 flex justify-end">
               <button 
                onClick={() => onDelete(card.id)}
                className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                title="Delete Card"
              >
                <TrashIcon className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4 md:p-6 grid md:grid-cols-2 gap-6">
              {/* Front */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Front</label>
                <textarea
                  value={card.front}
                  onChange={(e) => onUpdate(card.id, 'front', e.target.value)}
                  className="w-full p-3 text-sm text-slate-800 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all resize-none h-32"
                />
              </div>

              {/* Back */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Back</label>
                <textarea
                  value={card.back}
                  onChange={(e) => onUpdate(card.id, 'back', e.target.value)}
                  className="w-full p-3 text-sm text-slate-800 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all resize-none h-32"
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
                 className="w-full p-2 text-xs text-blue-600 bg-blue-50 border border-blue-100 rounded-lg focus:ring-1 focus:ring-blue-500 outline-none font-mono"
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
