
import React, { useState, useEffect } from 'react';
import FileUpload from './components/FileUpload';
import CardList from './components/CardList';
import { generateFlashcardsFromDocument, analyzeDocument, generateAiCleanPlate } from './services/geminiService';
import { downloadAnkiPack, downloadMobileText, downloadMarkdown } from './utils/anki';
import { cropAndAnnotateImage, processInputFile } from './utils/imageProcessing';
import { Flashcard, ProcessingStatus, DocumentAnalysis } from './types';
import { SparklesIcon, DownloadIcon, SparklesIcon as MagicIcon, SkullIcon, ScalpelIcon, TestTubeIcon, CrossIcon, HeartPulseIcon, StethoscopeIcon, FileIcon } from './components/Icons';

const EXAM_TYPES = [
  "USMLE Step 1",
  "USMLE Step 2 CK",
  "MBBS Professional",
  "PLAB",
  "LMCHK",
  "AMC",
  "MCCQE",
  "General Anatomy",
  "Histology Core"
];

const STUDY_TIPS = [
  "Active Recall is 50% more effective than passive reading.",
  "Interleave your study topics to improve retention.",
  "Focus on 'High Yield' concepts first.",
  "Teach the material to an imaginary student to test understanding.",
  "Sleep is when memory consolidation happens—don't skip it.",
  "Use mnemonics for arbitrary lists, logic for systems."
];

