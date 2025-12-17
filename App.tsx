import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Play, Square, Activity, Terminal, Zap, Trash2, Sliders } from 'lucide-react';
import * as Tone from 'tone';
import { audioService } from './services/audioEngine';
import { LogEntry } from './types';

// Updated code preset with new instruments
const DEFAULT_CODE = `// :: SONIC SHELL ::
// Live Coding Environment

// 1. Kick (4/4)
loop("kick", "4n", (time) => {
  kick.triggerAttackRelease("C1", "8n", time);
});

// 2. Snare (Backbeat)
loop("snare", "2n", (time) => {
  // Offset by a quarter note to hit on 2 & 4
  const t = time + Tone.Time("4n").toSeconds();
  snare.triggerAttackRelease("8n", t);
});

// 3. Acid Bassline
loop("bass", "8n", (time) => {
  const notes = ["C2", "C2", "Eb2", "G2", "C3", "Bb2"];
  const n = notes[Math.floor(Math.random() * notes.length)];
  const vel = 0.5 + Math.random() * 0.5;
  synth.triggerAttackRelease(n, "8n", time, vel);
});

// 4. Ethereal Chords
loop("pads", "1m", (time) => {
   // Randomly choose a chord
   const chords = [
     ["C3", "Eb3", "G3", "Bb3"],
     ["F3", "Ab3", "C4", "Eb4"]
   ];
   const c = chords[Math.floor(Math.random() * chords.length)];
   poly.triggerAttackRelease(c, "1m", time);
});
`;

