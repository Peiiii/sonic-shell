import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Play, Square, Activity, Terminal, Zap, Trash2, Sliders, Bot, X, Wand2, Shuffle, Send, Loader2, MessageSquare } from 'lucide-react';
import * as Tone from 'tone';
import { GoogleGenAI, Type, FunctionDeclaration, Chat, GenerateContentResponse } from "@google/genai";
import { audioService } from './services/audioEngine';
import { LogEntry } from './types';

// Updated code preset with new instruments
const DEFAULT_CODE = `// :: SONIC SHELL ::
// Live Coding Environment
// Shortcuts: Ctrl+Enter (Run), Ctrl+. (Stop)

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

interface ChatMessage {
  role: 'user' | 'model' | 'system';
  text: string;
}

const App: React.FC = () => {
  const [code, setCode] = useState<string>(DEFAULT_CODE);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [bpm, setBpm] = useState<number>(120);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  
  // Visualizer State
  const [visMode, setVisMode] = useState<'waveform' | 'fft'>('waveform');
  
  // AI Agent State
  const [isAgentOpen, setIsAgentOpen] = useState<boolean>(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: 'model', text: 'GHOST_IN_SHELL Online. I can write and compile audio code. What do you need?' }
  ]);
  const [input, setInput] = useState<string>("");
  const [isAgentProcessing, setIsAgentProcessing] = useState<boolean>(false);
  
  // Refs
  const logsEndRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const lineNumbersRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  
  // Initialize AI Chat Session Ref
  const chatSessionRef = useRef<Chat | null>(null);

  // Initialize Logs
  useEffect(() => {
    addLog("System initialized. Shell ready.", "system");
    addLog("GHOST_IN_SHELL (AI) module loaded.", "info");
    initializeAgent();
  }, []);

  // Auto-scroll logs & messages
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isAgentOpen]);

  // Update BPM in real-time
  useEffect(() => {
    audioService.setBpm(bpm);
  }, [bpm]);

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        handleRun();
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === '.' || e.key === 'Backspace')) {
        e.preventDefault();
        handleStop();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [code]); 

  // Update Analyser Type
  useEffect(() => {
    audioService.setAnalyserType(visMode);
  }, [visMode]);

  // Visualizer Loop
  useEffect(() => {
    let animationId: number;
    
    const render = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      if (canvas.width !== rect.width * dpr || canvas.height !== rect.height * dpr) {
        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;
        ctx.scale(dpr, dpr);
      }

      const width = rect.width;
      const height = rect.height;

      ctx.fillStyle = 'rgba(5, 5, 5, 0.2)'; 
      ctx.fillRect(0, 0, width, height);

      let values: Float32Array | number[] = new Float32Array(0);
      if (audioService.analyser) {
        const rawValues = audioService.analyser.getValue();
        if (rawValues instanceof Float32Array) {
          values = rawValues;
        } else if (Array.isArray(rawValues)) {
          values = rawValues[0];
        }
      }

      if (values.length > 0) {
        ctx.fillStyle = '#4ade80';
        ctx.strokeStyle = '#4ade80';
        ctx.shadowBlur = 4;
        ctx.shadowColor = '#4ade80';

        if (visMode === 'waveform') {
          ctx.lineWidth = 2;
          ctx.beginPath();
          const sliceWidth = width / values.length;
          let x = 0;
          for (let i = 0; i < values.length; i++) {
            const v = values[i] as number; 
            const y = (1 + v) * (height / 2);
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
            x += sliceWidth;
          }
          ctx.stroke();
        } else {
          const barWidth = (width / values.length) * 2.5;
          let x = 0;
          for (let i = 0; i < values.length; i++) {
            const v = values[i] as number; 
            const normalized = (v + 140) / 140; 
            const barHeight = Math.max(0, normalized * height);
            ctx.fillRect(x, height - barHeight, barWidth, barHeight);
            x += barWidth + 1;
            if (x > width) break;
          }
        }
      } else {
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
  }, [visMode]);

  const addLog = useCallback((message: string, type: LogEntry['type']) => {
    const newLog: LogEntry = {
      id: Math.random().toString(36).substr(2, 9),
      timestamp: new Date().toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second:'2-digit' }),
      message,
      type
    };
    setLogs(prev => [...prev.slice(-49), newLog]);
  }, []);

  const handleRun = async (codeToRun?: string) => {
    const targetCode = codeToRun || code;
    addLog("Compiling sequence...", "system");
    const result = await audioService.runCode(targetCode, (msg, type) => {
      addLog(msg, type);
    });
    
    if (result.success) {
      setIsPlaying(true);
      addLog(">> KERNEL: RUNNING", "success");
      return { success: true };
    } else {
      setIsPlaying(false);
      addLog(`>> KERNEL PANIC: ${result.error}`, "error");
      return { success: false, error: result.error };
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

  const handleScroll = (e: React.UIEvent<HTMLTextAreaElement>) => {
    if (lineNumbersRef.current) {
      lineNumbersRef.current.scrollTop = e.currentTarget.scrollTop;
    }
  };

  // --------------------------------------------------------------------------
  // AI AGENT LOGIC
  // --------------------------------------------------------------------------

  const initializeAgent = () => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    const runCodeTool: FunctionDeclaration = {
      name: "run_generated_code",
      description: "Compiles and runs the generated Tone.js code. Returns success or error message.",
      parameters: {
        type: Type.OBJECT,
        properties: {
          code: {
            type: Type.STRING,
            description: "The JavaScript code to execute.",
          },
        },
        required: ["code"],
      },
    };

    const systemInstruction = `
      You are GHOST_IN_SHELL, an advanced audio live-coding agent.
      Your job is to write Tone.js code to make music based on user requests.
      
      AVAILABLE INSTRUMENTS:
      - kick (MembraneSynth)
      - snare (NoiseSynth)
      - hat (MetalSynth)
      - synth (MonoSynth)
      - poly (PolySynth)
      
      HELPER: loop(name, interval, callback)
      
      RULES:
      1. ALWAYS call the tool 'run_generated_code' when you write code. Do not just show it.
      2. If the tool returns an ERROR, you MUST analyze the error, rewrite the code to fix it, and call 'run_generated_code' again.
      3. Repeat this until the code runs successfully.
      4. Keep code efficient. Avoid mixing string/number types in calculations (e.g. time + "8n" is invalid).
      5. Use 'time' argument in callbacks for precise scheduling.
    `;

    chatSessionRef.current = ai.chats.create({
      model: "gemini-2.5-flash",
      config: {
        systemInstruction,
        tools: [{ functionDeclarations: [runCodeTool] }],
      },
    });
  };

  const handleAgentSubmit = async () => {
    if (!input.trim() || !chatSessionRef.current || isAgentProcessing) return;
    
    const userText = input;
    setInput("");
    setMessages(prev => [...prev, { role: 'user', text: userText }]);
    setIsAgentProcessing(true);

    try {
      // 1. Send User Message
      let response = await chatSessionRef.current.sendMessage({ message: userText });
      
      // 2. Loop to handle Function Calls (Agentic Loop)
      let maxTurns = 5; // Safety break
      
      while (response.functionCalls && response.functionCalls.length > 0 && maxTurns > 0) {
        maxTurns--;
        const call = response.functionCalls[0];
        
        if (call.name === 'run_generated_code') {
          const args = call.args as { code: string };
          setMessages(prev => [...prev, { role: 'system', text: `>> Compiling Generated Code...` }]);
          
          // Update Editor Visual
          setCode(args.code);

          // Execute
          const result = await handleRun(args.code);
          
          // Send result back to model
          const toolResult = result.success ? "Success: Audio started." : `Error: ${result.error}`;
          
          if (!result.success) {
             setMessages(prev => [...prev, { role: 'system', text: `>> Compilation Failed. Retrying...` }]);
          }

          response = await chatSessionRef.current.sendMessage({
            message: [{
              functionResponse: {
                name: 'run_generated_code',
                response: { result: toolResult },
              },
            }]
          });
        }
      }

      // 3. Final Model Response
      const modelText = response.text;
      if (modelText) {
         setMessages(prev => [...prev, { role: 'model', text: modelText }]);
      }

    } catch (err: any) {
      console.error(err);
      setMessages(prev => [...prev, { role: 'system', text: `>> SYSTEM ERROR: ${err.message}` }]);
    } finally {
      setIsAgentProcessing(false);
    }
  };

  const lineCount = code.split('\n').length;

  return (
    <div className="h-screen bg-zinc-950 text-green-400 font-mono flex flex-col selection:bg-green-900 selection:text-green-100 overflow-hidden relative">
      
      {/* BACKGROUND EFFECTS */}
      <div className="fixed inset-0 pointer-events-none z-0 opacity-10 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[length:100%_2px,3px_100%]"></div>
      
      {/* HEADER */}
      <header className="h-16 shrink-0 border-b border-green-500/30 flex items-center justify-between px-6 z-10 bg-zinc-950/90 backdrop-blur">
        <div className="flex items-center gap-3">
          <Activity className={`w-6 h-6 ${isPlaying ? 'animate-pulse text-green-400' : 'text-green-800'}`} />
          <h1 className="text-xl font-bold tracking-widest text-shadow-glow">SONIC_SHELL <span className="text-xs opacity-50 font-normal">v2.1</span></h1>
        </div>
        
        <div className="flex items-center gap-6">
          <div className="hidden md:flex text-[10px] text-green-500/40 gap-4 mr-4">
             <span>CTRL+ENTER : RUN</span>
             <span>CTRL+. : STOP</span>
          </div>

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
          
          <button 
             onClick={() => setIsAgentOpen(!isAgentOpen)}
             className={`flex items-center gap-2 px-4 py-2 border transition-all ${isAgentOpen ? 'bg-green-500 text-black border-green-400' : 'bg-zinc-900 border-green-500/30 text-green-500/70 hover:text-green-400'}`}
          >
            <Bot className="w-4 h-4" />
            <span className="text-xs font-bold hidden md:inline">GHOST_TERMINAL</span>
          </button>
        </div>
      </header>

      {/* MAIN CONTENT */}
      <main className="flex-1 flex overflow-hidden z-10 relative">
        
        {/* LEFT: EDITOR */}
        <section className={`flex flex-col border-r border-green-500/30 transition-all duration-300 ${isAgentOpen ? 'w-1/2' : 'w-3/5'}`}>
          <div className="bg-zinc-900/50 px-4 py-2 text-xs flex justify-between items-center border-b border-green-500/20 text-green-500/70 shrink-0">
            <span className="flex items-center gap-2"><Terminal className="w-3 h-3"/> MAIN.JS</span>
            <span className="flex gap-2">
                <span>UTF-8</span>
            </span>
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
              <div className="absolute inset-0 pointer-events-none shadow-[inset_0_0_50px_rgba(0,0,0,0.8)]"></div>
            </div>
          </div>
        </section>

        {/* MIDDLE: OUTPUT & VISUALS */}
        <section className={`flex flex-col bg-zinc-900/20 transition-all duration-300 ${isAgentOpen ? 'w-1/4' : 'w-2/5'}`}>
          <div 
            onClick={() => setVisMode(prev => prev === 'waveform' ? 'fft' : 'waveform')}
            className="h-1/3 border-b border-green-500/30 relative flex items-center justify-center overflow-hidden bg-black shrink-0 cursor-pointer group"
          >
             <div className="absolute top-2 left-2 text-[10px] opacity-50 tracking-widest z-10 flex items-center gap-2 group-hover:opacity-100 transition-opacity">
               <Activity className="w-3 h-3" />
               VISUALIZER_{visMode.toUpperCase()}
            </div>
            <canvas ref={canvasRef} className="w-full h-full block"/>
          </div>

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

        {/* RIGHT: AGENT TERMINAL (Collapsible) */}
        {isAgentOpen && (
           <section className="w-1/4 border-l border-green-500/30 bg-zinc-950 flex flex-col z-20 shadow-[-10px_0_30px_rgba(0,0,0,0.5)]">
              <div className="px-4 py-3 bg-green-900/10 border-b border-green-500/20 flex items-center justify-between">
                 <span className="flex items-center gap-2 text-xs font-bold tracking-widest text-green-400">
                    <Bot className="w-4 h-4" /> GHOST_TERMINAL
                 </span>
                 <button onClick={() => setIsAgentOpen(false)} className="opacity-50 hover:opacity-100">
                    <X className="w-4 h-4" />
                 </button>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-4 font-mono text-xs custom-scrollbar">
                 {messages.map((msg, idx) => (
                    <div key={idx} className={`flex flex-col gap-1 ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                       <div className={`max-w-[90%] p-3 rounded-lg border ${
                          msg.role === 'user' 
                          ? 'bg-green-900/20 border-green-500/30 text-green-100' 
                          : msg.role === 'system' 
                          ? 'bg-transparent border-transparent text-green-500/50 italic'
                          : 'bg-zinc-900 border-zinc-700 text-green-400'
                       }`}>
                          {msg.text}
                       </div>
                    </div>
                 ))}
                 {isAgentProcessing && (
                    <div className="flex items-center gap-2 text-green-500/50 text-xs italic p-2">
                       <Loader2 className="w-3 h-3 animate-spin" /> Processing...
                    </div>
                 )}
                 <div ref={messagesEndRef} />
              </div>

              <div className="p-3 border-t border-green-500/20 bg-zinc-900/30">
                 <div className="flex gap-2">
                    <input 
                       type="text" 
                       value={input}
                       onChange={(e) => setInput(e.target.value)}
                       onKeyDown={(e) => e.key === 'Enter' && handleAgentSubmit()}
                       placeholder="Command the Ghost..."
                       className="flex-1 bg-black border border-green-500/30 rounded px-3 py-2 text-xs text-green-400 focus:outline-none focus:border-green-500"
                       disabled={isAgentProcessing}
                    />
                    <button 
                       onClick={handleAgentSubmit}
                       disabled={isAgentProcessing}
                       className="p-2 bg-green-900/20 border border-green-500/30 rounded hover:bg-green-500 hover:text-black transition-colors disabled:opacity-50"
                    >
                       <Send className="w-4 h-4" />
                    </button>
                 </div>
              </div>
           </section>
        )}
      </main>

      {/* FOOTER: CONTROLS */}
      <footer className="h-20 shrink-0 bg-zinc-950 border-t border-green-500/30 flex items-center justify-between px-8 z-20">
        <div className="flex items-center gap-4">
           <button 
             onClick={() => handleRun()}
             className={`
               group relative px-8 py-3 bg-green-900/20 border border-green-500/50 text-green-400 font-bold tracking-widest uppercase overflow-hidden transition-all
               hover:bg-green-500 hover:text-black hover:shadow-[0_0_20px_rgba(74,222,128,0.6)] hover:border-green-400
               active:scale-95
             `}
           >
             <span className="relative z-10 flex items-center gap-2">
               <Play className="w-4 h-4 fill-current" /> EXECUTE_
             </span>
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
          <div>VIS_MODE: {visMode.toUpperCase()}</div>
        </div>
      </footer>
    </div>
  );
};

export default App;