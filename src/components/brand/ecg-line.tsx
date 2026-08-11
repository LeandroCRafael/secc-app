/** Assinatura de movimento do SECC Tech Design System: traço de eletrocardiograma
 *  em loop linear de 9s a 55% de opacidade — a empresa em crise monitorada como
 *  paciente. Puro SVG + keyframe `secc-ecg` (tokens/motion.css); renderiza no servidor. */
const ECG_PATH =
  "M0 40 H44 L52 40 L58 22 L64 58 L70 32 L76 40 H128 L136 40 L142 26 L148 54 L154 36 L160 40 H240 " +
  "H284 L292 40 L298 22 L304 58 L310 32 L316 40 H368 L376 40 L382 26 L388 54 L394 36 L400 40 H480";

export function EcgLine({ height = 64 }: { height?: number }) {
  return (
    <svg viewBox="0 0 480 80" preserveAspectRatio="none" width="100%" height={height} aria-hidden="true" style={{ display: "block", overflow: "visible" }}>
      <path
        d={ECG_PATH}
        fill="none"
        stroke="var(--accent)"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{
          opacity: 0.55,
          strokeDasharray: "2400px",
          animation: "secc-ecg 9s linear infinite",
          filter: "drop-shadow(0 0 6px var(--accent-glow))",
        }}
      />
    </svg>
  );
}
