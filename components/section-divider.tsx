export function SectionDivider({ variant = "default" }: { variant?: "default" | "wave" | "dots" | "gradient" }) {
  if (variant === "wave") {
    return (
      <div className="relative h-32 overflow-hidden">
        {/* Degradê de transição */}
        <div className="absolute inset-0 bg-gradient-to-b from-slate-900 via-slate-950 to-slate-900" />

        {/* Ondas animadas */}
        <svg className="absolute bottom-0 w-full h-24" viewBox="0 0 1440 120" preserveAspectRatio="none">
          <path
            d="M0,64L48,69.3C96,75,192,85,288,80C384,75,480,53,576,48C672,43,768,53,864,64C960,75,1056,85,1152,80C1248,75,1344,53,1392,42.7L1440,32L1440,120L1392,120C1344,120,1248,120,1152,120C1056,120,960,120,864,120C768,120,672,120,576,120C480,120,384,120,288,120C192,120,96,120,48,120L0,120Z"
            fill="url(#wave-gradient)"
            className="animate-[wave_10s_ease-in-out_infinite]"
          />
          <defs>
            <linearGradient id="wave-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="rgb(34 211 238 / 0.3)" />
              <stop offset="50%" stopColor="rgb(168 85 247 / 0.3)" />
              <stop offset="100%" stopColor="rgb(251 146 60 / 0.3)" />
            </linearGradient>
          </defs>
        </svg>
      </div>
    )
  }

  if (variant === "dots") {
    return (
      <div className="relative h-24 overflow-hidden">
        {/* Degradê de transição */}
        <div className="absolute inset-0 bg-gradient-to-b from-slate-900 via-slate-950 to-slate-900" />

        {/* Pontos decorativos */}
        <div className="absolute inset-0 flex items-center justify-center gap-2">
          <div className="w-2 h-2 rounded-full bg-cyan-400/60 animate-pulse" />
          <div className="w-2 h-2 rounded-full bg-purple-400/60 animate-pulse" style={{ animationDelay: "0.2s" }} />
          <div className="w-2 h-2 rounded-full bg-orange-400/60 animate-pulse" style={{ animationDelay: "0.4s" }} />
          <div className="w-2 h-2 rounded-full bg-green-400/60 animate-pulse" style={{ animationDelay: "0.6s" }} />
          <div className="w-2 h-2 rounded-full bg-pink-400/60 animate-pulse" style={{ animationDelay: "0.8s" }} />
        </div>
      </div>
    )
  }

  if (variant === "gradient") {
    return (
      <div className="relative h-32 overflow-hidden">
        {/* Degradê suave com múltiplas cores */}
        <div className="absolute inset-0 bg-gradient-to-b from-slate-900 via-slate-950 to-slate-900" />

        {/* Brilho colorido central */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-full h-1 bg-gradient-to-r from-transparent via-cyan-400/30 to-transparent" />
        </div>

        {/* Partículas flutuantes */}
        {[...Array(12)].map((_, i) => (
          <div
            key={i}
            className="absolute w-1 h-1 rounded-full bg-white/40 animate-twinkle"
            style={{
              left: `${5 + i * 8}%`,
              top: `${30 + Math.random() * 40}%`,
              animationDelay: `${i * 0.3}s`,
              animationDuration: `${2 + Math.random() * 2}s`,
            }}
          />
        ))}
      </div>
    )
  }

  // Default: degradê simples
  return (
    <div className="h-24 bg-gradient-to-b from-slate-900 via-slate-950 to-slate-900 relative overflow-hidden">
      {/* Linha decorativa sutil */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="w-1/2 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
      </div>
    </div>
  )
}
