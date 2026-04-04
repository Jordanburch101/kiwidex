export function AiBadge() {
  return (
    <>
      <style>
        {`
          @keyframes ai-liquid {
            0%   { background-position: 0% 50%; }
            25%  { background-position: 100% 30%; }
            50%  { background-position: 60% 80%; }
            75%  { background-position: 20% 40%; }
            100% { background-position: 0% 50%; }
          }
          @keyframes ai-shimmer {
            0%   { transform: translateX(-20%); }
            100% { transform: translateX(60%); }
          }
          @keyframes ai-glow {
            0%, 100% { box-shadow: inset 0 1px 1px rgba(255,255,255,0.12), inset 0 -0.5px 1px rgba(0,0,0,0.08), 0 0 3px rgba(139,92,246,0.1); }
            50% { box-shadow: inset 0 1px 1px rgba(255,255,255,0.12), inset 0 -0.5px 1px rgba(0,0,0,0.08), 0 0 8px rgba(139,92,246,0.25), 0 0 20px rgba(139,92,246,0.08); }
          }
        `}
      </style>
      <span
        className="relative inline-flex items-center overflow-hidden rounded-full px-2.5 py-0.5"
        style={{
          background:
            "linear-gradient(135deg, #5b4cdb 0%, #7c3aed 50%, #8b5cf6 100%)",
          animation: "ai-glow 4s cubic-bezier(0.4,0,0.2,1) infinite",
        }}
      >
        <span
          aria-hidden="true"
          className="absolute inset-0 rounded-full"
          style={{
            background:
              "linear-gradient(135deg, rgba(99,102,241,0) 0%, rgba(139,92,246,0.3) 20%, rgba(168,130,255,0) 40%, rgba(255,255,255,0.08) 55%, rgba(124,58,237,0.25) 70%, rgba(99,102,241,0) 90%)",
            backgroundSize: "250% 250%",
            animation: "ai-liquid 6s ease-in-out infinite",
          }}
        />
        <span
          aria-hidden="true"
          className="absolute top-0 h-full"
          style={{
            left: "-120%",
            width: "240%",
            background:
              "linear-gradient(100deg, transparent 0%, transparent 40%, rgba(255,255,255,0.12) 47%, rgba(255,255,255,0.18) 50%, rgba(255,255,255,0.12) 53%, transparent 60%, transparent 100%)",
            animation: "ai-shimmer 5s cubic-bezier(0.4,0,0.2,1) infinite",
          }}
        />
        <span
          aria-hidden="true"
          className="pointer-events-none absolute top-0 rounded-b-full"
          style={{
            left: "10%",
            width: "50%",
            height: "42%",
            background:
              "linear-gradient(180deg, rgba(255,255,255,0.1) 0%, transparent 100%)",
          }}
        />
        <span
          className="relative z-10 font-sans font-bold text-[8px] text-white tracking-wider"
          style={{ textShadow: "0 0.5px 1px rgba(0,0,0,0.1)" }}
        >
          AI
        </span>
      </span>
    </>
  );
}
