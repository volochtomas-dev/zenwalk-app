import React, { useState } from 'react';
import { Music, X, Search, AlertCircle, Link as LinkIcon, ExternalLink } from 'lucide-react';

interface SpotifyWidgetProps {
  initialUrl: string;
}

export const SpotifyWidget: React.FC<SpotifyWidgetProps> = ({ initialUrl }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [embedUrl, setEmbedUrl] = useState(initialUrl);
  const [inputValue, setInputValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [showInput, setShowInput] = useState(false);

  // Intentamos obtener una URL limpia para abrir en la app externa
  // De https://open.spotify.com/embed/playlist/abc -> https://open.spotify.com/playlist/abc
  const getExternalLink = () => {
    return embedUrl.replace('/embed', '');
  };

  // Function to extract the correct embed URL from various Spotify link formats
  const processSpotifyLink = (input: string) => {
    setError(null);
    
    if (!input.trim()) return;

    // Handle iframe paste directly
    if (input.includes('<iframe') && input.includes('src="')) {
        const srcMatch = input.match(/src="([^"]+)"/);
        if (srcMatch && srcMatch[1] && srcMatch[1].includes('open.spotify.com/embed')) {
            setEmbedUrl(srcMatch[1]);
            setInputValue('');
            setShowInput(false);
            return;
        }
    }

    try {
      const url = new URL(input);

      // Handle spotify.link (short links) - cannot resolve client side
      if (url.hostname === 'spotify.link') {
        setError("Los enlaces cortos 'spotify.link' no funcionan directamente. Por favor copia el enlace completo de la canción/playlist.");
        return;
      }
      
      const pathSegments = url.pathname.split('/').filter(Boolean);
      const validTypes = ['playlist', 'track', 'album', 'artist', 'show', 'episode'];
      
      let type = '';
      let id = '';

      // Find the segment that matches a valid type (handles /intl-es/playlist/..., /user/.../playlist/...)
      const typeIndex = pathSegments.findIndex(segment => validTypes.includes(segment));

      if (typeIndex !== -1 && typeIndex + 1 < pathSegments.length) {
          type = pathSegments[typeIndex];
          id = pathSegments[typeIndex + 1];
      }

      if (url.hostname.includes('spotify.com') && type && id) {
        setEmbedUrl(`https://open.spotify.com/embed/${type}/${id}`);
        setInputValue('');
        setShowInput(false);
      } else {
        setError("Enlace no reconocido. Asegúrate de copiar el enlace desde 'Compartir' en Spotify.");
      }
    } catch (e) {
      setError("Por favor pega un enlace válido (https://...)");
    }
  };

  if (!isOpen) {
    return (
      <button 
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 bg-[#1DB954] text-white p-4 rounded-full shadow-lg hover:scale-110 transition-transform duration-300 z-50 flex items-center justify-center border-4 border-white"
        aria-label="Abrir Spotify"
      >
        <Music size={24} />
      </button>
    );
  }

  return (
    <div className="fixed bottom-6 right-6 w-80 md:w-96 bg-white rounded-2xl shadow-2xl overflow-hidden z-50 animate-fade-in-up border border-zen-200 flex flex-col">
      {/* Header */}
      <div className="bg-zen-900 text-white p-4 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <Music size={20} className="text-[#1DB954]" />
          <span className="font-medium">Música</span>
        </div>
        <button 
            onClick={() => setIsOpen(false)} 
            className="hover:bg-white/10 p-1 rounded-full transition-colors"
        >
          <X size={20} />
        </button>
      </div>
      
      {/* Player */}
      <div className="bg-black relative z-10 min-h-[152px]">
        <iframe 
          src={embedUrl} 
          width="100%" 
          height="152" 
          frameBorder="0" 
          allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" 
          loading="lazy"
          title="Spotify Player"
          className="block"
        />
      </div>

      {/* Controls Area */}
      <div className="p-4 bg-zen-50 flex flex-col gap-3">
         
         {/* Botón Importante para abrir app nativa */}
         <a 
            href={getExternalLink()} 
            target="_blank" 
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full py-2.5 px-4 bg-[#1DB954] text-white rounded-lg text-sm font-bold hover:bg-[#1ed760] transition-all shadow-md"
         >
            <ExternalLink size={16} />
            Abrir en App Spotify
         </a>
         <p className="text-[10px] text-zen-500 text-center leading-tight">
            Úsalo para escuchar canciones completas y mantener la música con la pantalla apagada.
         </p>
         
         <div className="h-px bg-zen-200 my-1"></div>

         {!showInput ? (
             <div className="flex flex-col gap-2">
                 <button 
                    onClick={() => setShowInput(true)}
                    className="flex items-center justify-center gap-2 w-full py-2 px-4 bg-white border border-zen-300 rounded-lg text-sm text-zen-600 hover:bg-zen-100 hover:border-bamboo-500 transition-all shadow-sm"
                 >
                     <LinkIcon size={16} />
                     Cambiar Playlist o Canción
                 </button>
             </div>
         ) : (
             <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                 <label className="text-xs font-semibold text-zen-600 mb-1 block">
                    Pega el enlace de Spotify aquí:
                 </label>
                 <div className="flex gap-2">
                     <input 
                        type="text" 
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        placeholder="https://open.spotify.com/playlist/..."
                        className="flex-1 text-sm p-2 rounded-lg border border-zen-300 focus:outline-none focus:ring-2 focus:ring-bamboo-500 focus:border-transparent"
                     />
                     <button 
                        onClick={() => processSpotifyLink(inputValue)}
                        className="bg-bamboo-500 text-white p-2 rounded-lg hover:bg-bamboo-600 transition-colors shadow-sm"
                     >
                         <Search size={20} />
                     </button>
                 </div>
                 
                 {error && (
                    <div className="mt-2 flex items-center gap-1 text-xs text-red-500 bg-red-50 p-2 rounded">
                        <AlertCircle size={12} />
                        <span>{error}</span>
                    </div>
                 )}

                 <button 
                    onClick={() => { setShowInput(false); setError(null); }}
                    className="mt-2 text-xs text-zen-500 underline w-full text-center hover:text-zen-800"
                 >
                    Cancelar
                 </button>
             </div>
         )}
      </div>
    </div>
  );
};