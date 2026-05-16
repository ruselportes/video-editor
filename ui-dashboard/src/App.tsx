import React, { useState, useRef, useCallback } from 'react';
import { Player } from '@remotion/player';
import type { PlayerRef } from '@remotion/player';
import { VideoComposition, MOCK_BLUEPRINT, type Blueprint } from './VideoComposition';
import './index.css';

function App() {
  const [productName, setProductName] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  
  const [status, setStatus] = useState('idle'); // idle, processing, complete, error
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState('');
  
  const [blueprint, setBlueprint] = useState<Blueprint>(MOCK_BLUEPRINT);
  const [isRealBlueprint, setIsRealBlueprint] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const playerRef = useRef<PlayerRef>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const droppedFile = e.dataTransfer.files[0];
      if (droppedFile.type.startsWith('video/')) {
        setFile(droppedFile);
      } else {
        alert('Please upload a valid video file (.mp4, .mov)');
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
    }
  };

  const loadBlueprint = useCallback(async (name: string) => {
    const safeName = name.replace(/ /g, '_');
    try {
      const res = await fetch(`/blueprints/${safeName}_blueprint.json?t=${Date.now()}`);
      if (!res.ok) throw new Error('Blueprint not found');
      const data: Blueprint = await res.json();
      setBlueprint(data);
      setIsRealBlueprint(true);
      // Auto-play when blueprint loads
      setTimeout(() => playerRef.current?.play(), 300);
    } catch (err) {
      console.warn('Could not load blueprint, keeping mock preview.', err);
    }
  }, []);

  const startGeneration = async () => {
    if (!file || !productName) return;
    
    setStatus('processing');
    setProgress(10);
    setMessage('Uploading raw footage...');
    
    const formData = new FormData();
    formData.append('file', file);
    formData.append('product_name', productName);

    try {
      const response = await fetch('http://localhost:8000/api/generate', {
        method: 'POST',
        body: formData,
      });
      
      if (!response.ok) throw new Error('Failed to start generation');
      
      pollStatus();
    } catch (error) {
      setStatus('error');
      setMessage('Failed to connect to AI Backend.');
      console.error(error);
    }
  };

  const pollStatus = () => {
    const interval = setInterval(async () => {
      try {
        const res = await fetch('http://localhost:8000/api/status');
        const data = await res.json();
        
        setProgress(data.progress);
        setMessage(data.message);
        
        if (data.status === 'complete') {
          clearInterval(interval);
          setStatus(data.status);
          // Load the generated blueprint into the player
          loadBlueprint(productName);
        } else if (data.status === 'error') {
          clearInterval(interval);
          setStatus(data.status);
        }
      } catch (e) {
        console.error("Polling error", e);
      }
    }, 1000);
  };

  const totalFrames = blueprint.total_duration_frames || 1800; // Increased default to 60s

  return (
    <div className="app-layout">
      
      {/* ─── LEFT SIDEBAR: Controls ─── */}
      <aside className="sidebar">
        <div className="sidebar-header">
          <h1 className="logo-text">Faceless AI</h1>
          <span className="logo-badge">Editor</span>
        </div>

        <div className="sidebar-content">
          
          {/* Product Name */}
          <div className="input-group">
            <label className="input-label">Product / Niche</label>
            <input 
              id="product-name-input"
              type="text" 
              className="text-input" 
              placeholder="e.g. Mini Desk Vacuum"
              value={productName}
              onChange={(e) => setProductName(e.target.value)}
              disabled={status === 'processing'}
            />
          </div>

          {/* File Upload */}
          {!file ? (
            <div 
              id="dropzone"
              className={`dropzone ${isDragging ? 'active' : ''}`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileChange} 
                accept="video/*" 
                style={{ display: 'none' }} 
              />
              <span className="dropzone-icon">📥</span>
              <p>Drop raw B-roll here</p>
              <p className="dropzone-hint">
                or <span className="highlight">browse</span>
              </p>
            </div>
          ) : (
            <div className="file-selected">
              <div className="file-info">
                <span className="file-icon">🎬</span>
                <span className="file-name">{file.name}</span>
              </div>
              {status !== 'processing' && (
                <button id="remove-file-btn" className="remove-btn" onClick={() => setFile(null)}>✕</button>
              )}
            </div>
          )}

          {/* Generate Button */}
          <button 
            id="generate-btn"
            className="generate-btn" 
            onClick={startGeneration}
            disabled={!file || !productName || status === 'processing'}
          >
            {status === 'processing' ? 'AI is Working...' : 'Generate TikTok ✨'}
          </button>

          {/* Progress Bar */}
          {status !== 'idle' && (
            <div className="progress-container">
              <div className="progress-header">
                <span className="progress-message">{message}</span>
                <span>{progress}%</span>
              </div>
              <div className="progress-track">
                <div 
                  className="progress-fill" 
                  style={{ 
                    width: `${progress}%`,
                    background: status === 'error' ? 'var(--danger)' : ''
                  }}
                ></div>
              </div>
            </div>
          )}

          {/* Success Message */}
          {status === 'complete' && (
            <div className="success-message">
              🎉 Blueprint loaded into player!
            </div>
          )}
        </div>

        {/* Sidebar Footer */}
        <div className="sidebar-footer">
          <div className="status-dot-row">
            <span className={`status-dot ${status === 'processing' ? 'pulse' : status === 'complete' ? 'green' : ''}`}></span>
            <span className="status-label">
              {status === 'idle' && 'Ready'}
              {status === 'processing' && 'Processing...'}
              {status === 'complete' && 'Complete'}
              {status === 'error' && 'Error'}
            </span>
          </div>
          <p className="footer-text">100% Local • 100% Free</p>
        </div>
      </aside>

      {/* ─── RIGHT: Remotion Player ─── */}
      <main className="player-area">
        
        {!isRealBlueprint && (
          <div className="preview-badge">
            <span>Preview Mode</span>
          </div>
        )}

        <div className="player-wrapper">
          <Player
            ref={playerRef}
            component={VideoComposition}
            inputProps={{ blueprint }}
            durationInFrames={totalFrames}
            fps={30}
            compositionWidth={1080}
            compositionHeight={1920}
            style={{
              width: '100%',
              height: '100%',
              borderRadius: '16px',
              overflow: 'hidden',
            }}
            controls
            loop
            autoPlay
          />
        </div>

        <div className="player-info">
          <span className="project-name">{blueprint.project_name || 'Untitled'}</span>
          <span className="project-meta">
            1080×1920 • 30fps • {Math.round(totalFrames / 30)}s
          </span>
        </div>
      </main>

    </div>
  );
}

export default App;
