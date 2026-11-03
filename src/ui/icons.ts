/** Hand-drawn inline SVG skill icons (no external assets). */
const wrap = (bg: string, body: string) =>
  `<svg viewBox="0 0 50 50" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg"><defs><radialGradient id="g" cx="50%" cy="40%" r="70%"><stop offset="0" stop-color="${bg}"/><stop offset="1" stop-color="#0a0706"/></radialGradient></defs><rect width="50" height="50" fill="url(#g)"/>${body}</svg>`;

export const ICONS: Record<string, string> = {
  basic: wrap('#5a4a3a', `<path d="M12 38 L34 16 L38 12 L37 18 L15 40 Z" fill="#d8dce4" stroke="#3a3a40"/><path d="M10 34 L16 40" stroke="#8a6a3a" stroke-width="4"/><path d="M8 42 L12 38" stroke="#5a3a20" stroke-width="4"/>`),
  cleave: wrap('#7a3a14', `<path d="M8 32 A20 20 0 0 1 42 32" fill="none" stroke="#ffd08a" stroke-width="5" stroke-linecap="round"/><path d="M12 30 A15 15 0 0 1 38 30" fill="none" stroke="#ff8a3a" stroke-width="2.5"/><path d="M22 40 L30 22" stroke="#d8dce4" stroke-width="3"/>`),
  charge: wrap('#6a2a10', `<path d="M8 25 L30 25" stroke="#ffb060" stroke-width="3"/><path d="M12 17 L28 17 M12 33 L28 33" stroke="#ff7a2a" stroke-width="2" opacity=".7"/><path d="M28 14 L42 25 L28 36 Z" fill="#ffd08a"/>`),
  nova: wrap('#8a3a0a', `<circle cx="25" cy="25" r="15" fill="none" stroke="#ffb050" stroke-width="3"/><circle cx="25" cy="25" r="7" fill="#fff0c0"/>${Array.from({ length: 8 }, (_, i) => { const a = (i / 8) * Math.PI * 2; return `<path d="M${25 + Math.cos(a) * 10} ${25 + Math.sin(a) * 10} L${25 + Math.cos(a) * 21} ${25 + Math.sin(a) * 21}" stroke="#ff7a2a" stroke-width="2.5"/>`; }).join('')}`),
  potion: wrap('#4a0a0a', `<path d="M20 10 L30 10 L30 18 L37 28 Q40 40 25 41 Q10 40 13 28 L20 18 Z" fill="#a01010" stroke="#d8c8a8" stroke-width="1.5"/><path d="M15 30 Q25 26 35 30 Q36 39 25 39 Q14 39 15 30Z" fill="#ff3a2a"/><rect x="19" y="7" width="12" height="4" fill="#8a6a3a"/>`),
};
