export enum TimerStatus {
  IDLE = 'IDLE',
  RUNNING = 'RUNNING',
  PAUSED = 'PAUSED',
  COMPLETED = 'COMPLETED',
}

export interface SpotifyConfig {
  embedUrl: string;
  isOpen: boolean;
}

export interface MindfulnessTip {
  text: string;
  author?: string;
}