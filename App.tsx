import React, { useState, useRef } from 'react';
import FileUpload from './components/FileUpload';
import CardList from './components/CardList';
import { generateFlashcardsFromDocument, analyzeDocument } from './services/geminiService';
import { downloadAnkiCsv } from './utils/anki';
import { Flashcard, ProcessingStatus, DocumentAnalysis } from './types';
import { SparklesIcon, DownloadIcon, FileIcon } from './components/Icons';

const App = () => {
  const [cards, setCards] = useState<Flashcard[]>([]);
  const [status, setStatus] = useState<ProcessingStatus>(ProcessingStatus.IDLE);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileData, setFileData] = useState<{ base64: string; mimeType: string } | null>(null);
  
  // Analysis & Config State
  const [analysis, setAnalysis] = useState<DocumentAnalysis | null>(null);
  const [examType, setExamType] = useState("USMLE Step 1");
  const [targetCount, setTargetCount] = useState<number>(30); // Numerical value now
  
  const handleFileSelected = async (file: File) => {
    setStatus(ProcessingStatus.READING_FILE);
    setError(null);
    setFileName(file.name);
    setCards([]);
    setAnalysis(null);

    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const base64Data = e.target?.result as string;
        const base64Content = base64Data.split(',')[1];
        
        setFileData({ base64: base64Content, mimeType: file.type });
        
        // Start Analysis
        setStatus(ProcessingStatus.ANALYZING);
        try {
          const result = await analyzeDocument(base64Content, file.type);
          setAnalysis(result);
          setTargetCount(result.suggestedCount); // Auto-set recommendation
          setStatus(ProcessingStatus.REVIEW_CONFIG);
        } catch (analysisError: any) {
           setError("Could not analyze document structure. Please try again.");
           setStatus(ProcessingStatus.ERROR);
        }
      };
      
      reader.onerror = () => {
        setError("Failed to read file");
        setStatus(ProcessingStatus.ERROR);
      };

      reader.readAsDataURL(file);
    } catch (err: any) {
      setError(err.message);
      setStatus(ProcessingStatus.ERROR);
    }
  };

  const handleGenerate = async () => {
    if (!fileData || !analysis) return;

    setStatus(ProcessingStatus.GENERATING);
    try {
      const generatedCards = await generateFlashcardsFromDocument(
        fileData.base64,
        fileData.mimeType,
        {
          examType,
          focusArea: analysis.topic,
          cardCount: targetCount,
          language: analysis.language
        }
      );
      setCards(generatedCards);
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

  const handleDownload = () => {
    if (cards.length === 0 || !fileName) return;
    downloadAnkiCsv(cards, fileName);
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-blue-600 p-1.5 rounded-lg">
              <SparklesIcon className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-xl font-bold bg-gradient-to-r from-blue-700 to-blue-500 bg-clip-text text-transparent">
              MedFlash AI
            </h1>
          </div>
          
          {cards.length > 0 && (
            <button 
              onClick={handleDownload}
              className="flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors shadow-sm"
            >
              <DownloadIcon className="w-4 h-4" />
              Export CSV
            </button>
          )}
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        
        {/* Intro */}
        {status === ProcessingStatus.IDLE && (
          <div className="text-center max-w-2xl mx-auto mb-12">
            <h2 className="text-4xl font-extrabold text-slate-900 mb-4 tracking-tight">
              Turn Lectures into <br/>
              <span className="text-blue-600">High-Yield Anki Cards</span>
            </h2>
            <p className="text-lg text-slate-600 mb-8 leading-relaxed">
              Upload your PDF/PPT slides. We analyze the content, detect language, and extract key concepts with correct medical symbols (Δ, γ, Na<sup>+</sup>).
            </p>
          </div>
        )}

        {/* Upload Area */}
        {status === ProcessingStatus.IDLE && (
          <FileUpload onFileSelected={handleFileSelected} isLoading={false} />
        )}

        {/* Loading States (Reading / Analyzing / Generating) */}
        {(status === ProcessingStatus.READING_FILE || status === ProcessingStatus.ANALYZING || status === ProcessingStatus.GENERATING) && (
          <div className="flex flex-col items-center justify-center py-20 animate-fade-in">
            <div className="relative w-20 h-20">
              <div className="absolute inset-0 border-4 border-slate-100 rounded-full"></div>
              <div className="absolute inset-0 border-4 border-blue-500 rounded-full border-t-transparent animate-spin"></div>
            </div>
            <h3 className="mt-6 text-xl font-semibold text-slate-800">
              {status === ProcessingStatus.READING_FILE && "Reading Document..."}
              {status === ProcessingStatus.ANALYZING && "Analyzing Structure & Language..."}
              {status === ProcessingStatus.GENERATING && "Crafting Flashcards..."}
            </h3>
            <p className="mt-2 text-slate-500 max-w-md text-center">
              {status === ProcessingStatus.ANALYZING && "Calculating optimal card count based on information density..."}
              {status === ProcessingStatus.GENERATING && `Generating ${targetCount} high-yield cards in ${analysis?.language}...`}
            </p>
          </div>
        )}

        {/* Review Config State (The "Smart" Step) */}
        {status === ProcessingStatus.REVIEW_CONFIG && analysis && (
          <div className="max-w-2xl mx-auto animate-fade-in">
            <div className="bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
              <div className="p-6 bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-blue-100">
                <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                  <SparklesIcon className="w-5 h-5 text-blue-600" />
                  Document Analysis
                </h3>
                <p className="text-slate-600 text-sm mt-1">We've scanned your file. Here's what we found.</p>
              </div>

              <div className="p-8 space-y-8">
                {/* Detected Info */}
                <div className="grid grid-cols-2 gap-6">
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Detected Language</p>
                    <p className="font-semibold text-slate-900">{analysis.language}</p>
                  </div>
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Primary Topic</p>
                    <p className="font-semibold text-slate-900">{analysis.topic}</p>
                  </div>
                </div>

                {/* Exam Selector */}
                <div>
                   <label className="block text-sm font-semibold text-slate-700 mb-2">Target Exam</label>
                   <select 
                      value={examType} 
                      onChange={(e) => setExamType(e.target.value)}
                      className="w-full p-3 bg-white border border-slate-300 rounded-lg text-slate-700 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                    >
                      <option>USMLE Step 1</option>
                      <option>USMLE Step 2 CK</option>
                      <option>HKU MBBS</option>
                      <option>CUHK MBChB</option>
                      <option>LMCHK</option>
                      <option>General Medicine</option>
                    </select>
                </div>

                {/* Card Count Slider */}
                <div>
                  <div className="flex justify-between items-end mb-4">
                    <label className="block text-sm font-semibold text-slate-700">
                      Card Quantity
                    </label>
                    <span className="text-2xl font-bold text-blue-600">{targetCount}</span>
                  </div>
                  
                  <input 
                    type="range" 
                    min="5" 
                    max="100" 
                    step="5"
                    value={targetCount}
                    onChange={(e) => setTargetCount(parseInt(e.target.value))}
                    className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                  />
                  <div className="flex justify-between text-xs text-slate-400 mt-2">
                    <span>5 (Brief)</span>
                    <span className="text-blue-500 font-medium">AI Recommended: {analysis.suggestedCount}</span>
                    <span>100 (Deep)</span>
                  </div>
                  <p className="text-sm text-slate-500 mt-3 bg-yellow-50 p-3 rounded-lg border border-yellow-100">
                    <span className="font-semibold text-yellow-700">AI Reasoning:</span> {analysis.reasoning}
                  </p>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-4 pt-4">
                   <button 
                    onClick={() => setStatus(ProcessingStatus.IDLE)}
                    className="flex-1 px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={handleGenerate}
                    className="flex-[2] px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg shadow-md transition-all transform hover:scale-[1.02]"
                  >
                    Generate Cards
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Error State */}
        {status === ProcessingStatus.ERROR && (
          <div className="max-w-lg mx-auto bg-red-50 border border-red-100 rounded-xl p-6 text-center">
            <div className="w-12 h-12 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-red-900 mb-2">Processing Failed</h3>
            <p className="text-red-600 mb-6">{error}</p>
            <button 
              onClick={() => setStatus(ProcessingStatus.IDLE)}
              className="px-6 py-2 bg-white border border-red-200 text-red-600 font-medium rounded-lg hover:bg-red-50 transition-colors"
            >
              Try Again
            </button>
          </div>
        )}

        {/* Results */}
        {status === ProcessingStatus.COMPLETE && (
          <div className="animate-fade-in">
            <div className="flex items-center justify-center gap-3 mb-8 text-slate-500">
               <FileIcon className="w-5 h-5" />
               <span className="font-medium text-slate-700">{fileName}</span>
               <span className="w-1 h-1 bg-slate-300 rounded-full"></span>
               <span className="text-sm bg-blue-50 text-blue-600 px-2 py-0.5 rounded-md border border-blue-100">
                 {analysis?.language}
               </span>
               <button onClick={() => setStatus(ProcessingStatus.IDLE)} className="text-blue-600 hover:underline text-sm font-medium ml-4">Process New File</button>
            </div>
            
            <CardList cards={cards} onDelete={handleDeleteCard} onUpdate={handleUpdateCard} />
            
            <div className="max-w-4xl mx-auto mt-12 p-6 bg-blue-50 rounded-xl border border-blue-100 flex flex-col md:flex-row items-center justify-between gap-4">
              <div>
                <h4 className="font-semibold text-blue-900">Ready to study?</h4>
                <p className="text-sm text-blue-700">Download the CSV and import it into Anki (File &gt; Import).</p>
                <p className="text-xs text-blue-500 mt-1">Supports HTML (subscripts, superscripts) & Greek symbols.</p>
              </div>
              <button 
                onClick={handleDownload}
                className="w-full md:w-auto px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg shadow-md transition-all transform hover:scale-105"
              >
                Download .CSV
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default App;