const App: React.FC = () => {
  const [code, setCode] = useState<string>(DEFAULT_CODE);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [bpm, setBpm] = useState<number>(120);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  
  const logsEndRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const lineNumbersRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Initialize Logs
  useEffect(() => {
    addLog("System initialized. Shell ready.", "system");
  }, []);

  // Auto-scroll logs
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  // Update BPM in real-time
  useEffect(() => {
    audioService.setBpm(bpm);
  }, [bpm]);

  // Visualizer Loop
  useEffect(() => {
    let animationId: number;
    
    const render = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Ensure canvas size matches display size
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      
      if (canvas.width !== rect.width * dpr || canvas.height !== rect.height * dpr) {
        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;
        ctx.scale(dpr, dpr);
      }

      const width = rect.width;
      const height = rect.height;

      // Clear with trail effect
      ctx.fillStyle = 'rgba(5, 5, 5, 0.2)'; 
      ctx.fillRect(0, 0, width, height);

      // Get Data
      let values: Float32Array | number[] = new Float32Array(0);
      if (audioService.analyser) {
        values = audioService.analyser.getValue();
      }

      if (values.length > 0) {
        ctx.lineWidth = 2;
        ctx.strokeStyle = '#4ade80'; // Green-400
        ctx.shadowBlur = 4;
        ctx.shadowColor = '#4ade80';
        ctx.beginPath();

        const sliceWidth = width / values.length;
        let x = 0;

        for (let i = 0; i < values.length; i++) {
          const v = values[i] as number; // -1 to 1
          // Scale to canvas height. v=0 is middle.
          const y = (1 + v) * (height / 2);

          if (i === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
          x += sliceWidth;
        }
        
        ctx.stroke();
      } else {
         // Idle Line
         ctx.beginPath();
         ctx.strokeStyle = '#14532d';
         ctx.lineWidth = 1;
         ctx.shadowBlur = 0;
         ctx.moveTo(0, height / 2);
         ctx.lineTo(width, height / 2);
         ctx.stroke();
      }

      animationId = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(animationId);
  }, []);

  const addLog = useCallback((message: string, type: LogEntry['type']) => {
    const newLog: LogEntry = {
      id: Math.random().toString(36).substr(2, 9),
      timestamp: new Date().toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second:'2-digit' }),
      message,
      type
    };
    setLogs(prev => [...prev.slice(-49), newLog]); // Keep last 50 logs
  }, []);

  const handleRun = async () => {
    addLog("Compiling sequence...", "system");
    
    const success = await audioService.runCode(code, (msg, type) => {
      addLog(msg, type);
    });

    if (success) {
      setIsPlaying(true);
      addLog(">> KERNEL: RUNNING", "success");
    } else {
      setIsPlaying(false);
      addLog(">> KERNEL PANIC: COMPILATION FAILED", "error");
    }
  };

  const handleStop = () => {
    audioService.stop();
    setIsPlaying(false);
    addLog(">> PROCESS TERMINATED", "system");
  };

  const handleClearLogs = () => {
    setLogs([]);
    addLog("Buffer cleared.", "system");
  };

  // Sync scroll between textarea and line numbers
  const handleScroll = (e: React.UIEvent<HTMLTextAreaElement>) => {
    if (lineNumbersRef.current) {
      lineNumbersRef.current.scrollTop = e.currentTarget.scrollTop;
    }
  };

  const lineCount = code.split('\n').length;

  return (
    <div className="h-screen bg-zinc-950 text-green-400 font-mono flex flex-col selection:bg-green-900 selection:text-green-100 overflow-hidden">
      
      {/* BACKGROUND EFFECTS */}
      <div className="fixed inset-0 pointer-events-none z-0 opacity-10 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[length:100%_2px,3px_100%]"></div>
      
      {/* HEADER */}
      <header className="h-16 shrink-0 border-b border-green-500/30 flex items-center justify-between px-6 z-10 bg-zinc-950/90 backdrop-blur">
        <div className="flex items-center gap-3">
          <Activity className={`w-6 h-6 ${isPlaying ? 'animate-pulse text-green-400' : 'text-green-800'}`} />
          <h1 className="text-xl font-bold tracking-widest text-shadow-glow">SONIC_SHELL <span className="text-xs opacity-50 font-normal">v1.1</span></h1>
        </div>
        
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3 bg-zinc-900/50 px-4 py-2 rounded border border-green-500/20">
            <Sliders className="w-4 h-4 opacity-70" />
            <span className="text-sm font-bold min-w-[3ch]">{bpm}</span>
            <span className="text-xs opacity-50">BPM</span>
            <input 
              type="range" 
              min="60" 
              max="200" 
              value={bpm} 
              onChange={(e) => setBpm(parseInt(e.target.value))}
              className="w-32 h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-green-500"
            />
          </div>
          <div className="text-xs text-green-500/50 flex gap-2">
            <span>MEM: 64K</span>
            <span>CPU: 12%</span>
          </div>
        </div>
      </header>

      {/* MAIN CONTENT */}
      <main className="flex-1 flex overflow-hidden z-10 relative">
        
        {/* LEFT: EDITOR */}
        <section className="w-3/5 flex flex-col border-r border-green-500/30">
          <div className="bg-zinc-900/50 px-4 py-2 text-xs flex justify-between items-center border-b border-green-500/20 text-green-500/70 shrink-0">
            <span className="flex items-center gap-2"><Terminal className="w-3 h-3"/> MAIN.JS</span>
            <span>UTF-8</span>
          </div>
          
          <div className="flex-1 relative flex bg-[#050505] min-h-0">
            {/* Line Numbers */}
            <div 
              ref={lineNumbersRef}
              className="w-12 pt-6 pr-2 text-right text-green-900 select-none overflow-hidden font-mono text-sm leading-relaxed border-r border-green-900/20 h-full"
            >
              {Array.from({ length: lineCount }).map((_, i) => (
                <div key={i}>{i + 1}</div>
              ))}
            </div>

            {/* Editor Area */}
            <div className="flex-1 relative group h-full">
              <textarea 
                ref={textareaRef}
                value={code}
                onChange={(e) => setCode(e.target.value)}
                onScroll={handleScroll}
                className="w-full h-full bg-transparent text-green-400 p-6 pt-6 resize-none outline-none border-none font-mono text-sm leading-relaxed"
                spellCheck="false"
                autoComplete="off"
              />
              {/* Editor Glow Overlay */}
              <div className="absolute inset-0 pointer-events-none shadow-[inset_0_0_50px_rgba(0,0,0,0.8)]"></div>
            </div>
          </div>
        </section>

        {/* RIGHT: OUTPUT & VISUALS */}
        <section className="w-2/5 flex flex-col bg-zinc-900/20">
          
          {/* TOP: VISUALIZER (Real Canvas) */}
          <div className="h-1/3 border-b border-green-500/30 relative flex items-center justify-center overflow-hidden bg-black shrink-0">
            <div className="absolute top-2 left-2 text-[10px] opacity-50 tracking-widest z-10">OSCILLOSCOPE_X</div>
            
            <canvas 
              ref={canvasRef} 
              className="w-full h-full block"
            />
            
            {/* Grid overlay */}
            <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(rgba(0,255,0,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(0,255,0,0.05)_1px,transparent_1px)] bg-[length:20px_20px]"></div>
          </div>

          {/* BOTTOM: CONSOLE */}
          <div className="flex-1 flex flex-col min-h-0 bg-[#0a0a0a]">
            <div className="flex items-center justify-between px-4 py-2 border-b border-green-500/20 bg-zinc-900/50 shrink-0">
              <span className="text-xs font-bold opacity-70 flex items-center gap-2">
                <Zap className="w-3 h-3" /> KERNEL_LOG
              </span>
              <button onClick={handleClearLogs} className="hover:text-white transition-colors">
                <Trash2 className="w-3 h-3 opacity-50" />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 font-mono text-xs space-y-1 custom-scrollbar">
              {logs.map((log) => (
                <div key={log.id} className={`flex gap-3 ${
                  log.type === 'error' ? 'text-red-400' : 
                  log.type === 'success' ? 'text-green-300 font-bold' : 
                  log.type === 'system' ? 'text-green-600 italic' : 
                  'text-green-400/80'
                }`}>
                  <span className="opacity-30 shrink-0">[{log.timestamp}]</span>
                  <span className="break-all">{log.message}</span>
                </div>
              ))}
              <div ref={logsEndRef} />
            </div>
          </div>
        </section>
      </main>

      {/* FOOTER: CONTROLS */}
      <footer className="h-20 shrink-0 bg-zinc-950 border-t border-green-500/30 flex items-center justify-between px-8 z-20">
        <div className="flex items-center gap-4">
           <button 
             onClick={handleRun}
             className={`
               group relative px-8 py-3 bg-green-900/20 border border-green-500/50 text-green-400 font-bold tracking-widest uppercase overflow-hidden transition-all
               hover:bg-green-500 hover:text-black hover:shadow-[0_0_20px_rgba(74,222,128,0.6)] hover:border-green-400
               active:scale-95
             `}
           >
             <span className="relative z-10 flex items-center gap-2">
               <Play className="w-4 h-4 fill-current" /> EXECUTE_
             </span>
             {/* Scanline effect on button */}
             <div className="absolute inset-0 bg-white/10 translate-y-full group-hover:animate-[scanline_1s_linear_infinite]"></div>
           </button>

           <button 
             onClick={handleStop}
             className={`
               px-6 py-3 border border-red-900/50 text-red-500/70 font-bold tracking-widest uppercase transition-all
               hover:bg-red-900/20 hover:text-red-400 hover:border-red-500/50
               active:scale-95
             `}
           >
             <span className="flex items-center gap-2">
               <Square className="w-4 h-4 fill-current" /> ABORT
             </span>
           </button>
        </div>

        <div className="text-[10px] text-green-900 flex flex-col items-end">
          <div>AUDIO_DAEMON: {isPlaying ? 'ONLINE' : 'IDLE'}</div>
          <div>BUFFER: 256ms</div>
        </div>
      </footer>
    </div>
  );
};

export default App;