const App = () => {
  const [cards, setCards] = useState<Flashcard[]>([]);
  const [status, setStatus] = useState<ProcessingStatus>(ProcessingStatus.IDLE);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileData, setFileData] = useState<{ base64: string; mimeType: string } | null>(null);
  
  // Analysis & Config State
  const [analysis, setAnalysis] = useState<DocumentAnalysis | null>(null);
  const [examType, setExamType] = useState(EXAM_TYPES[0]);
  const [targetCount, setTargetCount] = useState<number>(30);

  // Export Modal State
  const [showExportModal, setShowExportModal] = useState(false);

  // Countdown & Tips State
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [currentTipIndex, setCurrentTipIndex] = useState(0);

  // Countdown Logic
  useEffect(() => {
    if (status === ProcessingStatus.GENERATING && timeLeft > 0) {
        const timer = setTimeout(() => setTimeLeft(prev => prev - 1), 1000);
        return () => clearTimeout(timer);
    }
  }, [status, timeLeft]);

  // Rotate Tips
  useEffect(() => {
    if (status === ProcessingStatus.GENERATING || status === ProcessingStatus.ANALYZING) {
      const interval = setInterval(() => {
        setCurrentTipIndex(prev => (prev + 1) % STUDY_TIPS.length);
      }, 4000); // 4 seconds cycle to match animation
      return () => clearInterval(interval);
    }
  }, [status]);

  const handleFileSelected = async (file: File) => {
    setStatus(ProcessingStatus.READING_FILE);
    setError(null);
    setFileName(file.name);
    setCards([]);
    setAnalysis(null);

    try {
      const { base64, mimeType } = await processInputFile(file);
      
      setFileData({ base64, mimeType });
      
      setStatus(ProcessingStatus.ANALYZING);
      try {
        const result = await analyzeDocument(base64, mimeType);
        setAnalysis(result);
        setTargetCount(result.suggestedCount); 
        setStatus(ProcessingStatus.REVIEW_CONFIG);
      } catch (analysisError: any) {
         console.error(analysisError);
         setError("Could not analyze document structure. Please try again.");
         setStatus(ProcessingStatus.ERROR);
      }
    } catch (err: any) {
      console.error("File Processing Error:", err);
      setError("Failed to process file. Please ensure it is a valid PDF or Image.");
      setStatus(ProcessingStatus.ERROR);
    }
  };

  const handleGenerate = async () => {
    if (!fileData || !analysis) return;

    setStatus(ProcessingStatus.GENERATING);
    const isImage = fileData.mimeType.startsWith('image/');
    setTimeLeft(Math.max(15, Math.ceil(targetCount * 2)));

    try {
      const { cards: generatedCards } = await generateFlashcardsFromDocument(
        fileData.base64,
        fileData.mimeType,
        {
          examType,
          focusArea: analysis.topic,
          cardCount: targetCount,
          language: analysis.language
        }
      );

      if (isImage) {
        setStatus(ProcessingStatus.PROCESSING_IMAGES);
        
        let cleanPlateData = { data: fileData.base64, mimeType: fileData.mimeType };
        try {
            cleanPlateData = await generateAiCleanPlate(fileData.base64, fileData.mimeType);
        } catch (e) {
            console.warn("AI Clean Plate failed, falling back to original", e);
        }
        
        const processedCards = await Promise.all(generatedCards.map(async (card, index) => {
             try {
                // Pass the structureBoundingBox to draw the red arrow
                const newImageBase64 = await cropAndAnnotateImage(
                    cleanPlateData.data, 
                    card.boundingBox, 
                    cleanPlateData.mimeType, 
                    index + 1,
                    card.structureBoundingBox
                );
                return { 
                    ...card, 
                    front: `Identify structure #${index + 1}.`, 
                    image: newImageBase64 
                };
             } catch (e) {
                console.error("Image processing failed for card", card.id, e);
                return card;
             }
        }));
        
        setCards(processedCards);
      } else {
        setCards(generatedCards);
      }

      setStatus(ProcessingStatus.COMPLETE);
    } catch (genError: any) {
      setError(genError.message || "Failed to generate cards");
      setStatus(ProcessingStatus.ERROR);
    }
  };

  const handleUpdateCard = (id: string, field: 'front' | 'back' | 'tags', value: string) => {
    setCards(prev => prev.map(card => {
      if (card.id !== id) return card;
      if (field === 'tags') {
        return { ...card, tags: value.split(" ") };
      }
      return { ...card, [field]: value };
    }));
  };

  const handleDeleteCard = (id: string) => {
    setCards(prev => prev.filter(c => c.id !== id));
  };

  const executeDownload = (type: 'zip' | 'text' | 'markdown') => {
    if (!fileName) return;
    
    if (type === 'zip') {
        downloadAnkiPack(cards, fileName);
    } else if (type === 'text') {
        downloadMobileText(cards, fileName);
    } else if (type === 'markdown') {
        downloadMarkdown(cards, fileName);
    }
    setShowExportModal(false);
  };

  // Custom SVG Logo Animation (Handwriting Effect)
  const MedFlashLogo = () => {
    return (
        <svg viewBox="0 0 400 60" className="h-[60px] w-auto drop-shadow-[0_0_10px_rgba(6,182,212,0.5)]">
             <defs>
                <linearGradient id="textGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#22d3ee" />
                    <stop offset="100%" stopColor="#ffffff" />
                </linearGradient>
            </defs>
            <g fill="none" stroke="url(#textGradient)" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" className="animate-draw">
                {/* M */}
                <path d="M 20 50 L 20 10 L 40 50 L 60 10 L 60 50" />
                {/* E */}
                <path d="M 80 50 L 80 10 L 105 10 M 80 30 L 100 30 M 80 50 L 105 50" />
                {/* D */}
                <path d="M 125 10 L 125 50 L 145 50 Q 165 50 165 30 Q 165 10 145 10 L 125 10" />
                
                {/* F */}
                <path d="M 195 50 L 195 10 L 220 10 M 195 30 L 215 30" />
                {/* L */}
                <path d="M 240 10 L 240 50 L 265 50" />
                {/* A */}
                <path d="M 285 50 L 300 10 L 315 50 M 290 40 L 310 40" />
                {/* S */}
                <path d="M 355 10 Q 335 10 335 20 Q 335 30 345 30 Q 355 30 355 40 Q 355 50 335 50" />
                {/* H */}
                <path d="M 375 10 L 375 50 M 375 30 L 400 30 M 400 10 L 400 50" />
            </g>
        </svg>
    );
  };

  return (
    <div className="min-h-screen bg-[#020617] pb-20 relative overflow-hidden text-slate-200 selection:bg-cyan-500/30">
      
      {/* Background Animated Icons */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden select-none">
        <SkullIcon className="absolute top-[10%] left-[5%] w-32 h-32 text-white/40 animate-float delay-100" />
        <ScalpelIcon className="absolute top-[20%] right-[10%] w-48 h-48 text-slate-200/40 animate-float delay-300" />
        <TestTubeIcon className="absolute bottom-[15%] left-[15%] w-24 h-24 text-white/50 animate-float delay-500" />
        <CrossIcon className="absolute top-[50%] right-[25%] w-20 h-20 text-slate-100/40 animate-float delay-200" />
        <HeartPulseIcon className="absolute bottom-[30%] right-[5%] w-40 h-40 text-white/40 animate-float delay-700" />
        <StethoscopeIcon className="absolute top-[5%] left-[40%] w-32 h-32 text-slate-200/40 animate-float" />
        <SkullIcon className="absolute bottom-[5%] left-[50%] w-20 h-20 text-white/50 animate-float delay-200" />
      </div>

      <header className="sticky top-0 z-50 bg-[#020617]/80 backdrop-blur-md border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-gradient-to-br from-slate-700 to-slate-900 p-2 rounded border border-slate-600 shadow-xl">
              <SparklesIcon className="w-6 h-6 text-cyan-400" />
            </div>
            <h1 className="text-3xl font-airbus font-black text-slate-100 tracking-tighter drop-shadow-md">
              MED FLASH
            </h1>
          </div>
          
          <div className="flex items-center gap-3">
            {cards.length > 0 && (
              <button 
                onClick={() => setShowExportModal(true)}
                className="flex items-center gap-2 bg-slate-100 hover:bg-white text-slate-900 border border-slate-300 px-6 py-2 rounded shadow-lg transition-all font-formal font-bold text-sm tracking-wide hover:scale-105 active:scale-95"
              >
                <DownloadIcon className="w-4 h-4" />
                EXPORT
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 relative z-10">
        
        {status === ProcessingStatus.IDLE && (
          <div className="text-center max-w-3xl mx-auto mb-16 animate-fade-in-up">
            <div className="inline-block mb-6 px-4 py-1.5 rounded-sm bg-slate-800/50 border border-slate-700 text-xs font-bold text-cyan-500 tracking-widest uppercase font-formal">
                Advanced Medical Intelligence
            </div>
            <h2 className="text-5xl md:text-6xl font-formal font-bold text-white mb-8 leading-tight drop-shadow-lg">
              Medical Science <br/> <span className="text-slate-400 font-normal italic">Reimagined</span>
            </h2>
            <p className="text-xl text-slate-400 mb-10 leading-relaxed font-light font-serif">
              Upload lectures, clinical vignettes, or diagnostic images. We extract high-yield concepts, analyze annotations, and generate professional Anki flashcards.
            </p>
          </div>
        )}

        {status === ProcessingStatus.IDLE && (
          <FileUpload 
            onFileSelected={handleFileSelected} 
            isLoading={false} 
          />
        )}

        {(status === ProcessingStatus.READING_FILE || status === ProcessingStatus.ANALYZING || status === ProcessingStatus.GENERATING || status === ProcessingStatus.PROCESSING_IMAGES) && (
          <div className="flex flex-col items-center justify-center py-20 animate-fade-in">
            <div className="mb-10">
                <MedFlashLogo />
            </div>
            
            <h3 className="text-2xl font-formal text-slate-200 tracking-wide mb-2 text-center">
              {status === ProcessingStatus.READING_FILE && "Reading Document..."}
              {status === ProcessingStatus.ANALYZING && "Analyzing Structure..."}
              {status === ProcessingStatus.GENERATING && "Synthesizing Cards..."}
              {status === ProcessingStatus.PROCESSING_IMAGES && "Creating Clean Plate..."}
            </h3>
            
            <div className="h-px w-24 bg-gradient-to-r from-transparent via-cyan-500 to-transparent mb-8"></div>
            
            {status === ProcessingStatus.GENERATING && (
               <div className="text-center mt-4 mb-12">
                  <p className="text-6xl font-formal font-bold text-cyan-400 mb-2">{timeLeft}s</p>
                  <p className="text-xs text-slate-500 font-mono tracking-wider">ESTIMATED TIME REMAINING</p>
               </div>
            )}
            
            <div className="max-w-xl text-center space-y-4">
                <div className="p-4 bg-slate-900/50 border border-slate-800 rounded-lg backdrop-blur-sm h-32 flex flex-col items-center justify-center overflow-hidden">
                    <p className="text-xs text-cyan-400 font-bold uppercase tracking-wider mb-2">Study Tip</p>
                    <p 
                        key={currentTipIndex} 
                        className="text-slate-300 font-serif italic text-lg animate-swift-slide"
                    >
                        "{STUDY_TIPS[currentTipIndex]}"
                    </p>
                </div>
                
                <div className="text-sm text-slate-500">
                    <p className="mb-1">HarryMed is a comprehensive platform for medical resources.</p>
                    <a href="https://harrymedresource.wordpress.com/" target="_blank" rel="noopener noreferrer" className="text-cyan-500 hover:text-cyan-300 underline transition-colors">
                        More resources at harrymedresource.wordpress.com
                    </a>
                </div>
            </div>
          </div>
        )}

        {status === ProcessingStatus.REVIEW_CONFIG && analysis && (
          <div className="max-w-2xl mx-auto bg-slate-800/80 backdrop-blur rounded-xl border border-slate-700 p-8 shadow-2xl animate-fade-in-up">
            <h3 className="text-2xl font-formal font-bold text-white mb-6 flex items-center gap-2">
              <MagicIcon className="w-6 h-6 text-cyan-400" />
              Configuration
            </h3>
            
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="bg-slate-900/50 p-3 rounded border border-slate-700">
                  <span className="text-slate-400 block text-xs uppercase tracking-wider mb-1">Topic</span>
                  <span className="text-white font-serif font-medium">{analysis.topic}</span>
                </div>
                <div className="bg-slate-900/50 p-3 rounded border border-slate-700">
                  <span className="text-slate-400 block text-xs uppercase tracking-wider mb-1">Language</span>
                  <span className="text-white font-serif font-medium">{analysis.language}</span>
                </div>
              </div>

              {analysis.hasImages && (
                  <div className="bg-cyan-900/20 border border-cyan-800/50 p-3 rounded text-sm text-cyan-200">
                    <span className="font-bold">Visual Data Detected:</span> The AI has identified medical imagery. Flashcards will include annotated visual questions.
                  </div>
              )}
              
              <div className="grid grid-cols-1 gap-6">
                 <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-300">Target Exam / Standard</label>
                    <div className="relative">
                        <select 
                            value={examType} 
                            onChange={(e) => setExamType(e.target.value)}
                            className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white focus:ring-1 focus:ring-cyan-500 outline-none appearance-none"
                        >
                            {EXAM_TYPES.map(type => (
                                <option key={type} value={type}>{type}</option>
                            ))}
                        </select>
                        <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500">
                            ▼
                        </div>
                    </div>
                 </div>

                 <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-300">Target Card Count</label>
                    <div className="flex items-center gap-4">
                    <input 
                        type="range" 
                        min="5" 
                        max="100" 
                        value={targetCount} 
                        onChange={(e) => setTargetCount(parseInt(e.target.value))}
                        className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                    />
                    <span className="text-xl font-bold font-mono text-cyan-400 w-12 text-center">{targetCount}</span>
                    </div>
                    <p className="text-xs text-slate-500">
                    Recommended: {analysis.suggestedCount} cards.
                    </p>
                 </div>
              </div>

              <div className="pt-6 flex gap-4">
                <button 
                  onClick={() => setStatus(ProcessingStatus.IDLE)}
                  className="flex-1 py-3 px-4 rounded border border-slate-600 text-slate-300 hover:bg-slate-700 transition-colors font-semibold text-sm"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleGenerate}
                  className="flex-1 py-3 px-4 rounded bg-cyan-600 hover:bg-cyan-500 text-white shadow-lg shadow-cyan-900/20 transition-all font-bold text-sm tracking-wide"
                >
                  GENERATE FLASHCARDS
                </button>
              </div>
            </div>
          </div>
        )}

        {status === ProcessingStatus.COMPLETE && (
           <CardList 
             cards={cards} 
             onUpdate={handleUpdateCard} 
             onDelete={handleDeleteCard} 
           />
        )}

        {status === ProcessingStatus.ERROR && (
          <div className="max-w-md mx-auto bg-red-950/30 border border-red-900/50 rounded-lg p-6 text-center animate-fade-in">
            <div className="inline-flex p-3 rounded-full bg-red-900/20 mb-4">
               <CrossIcon className="w-8 h-8 text-red-500" />
            </div>
            <h3 className="text-lg font-bold text-red-400 mb-2">Generation Failed</h3>
            <p className="text-sm text-red-200/70 mb-6">{error}</p>
            <button 
              onClick={() => setStatus(ProcessingStatus.IDLE)}
              className="px-6 py-2 bg-red-900/50 hover:bg-red-900 border border-red-800 text-red-100 rounded transition-colors text-sm font-semibold"
            >
              Try Again
            </button>
          </div>
        )}
      </main>

      <footer className="fixed bottom-0 w-full py-4 text-center text-slate-600 text-sm border-t border-slate-900 bg-[#020617] z-20">
         <p className="font-formal text-lg text-slate-500 opacity-60">HarryMed Copyright © 2024</p>
      </footer>

      {showExportModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-slate-900 border border-slate-700 rounded-xl max-w-lg w-full p-8 shadow-2xl relative">
            <button 
                onClick={() => setShowExportModal(false)}
                className="absolute top-4 right-4 text-slate-500 hover:text-white"
            >
                <CrossIcon className="w-6 h-6" />
            </button>
            
            <h3 className="text-2xl font-formal font-bold text-white mb-2">Export Flashcards</h3>
            <p className="text-slate-400 text-sm mb-6">Choose the format that fits your study workflow.</p>

            <div className="space-y-4">
                <button 
                    onClick={() => executeDownload('zip')}
                    className="w-full bg-slate-800 hover:bg-slate-700 border border-slate-600 hover:border-cyan-500/50 p-4 rounded-lg flex items-center gap-4 group transition-all"
                >
                    <div className="p-3 rounded-full bg-cyan-900/30 text-cyan-400 group-hover:bg-cyan-500 group-hover:text-white transition-colors">
                        <DownloadIcon className="w-6 h-6" />
                    </div>
                    <div className="text-left">
                        <div className="text-white font-bold flex items-center gap-2">
                             Anki Package (ZIP) 
                             <span className="text-[10px] bg-cyan-900 text-cyan-200 px-1.5 py-0.5 rounded border border-cyan-800">RECOMMENDED</span>
                        </div>
                        <p className="text-xs text-slate-400 mt-1">Best for Images. Import on Desktop, then sync to Mobile.</p>
                    </div>
                </button>

                <button 
                    onClick={() => executeDownload('text')}
                    className="w-full bg-slate-800 hover:bg-slate-700 border border-slate-600 hover:border-slate-500 p-4 rounded-lg flex items-center gap-4 group transition-all"
                >
                    <div className="p-3 rounded-full bg-slate-700/50 text-slate-300 group-hover:bg-slate-600 group-hover:text-white transition-colors">
                        <FileIcon className="w-6 h-6" />
                    </div>
                    <div className="text-left">
                        <div className="text-white font-bold">Anki Mobile (Text Only)</div>
                        <p className="text-xs text-slate-400 mt-1">Simple .txt file. Works directly on mobile but <b>excludes images</b>.</p>
                    </div>
                </button>

                <button 
                    onClick={() => executeDownload('markdown')}
                    className="w-full bg-slate-800 hover:bg-slate-700 border border-slate-600 hover:border-slate-500 p-4 rounded-lg flex items-center gap-4 group transition-all"
                >
                    <div className="p-3 rounded-full bg-slate-700/50 text-slate-300 group-hover:bg-slate-600 group-hover:text-white transition-colors">
                        <FileIcon className="w-6 h-6" />
                    </div>
                    <div className="text-left">
                        <div className="text-white font-bold">Markdown</div>
                        <p className="text-xs text-slate-400 mt-1">For Notion, Obsidian, or other note-taking apps.</p>
                    </div>
                </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default App;
