import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Play, Pause, RotateCcw, Volume2, VolumeX, Leaf, Gauge, Wind, Sparkles, BellRing, Info, X } from 'lucide-react';
import { TimerStatus, MindfulnessTip } from './types';
import { SpotifyWidget } from './components/SpotifyWidget';
import { getMindfulnessTip } from './services/geminiService';

// Constantes de la caminata
const TOTAL_DURATION = 40 * 60; // 40 minutos
const INTERVAL_DURATION = 3 * 60; // 3 minutos
// Sonido de campana tibetana/zen
const BELL_SOUND_URL = "https://cdn.pixabay.com/audio/2021/08/04/audio_0625c1539c.mp3"; 
const DEFAULT_SPOTIFY_URL = "https://open.spotify.com/embed/playlist/37i9dQZF1DX3Ogo9kVvBkY";

// TRUCO: Audio silencioso en base64 para mantener el "Media Session" activo en móviles
// Esto evita que el navegador duerma el audio al bloquear la pantalla.
const SILENT_AUDIO_URI = "data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA";

const App: React.FC = () => {
  // Estados
  const [timeLeft, setTimeLeft] = useState(TOTAL_DURATION);
  const [status, setStatus] = useState<TimerStatus>(TimerStatus.IDLE);
  const [isMuted, setIsMuted] = useState(false);
  const [currentTip, setCurrentTip] = useState<MindfulnessTip | null>(null);
  const [isLoadingTip, setIsLoadingTip] = useState(false);
  const [bellRinging, setBellRinging] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>('default');
  
  // Referencias
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const silentAudioRef = useRef<HTMLAudioElement | null>(null); // Referencia para el audio silencioso
  const timerIntervalRef = useRef<number | null>(null);
  const targetEndTimeRef = useRef<number>(0);
  const lastIntervalIndexRef = useRef<number>(0);
  const wakeLockRef = useRef<any>(null);

  // Inicializar Audio y pedir permisos de Notificación
  useEffect(() => {
    // 1. Audio de la campana
    audioRef.current = new Audio(BELL_SOUND_URL);
    audioRef.current.preload = "auto";
    audioRef.current.volume = 1.0;

    // 2. Audio silencioso (Keep-Alive)
    silentAudioRef.current = new Audio(SILENT_AUDIO_URI);
    silentAudioRef.current.loop = true; // Importante: bucle infinito
    silentAudioRef.current.volume = 0.01; // Volumen casi cero, pero no cero absoluto por si acaso algunos navegadores lo pausan

    if ('Notification' in window) {
      setNotificationPermission(Notification.permission);
    }
  }, []);

  const requestNotificationPermission = async () => {
    if ('Notification' in window && notificationPermission === 'default') {
      const permission = await Notification.requestPermission();
      setNotificationPermission(permission);
    }
  };

  // Cargar frase motivacional al inicio
  useEffect(() => {
    fetchNewTip();
  }, []);

  const fetchNewTip = async () => {
    setIsLoadingTip(true);
    const tip = await getMindfulnessTip();
    setCurrentTip(tip);
    setIsLoadingTip(false);
  };

  // Función para tocar la campana y enviar notificación
  const playBell = useCallback(() => {
    setBellRinging(true);
    setTimeout(() => setBellRinging(false), 2000);

    // 1. Intentar reproducir audio
    if (audioRef.current && !isMuted) {
      // Forzamos el reset del tiempo para que suene desde el principio
      if (audioRef.current.readyState >= 2) {
        audioRef.current.currentTime = 0;
      }
      
      const playPromise = audioRef.current.play();
      if (playPromise !== undefined) {
        playPromise.catch(error => {
          console.warn("Audio de campana bloqueado:", error);
          // Si falla la campana principal, intentamos regenerarla (a veces iOS pierde la referencia)
          if (audioRef.current) {
             audioRef.current.load();
             audioRef.current.play().catch(e => console.error("Reintento fallido:", e));
          }
        });
      }
    }

    // 2. Enviar notificación del sistema (funciona con pantalla bloqueada)
    if (document.hidden && notificationPermission === 'granted') {
       try {
         new Notification("ZenWalk: Cambio de Ritmo 🔔", {
           body: "Es hora de cambiar la intensidad de tu paso.",
           icon: "https://cdn-icons-png.flaticon.com/512/3063/3063823.png",
           silent: false
         });
       } catch (e) {
         console.error("Error enviando notificación", e);
       }
    }
  }, [isMuted, notificationPermission]);

  const testSound = () => {
      requestNotificationPermission();
      
      // Probar campana
      if (audioRef.current) {
        audioRef.current.currentTime = 0;
        audioRef.current.play().catch(e => console.warn("Error probando sonido:", e));
        setBellRinging(true);
        setTimeout(() => setBellRinging(false), 2000);
      }

      // IMPORTANTE: Al probar sonido también inicializamos el audio silencioso si no está corriendo
      // para asegurar que los permisos de audio estén concedidos por interacción del usuario.
      if (silentAudioRef.current && silentAudioRef.current.paused) {
          silentAudioRef.current.play().then(() => {
              // Lo pausamos inmediatamente, solo queríamos "calentar" el motor de audio
              silentAudioRef.current?.pause(); 
          }).catch(e => console.warn("Error calentando audio:", e));
      }
  };

  // --- Bloqueo de pantalla (Wake Lock) ---
  const acquireWakeLock = useCallback(async () => {
    if ('wakeLock' in navigator) {
        try {
            wakeLockRef.current = await (navigator as any).wakeLock.request('screen');
        } catch (err: any) {
            console.warn(`Wake Lock no disponible: ${err.message}`);
        }
    }
  }, []);

  const releaseWakeLock = useCallback(async () => {
    if (wakeLockRef.current) {
        try {
            await wakeLockRef.current.release();
            wakeLockRef.current = null;
        } catch (e) {
            console.warn("Error liberando wake lock", e);
        }
    }
  }, []);

  useEffect(() => {
    if (status === TimerStatus.RUNNING) {
        acquireWakeLock();
    } else {
        releaseWakeLock();
    }
    return () => { releaseWakeLock(); };
  }, [status, acquireWakeLock, releaseWakeLock]);
  
  // --- Lógica del Reloj (setInterval) ---
  const tick = useCallback(() => {
    if (status !== TimerStatus.RUNNING || !targetEndTimeRef.current) return;

    const now = Date.now();
    const remaining = targetEndTimeRef.current - now;

    if (remaining <= 0) {
      setTimeLeft(0);
      setStatus(TimerStatus.COMPLETED);
      playBell();
      releaseWakeLock();
      // Detener audio silencioso al terminar
      if (silentAudioRef.current) {
          silentAudioRef.current.pause();
          silentAudioRef.current.currentTime = 0;
      }
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      return;
    }

    const newTimeLeft = Math.ceil(remaining / 1000);
    
    setTimeLeft(prev => {
        if (prev !== newTimeLeft) return newTimeLeft;
        return prev;
    });

    const elapsedTime = TOTAL_DURATION - newTimeLeft;
    const currentIntervalIndex = Math.floor(elapsedTime / INTERVAL_DURATION);

    // Detectar cambio de intervalo
    if (currentIntervalIndex > lastIntervalIndexRef.current) {
      if (elapsedTime > 0 && newTimeLeft > 0) {
        playBell(); 
      }
      lastIntervalIndexRef.current = currentIntervalIndex;
    }
  }, [status, playBell, releaseWakeLock]);
  
  useEffect(() => {
    if (status === TimerStatus.RUNNING) {
      timerIntervalRef.current = window.setInterval(tick, 1000);
    } else {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    }
    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    };
  }, [status, tick]);


  // Botones y Control
  const toggleTimer = () => {
    requestNotificationPermission(); 
    if (status === TimerStatus.RUNNING) {
      setStatus(TimerStatus.PAUSED);
      // Pausar audio silencioso al pausar timer
      if (silentAudioRef.current) silentAudioRef.current.pause();
    } else {
      targetEndTimeRef.current = Date.now() + timeLeft * 1000;
      if (status === TimerStatus.IDLE) {
          lastIntervalIndexRef.current = 0;
          playBell(); // Sonar al iniciar
      }
      
      // ARRANCAR AUDIO SILENCIOSO "KEEP ALIVE"
      // Esto es crucial: se debe llamar dentro de un evento de click (toggleTimer)
      if (silentAudioRef.current) {
          silentAudioRef.current.play().catch(e => console.error("Error iniciando audio de fondo:", e));
      }

      setStatus(TimerStatus.RUNNING);
    }
  };

  const resetTimer = () => {
    setStatus(TimerStatus.IDLE);
    setTimeLeft(TOTAL_DURATION);
    lastIntervalIndexRef.current = 0;
    if (silentAudioRef.current) {
        silentAudioRef.current.pause();
        silentAudioRef.current.currentTime = 0;
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Cálculos visuales
  const elapsedTime = TOTAL_DURATION - timeLeft;
  const progressPercentage = (elapsedTime / TOTAL_DURATION) * 100;
  const currentIntervalIndex = Math.floor(elapsedTime / INTERVAL_DURATION);
  const isFastPace = currentIntervalIndex % 2 === 0; 
  const timeInCurrentInterval = elapsedTime % INTERVAL_DURATION;
  const intervalTimeLeft = INTERVAL_DURATION - timeInCurrentInterval;
  const displayIntervalTime = timeLeft === 0 ? 0 : (timeInCurrentInterval === 0 && elapsedTime > 0) ? INTERVAL_DURATION : intervalTimeLeft;
  const intervalProgress = timeLeft === 0 ? 100 : (timeInCurrentInterval / INTERVAL_DURATION) * 100;

  return (
    <div className={`min-h-screen flex flex-col items-center justify-between p-6 transition-colors duration-1000 relative overflow-hidden ${isFastPace ? 'bg-orange-50' : 'bg-blue-50'}`}>
      
      {/* Flash visual */}
      <div className={`absolute inset-0 bg-white pointer-events-none transition-opacity duration-500 z-50 ${bellRinging ? 'opacity-50' : 'opacity-0'}`} />

      {/* Header */}
      <header className="w-full max-w-md flex justify-between items-center z-10">
        <div className="flex items-center gap-2 text-zen-700">
          <Leaf size={24} className={isFastPace ? 'text-orange-600' : 'text-bamboo-600'} />
          <h1 className="text-xl font-bold tracking-tight">ZenWalk</h1>
        </div>
        <div className="flex items-center gap-2">
            <button onClick={() => setShowInfo(true)} className="p-2 text-zen-500 hover:text-bamboo-600 transition-colors rounded-full hover:bg-zen-100" title="Instrucciones">
                <Info size={20} />
            </button>
            <button onClick={testSound} className="p-2 text-zen-500 hover:text-bamboo-600 transition-colors rounded-full hover:bg-zen-100" title="Probar sonido / Notificaciones">
                <BellRing size={20} />
            </button>
            <button onClick={() => setIsMuted(!isMuted)} className="p-2 text-zen-500 hover:text-zen-800 transition-colors" aria-label={isMuted ? "Activar sonido" : "Silenciar"}>
              {isMuted ? <VolumeX size={24} /> : <Volume2 size={24} />}
            </button>
        </div>
      </header>

      {/* Modal de Instrucciones */}
      {showInfo && (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl relative">
                <button onClick={() => setShowInfo(false)} className="absolute top-4 right-4 text-zen-400 hover:text-zen-800">
                    <X size={24} />
                </button>
                <h2 className="text-xl font-bold text-zen-800 mb-4 flex items-center gap-2">
                    <Leaf className="text-bamboo-600" size={20}/> Guía de Caminata
                </h2>
                <div className="space-y-4 text-sm text-zen-600">
                    <p className="font-medium">Duración Total: 40 minutos</p>
                    <div className="bg-blue-50 p-3 rounded-lg border-l-4 border-blue-500">
                        <p className="font-bold text-blue-800">1. Ritmo Calma (3 min)</p>
                        <p>Camina despacio. Sincroniza: inhala en 3 pasos, exhala en 3 pasos.</p>
                    </div>
                    <div className="bg-orange-50 p-3 rounded-lg border-l-4 border-orange-500">
                        <p className="font-bold text-orange-800">2. Ritmo Energético (3 min)</p>
                        <p>Acelera el paso. Brazos firmes. Respira con energía pero sin jadear.</p>
                    </div>
                    
                    <div className="mt-4 p-2 bg-yellow-50 text-yellow-800 text-xs rounded border border-yellow-200">
                        <strong>Nota importante:</strong> Mantén esta pestaña abierta. Si bloqueas la pantalla, la música web se detendrá (es una restricción de los celulares). Usa el botón "Abrir en App Spotify" para música continua.
                    </div>
                </div>
                <button onClick={() => setShowInfo(false)} className="w-full mt-6 bg-zen-800 text-white py-3 rounded-xl font-bold hover:bg-zen-700 transition-colors">
                    ¡Entendido!
                </button>
            </div>
        </div>
      )}

      {/* Contenido Principal */}
      <main className="flex-1 w-full max-w-md flex flex-col items-center justify-center gap-6 z-10 py-4">
        
        {/* Tarjeta de Frase Zen */}
        <div className="w-full bg-white/60 backdrop-blur-sm p-4 rounded-2xl shadow-sm border border-white/50 min-h-[90px] flex flex-col items-center justify-center text-center relative group">
          <Sparkles className="absolute top-3 right-3 text-yellow-400 opacity-50" size={16} />
          {isLoadingTip ? (
            <div className="animate-pulse flex space-x-4"><div className="h-2 bg-zen-300 rounded w-48"></div></div>
          ) : (
            <p className="text-zen-700 italic font-medium leading-relaxed text-sm">"{currentTip?.text}"</p>
          )}
        </div>

        {/* Indicador de Intervalo */}
        <div className={`w-full py-4 px-6 rounded-2xl shadow-md transition-all duration-500 transform ${isFastPace ? 'bg-orange-100 text-orange-800 border-l-8 border-orange-500' : 'bg-blue-100 text-blue-800 border-l-8 border-blue-500'}`}>
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    {isFastPace ? <Gauge size={32} className="text-orange-600 animate-pulse" /> : <Wind size={32} className="text-blue-600" />}
                    <div className="flex flex-col text-left">
                        <span className="text-xs font-bold uppercase tracking-wider opacity-70">Ritmo</span>
                        <span className="text-2xl font-bold">{isFastPace ? 'ENERGÉTICO' : 'CALMA'}</span>
                    </div>
                </div>
                <div className="text-right">
                    <span className="text-xs font-bold uppercase tracking-wider opacity-70">Intervalo 3 min</span>
                    <p className="text-xl font-bold">#{currentIntervalIndex + 1}</p>
                </div>
            </div>
        </div>

        {/* Reloj Circular */}
        <div className="relative w-64 h-64 flex items-center justify-center">
            {/* Círculo fondo */}
            <svg className="absolute w-full h-full transform -rotate-90">
                <circle cx="128" cy="128" r="120" stroke="currentColor" strokeWidth="6" fill="transparent" className="text-zen-200/50"/>
                <circle cx="128" cy="128" r="120" stroke="currentColor" strokeWidth="6" fill="transparent" strokeDasharray={2 * Math.PI * 120} strokeDashoffset={2 * Math.PI * 120 * (1 - progressPercentage / 100)} strokeLinecap="round" className="text-zen-400 transition-all duration-1000 ease-linear"/>
            </svg>
            {/* Círculo intervalo */}
            <svg className="absolute w-52 h-52 transform -rotate-90">
                 <circle cx="104" cy="104" r="98" stroke="currentColor" strokeWidth="12" fill="white" className="text-white drop-shadow-sm"/>
                <circle cx="104" cy="104" r="98" stroke="currentColor" strokeWidth="8" fill="transparent" className={isFastPace ? 'text-orange-100' : 'text-blue-100'}/>
                <circle cx="104" cy="104" r="98" stroke="currentColor" strokeWidth="8" fill="transparent" strokeDasharray={2 * Math.PI * 98} strokeDashoffset={2 * Math.PI * 98 * (1 - intervalProgress / 100)} strokeLinecap="round" className={`${isFastPace ? 'text-orange-500' : 'text-blue-500'} transition-all duration-1000 ease-linear`}/>
            </svg>
            <div className="absolute flex flex-col items-center z-10">
              <span className={`text-5xl font-bold tabular-nums leading-none ${isFastPace ? 'text-orange-600' : 'text-blue-600'} ${bellRinging ? 'scale-110 transition-transform' : ''}`}>{formatTime(displayIntervalTime)}</span>
              <div className="w-12 h-px bg-zen-300 my-2"></div>
              <div className="flex flex-col items-center">
                 <span className="text-xl font-semibold text-zen-600 tabular-nums">{formatTime(timeLeft)}</span>
                 <span className="text-[10px] text-zen-400 uppercase">Tiempo Total</span>
              </div>
            </div>
        </div>

        {/* Barra de Progreso del Mamut */}
        <div className="w-full flex flex-col gap-2">
            <div className="flex justify-between text-xs font-bold text-zen-500 uppercase tracking-wider px-1">
                <span>Inicio</span>
                <span>Meta (40m)</span>
            </div>
            <div className="relative w-full h-8 bg-zen-200/50 rounded-full border border-white/50 shadow-inner flex items-center">
                <div className={`h-full rounded-full transition-all duration-1000 ${isFastPace ? 'bg-orange-200' : 'bg-blue-200'}`} style={{ width: `${progressPercentage}%` }}/>
                <div className="absolute top-1/2 -translate-y-1/2 transition-all duration-1000 ease-linear" style={{ left: `calc(${progressPercentage}% - 14px)` }}>
                    <div className={`text-2xl ${status === TimerStatus.RUNNING ? (isFastPace ? 'mammoth-fast-walk' : 'mammoth-slow-walk') : 'transform scale-x-[-1]'}`}>
                        🦣
                    </div>
                </div>
            </div>
        </div>

        {/* Controles Play/Pause */}
        <div className="flex gap-6 items-center">
          {status !== TimerStatus.IDLE && (
            <button onClick={resetTimer} className="p-4 rounded-full bg-white text-zen-600 hover:bg-zen-100 shadow-md transition-colors border border-zen-100" aria-label="Reiniciar">
              <RotateCcw size={24} />
            </button>
          )}
          <button onClick={toggleTimer} className={`p-6 rounded-full shadow-xl transition-all duration-300 transform hover:scale-105 border-4 border-white ${status === TimerStatus.RUNNING ? 'bg-zen-800 text-white hover:bg-zen-700' : isFastPace ? 'bg-orange-500 text-white hover:bg-orange-600' : 'bg-blue-500 text-white hover:bg-blue-600'}`}>
            {status === TimerStatus.RUNNING ? (<Pause size={32} fill="currentColor" />) : (<Play size={32} fill="currentColor" className="ml-1" />)}
          </button>
        </div>
      </main>

      <SpotifyWidget initialUrl={DEFAULT_SPOTIFY_URL} />
      
      {/* Fondos Decorativos */}
      <div className="fixed top-0 left-0 w-full h-full pointer-events-none overflow-hidden z-0 opacity-30">
        <div className={`absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full blur-[100px] transition-colors duration-1000 ${isFastPace ? 'bg-orange-300/30' : 'bg-blue-300/30'}`} />
        <div className={`absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full blur-[80px] transition-colors duration-1000 ${isFastPace ? 'bg-red-300/20' : 'bg-green-300/20'}`} />
      </div>
    </div>
  );
};

export default App;