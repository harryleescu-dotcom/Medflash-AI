import React, { useCallback, useState, useEffect } from 'react';
import { UploadIcon } from './Icons';

interface FileUploadProps {
  onFileSelected: (file: File) => void;
  isLoading: boolean;
}

const FileUpload: React.FC<FileUploadProps> = ({ onFileSelected, isLoading }) => {
  const [mode, setMode] = useState<'upload' | 'paste'>('upload');
  const [dragActive, setDragActive] = useState(false);
  const [pastedText, setPastedText] = useState('');

  // Handle Global Paste (Ctrl+V) for Files/Images
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      // If we are in text mode, let the textarea handle the paste naturally
      if (mode === 'paste') return;

      if (e.clipboardData && e.clipboardData.files.length > 0) {
        e.preventDefault();
        const file = e.clipboardData.files[0];
        onFileSelected(file);
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => {
      window.removeEventListener('paste', handlePaste);
    };
  }, [onFileSelected, mode]);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      onFileSelected(e.dataTransfer.files[0]);
    }
  }, [onFileSelected]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      onFileSelected(e.target.files[0]);
    }
  };

  const handleTextSubmit = () => {
    if (!pastedText.trim()) return;
    // Create a generic filename. Using .txt extension ensures it is treated as text.
    const file = new File([pastedText], "notes.txt", { type: 'text/plain' });
    onFileSelected(file);
  };

  return (
    <div className="w-full max-w-2xl mx-auto mb-8 animate-fade-in-up">
      {mode === 'upload' ? (
        <div 
            className={`relative flex flex-col items-center justify-center w-full h-64 border-2 border-dashed rounded-xl transition-all duration-300 ease-in-out
            ${dragActive 
                ? 'border-cyan-500 bg-slate-800/80 scale-[1.02] shadow-[0_0_20px_rgba(6,182,212,0.3)]' 
                : 'border-slate-700 bg-slate-800/50 hover:bg-slate-800 hover:border-cyan-500/50'
            } ${isLoading ? 'opacity-50 pointer-events-none' : ''}`}
            onDragEnter={handleDrag} 
            onDragLeave={handleDrag} 
            onDragOver={handleDrag} 
            onDrop={handleDrop}
        >
            <div className="flex flex-col items-center justify-center pt-5 pb-6 pointer-events-none">
                <div className={`p-4 rounded-full mb-4 transition-colors ${dragActive ? 'bg-cyan-500/20 text-cyan-400' : 'bg-slate-700/50 text-slate-400'}`}>
                    <UploadIcon className="w-10 h-10" />
                </div>
                <p className="mb-2 text-sm text-slate-300 font-semibold">
                    <span className="font-bold text-cyan-400">Click to upload</span>, drag and drop, or <span className="font-bold text-cyan-400">Paste (Ctrl+V)</span>
                </p>
                <p className="text-xs text-slate-500">PDF, PPT, DOC, PNG, JPG (MAX. 20MB)</p>
                <p className="text-xs text-slate-500 mt-2">Optimized for: Anatomy, Histology, Pathology, MBBS</p>
            </div>
            
            {/* File Input Layer */}
            <input 
                id="dropzone-file" 
                type="file" 
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" 
                onChange={handleChange}
                accept=".pdf,.ppt,.pptx,.doc,.docx,.png,.jpg,.jpeg,.txt"
                disabled={isLoading}
            />

            {/* Paste Switch Button - Placed above input via Z-index */}
            <button
                onClick={(e) => {
                    e.preventDefault(); 
                    e.stopPropagation(); // Stop click from triggering file input
                    setMode('paste');
                }}
                className="absolute bottom-4 z-20 text-xs font-bold text-cyan-500 hover:text-cyan-300 hover:underline transition-colors pointer-events-auto"
            >
                Or type/paste text content manually
            </button>
        </div>
      ) : (
        <div className="relative w-full h-64 animate-fade-in bg-slate-800/50 rounded-xl border border-slate-700 flex flex-col overflow-hidden">
            <textarea
                value={pastedText}
                onChange={(e) => setPastedText(e.target.value)}
                placeholder="Type or paste your lecture notes, clinical vignettes, or medical text summaries here..."
                className="w-full h-full p-6 bg-transparent border-none focus:ring-0 outline-none text-slate-200 placeholder-slate-500 resize-none font-merriweather leading-relaxed custom-scrollbar pb-16"
                disabled={isLoading}
                autoFocus
            />
            
            <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-slate-900 via-slate-900/90 to-transparent flex justify-end gap-3">
                 <button
                    onClick={() => setMode('upload')}
                    className="text-slate-400 hover:text-white px-4 py-2 text-xs font-bold transition-colors"
                >
                    Cancel
                </button>
                <button
                    onClick={handleTextSubmit}
                    disabled={!pastedText.trim() || isLoading}
                    className="bg-cyan-600 hover:bg-cyan-500 disabled:bg-slate-700 disabled:text-slate-500 text-white px-6 py-2 rounded-lg font-bold text-sm shadow-lg transition-all hover:scale-105 active:scale-95"
                >
                    Analyze
                </button>
            </div>
        </div>
      )}
    </div>
  );
};

export default FileUpload;