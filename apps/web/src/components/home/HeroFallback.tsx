// Ilustración estática del héroe: se muestra mientras carga la escena 3D
// y queda como alternativa si el dispositivo no tiene WebGL.
export function HeroFallback() {
  const contours = Array.from({ length: 9 }, (_, i) => i);
  return (
    <svg className="hero-fallback" viewBox="0 0 800 600" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <rect width="800" height="600" fill="#F3EDE2" />
      <g fill="none" stroke="#1F4D3A" strokeOpacity="0.22" strokeWidth="1.2">
        {contours.map((i) => (
          <path
            key={i}
            d={`M ${-40} ${420 - i * 34} C ${160} ${360 - i * 40}, ${300} ${470 - i * 30}, ${470} ${400 - i * 36} S ${720} ${300 - i * 30}, ${860} ${340 - i * 34}`}
          />
        ))}
      </g>
      <g stroke="#1F4D3A" strokeWidth="1.6" fill="#1F4D3A" fillOpacity="0.1">
        <path d="M430 400 L470 392 L476 428 L436 436 Z" />
        <path d="M472 390 L508 384 L512 418 L478 426 Z" />
        <path d="M436 440 L478 430 L484 468 L442 476 Z" />
        <path d="M480 430 L516 422 L520 458 L486 466 Z" />
      </g>
      <path d="M360 452 L392 446 L396 478 L364 486 Z" stroke="#B23A2E" strokeWidth="1.4" fill="#B23A2E" fillOpacity="0.08" />
      <path d="M476 428 C 540 330, 640 250, 780 150" fill="none" stroke="#1F4D3A" strokeWidth="3" strokeLinecap="round" />
      <circle cx="476" cy="428" r="7" fill="#B23A2E" />
      <line x1="476" y1="428" x2="476" y2="414" stroke="#B23A2E" strokeWidth="1.4" />
      <g transform="translate(476 396) rotate(-28)">
        <ellipse rx="13" ry="19" fill="#93A784" stroke="#3F5E46" strokeWidth="1" />
        <path d="M0 -16 C 5 -7, -5 7, 0 16" fill="none" stroke="#3F5E46" strokeWidth="2" strokeLinecap="round" />
      </g>
      <circle cx="560" cy="318" r="9" fill="#B23A2E" />
      <circle cx="660" cy="234" r="9" fill="none" stroke="#1F4D3A" strokeWidth="2.5" />
      <circle cx="770" cy="158" r="9" fill="none" stroke="#1F4D3A" strokeWidth="2.5" />
    </svg>
  );
}
