import React, { useCallback, useState } from 'react';
import { UploadIcon, FileIcon } from './Icons';

interface FileUploadProps {
  onFileSelected: (file: File) => void;
  isLoading: boolean;
}

const FileUpload: React.FC<FileUploadProps> = ({ onFileSelected, isLoading }) => {
  const [dragActive, setDragActive] = useState(false);

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

  return (
    <div className="w-full max-w-2xl mx-auto mb-8">
      <div 
        className={`relative flex flex-col items-center justify-center w-full h-64 border-2 border-dashed rounded-xl transition-all duration-300 ease-in-out
          ${dragActive 
            ? 'border-blue-500 bg-blue-50 scale-[1.02] shadow-lg' 
            : 'border-slate-300 bg-white hover:bg-slate-50 hover:border-blue-400'
          } ${isLoading ? 'opacity-50 pointer-events-none' : ''}`}
        onDragEnter={handleDrag} 
        onDragLeave={handleDrag} 
        onDragOver={handleDrag} 
        onDrop={handleDrop}
      >
        <div className="flex flex-col items-center justify-center pt-5 pb-6">
          <div className={`p-4 rounded-full mb-4 ${dragActive ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 text-slate-500'}`}>
            <UploadIcon className="w-8 h-8" />
          </div>
          <p className="mb-2 text-sm text-slate-700 font-semibold">
            <span className="font-bold text-blue-600">Click to upload</span> or drag and drop
          </p>
          <p className="text-xs text-slate-500">PDF or PPT (MAX. 20MB)</p>
          <p className="text-xs text-slate-400 mt-2">Best for: USMLE, MBBS, Medical Lectures</p>
        </div>
        <input 
          id="dropzone-file" 
          type="file" 
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" 
          onChange={handleChange}
          accept=".pdf,.ppt,.pptx"
          disabled={isLoading}
        />
      </div>
    </div>
  );
};

export default FileUpload;
