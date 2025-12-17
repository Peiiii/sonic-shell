export interface LogEntry {
  id: string;
  timestamp: string;
  message: string;
  type: 'info' | 'success' | 'error' | 'system';
}

export interface AudioState {
  isPlaying: boolean;
  bpm: number;
}
