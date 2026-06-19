const svg = (body, viewBox = '0 0 24 24') =>
  `<svg class="icon" viewBox="${viewBox}" fill="currentColor" xmlns="http://www.w3.org/2000/svg">${body}</svg>`;

export const nodes = () => svg(`
  <circle cx="6" cy="6" r="3"/>
  <circle cx="18" cy="6" r="3"/>
  <circle cx="6" cy="18" r="3"/>
  <circle cx="18" cy="18" r="3"/>
`);

export const road = () => svg(`
  <rect x="2" y="9" width="20" height="6" rx="1" fill="#555566"/>
  <rect x="2" y="9" width="20" height="2.5" fill="#ccccdd"/>
  <rect x="5"  y="11.5" width="3" height="1.2" fill="#fff"/>
  <rect x="11" y="11.5" width="3" height="1.2" fill="#fff"/>
  <rect x="17" y="11.5" width="3" height="1.2" fill="#fff"/>
`);

export const beam = () => svg(`
  <rect x="2" y="11" width="20" height="3" rx="1" transform="rotate(-15 12 12)"/>
  <circle cx="4" cy="16" r="2.2"/>
  <circle cx="20" cy="8" r="2.2"/>
`);

export const cable = () => svg(`
  <path d="M4 4 C 8 18, 16 18, 20 4" stroke="currentColor" stroke-width="2.5" fill="none"/>
`);

export const hydraulic = () => svg(`
  <rect x="9" y="3" width="6" height="14" rx="1"/>
  <rect x="6" y="17" width="12" height="4" rx="1"/>
`);

export const spring = () => svg(`
  <path d="M5 4 H19 M5 8 H19 M5 12 H19 M5 16 H19 M5 20 H19"
    stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/>
`);

export const remove = () => svg(`
  <rect x="4" y="9" width="16" height="9" rx="1"/>
  <rect x="4" y="6" width="16" height="3" rx="1"/>
`);

export const grid = () => svg(`
  <rect x="3" y="3" width="7" height="7" rx="1"/>
  <rect x="14" y="3" width="7" height="7" rx="1"/>
  <rect x="3" y="14" width="7" height="7" rx="1"/>
  <rect x="14" y="14" width="7" height="7" rx="1"/>
`);

export const snap = () => svg(`
  <path d="M4 12 L11 19 L20 5" stroke="currentColor" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
`);

export const zoomIn = () => svg(`
  <circle cx="11" cy="11" r="6" stroke="currentColor" stroke-width="2.5" fill="none"/>
  <rect x="8" y="10" width="6" height="2" rx="1"/>
  <rect x="10" y="8" width="2" height="6" rx="1"/>
  <rect x="15" y="15" width="6" height="2.5" rx="1" transform="rotate(45 15 15)"/>
`);

export const zoomOut = () => svg(`
  <circle cx="11" cy="11" r="6" stroke="currentColor" stroke-width="2.5" fill="none"/>
  <rect x="8" y="10" width="6" height="2" rx="1"/>
  <rect x="15" y="15" width="6" height="2.5" rx="1" transform="rotate(45 15 15)"/>
`);

export const play = () => svg(`
  <path d="M7 4 L20 12 L7 20 Z"/>
`);

export const undo = () => svg(`
  <path d="M5 10 L11 4 V8 H16 a4 4 0 0 1 0 8 H10" stroke="currentColor" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
`);

export const redo = () => svg(`
  <path d="M19 10 L13 4 V8 H8 a4 4 0 0 0 0 8 H14" stroke="currentColor" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
`);

export const home = () => svg(`
  <path d="M4 11 L12 4 L20 11" stroke="currentColor" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M6 10 V20 H18 V10" stroke="currentColor" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
  <rect x="10" y="14" width="4" height="6"/>
`);

export const clear = () => svg(`
  <rect x="6" y="3" width="12" height="3" rx="1"/>
  <path d="M5 7 L7 21 H17 L19 7 Z" stroke="currentColor" stroke-width="2" fill="none" stroke-linejoin="round"/>
  <path d="M10 10 V18 M14 10 V18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
`);

export const save = () => svg(`
  <path d="M5 3 H17 L21 7 V21 H3 V3 Z M7 3 V9 H15 V3 M7 13 H17 V19 H7 Z"
    stroke="currentColor" stroke-width="2" fill="none" stroke-linejoin="round"/>
`);

export const load = () => svg(`
  <path d="M3 7 H10 L12 5 H21 V19 H3 Z" stroke="currentColor" stroke-width="2" fill="none" stroke-linejoin="round"/>
`);

export const settings = () => svg(`
  <circle cx="12" cy="12" r="3.2" stroke="currentColor" stroke-width="2.5" fill="none"/>
  <path d="M12 2 V5 M12 19 V22 M2 12 H5 M19 12 H22 M5 5 L7 7 M17 17 L19 19 M5 19 L7 17 M17 7 L19 5"
    stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>
`);

export const help = () => svg(`
  <circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2.5" fill="none"/>
  <path d="M9 9 a3 3 0 0 1 6 0 c0 2 -3 2 -3 4" stroke="currentColor" stroke-width="2.5" fill="none" stroke-linecap="round"/>
  <circle cx="12" cy="17" r="1.3"/>
`);

export const coin = () => svg(`
  <circle cx="12" cy="12" r="10" fill="var(--gold)" stroke="var(--gold-dark)" stroke-width="3"/>
  <path d="M12 7 L13.5 10.5 L17 11 L14.5 13.5 L15 17 L12 15.3 L9 17 L9.5 13.5 L7 11 L10.5 10.5 Z" fill="#fff"/>
`);

export const bridgeLogo = () => svg(`
  <rect x="2" y="13" width="20" height="2.5" rx="1" fill="var(--orange)"/>
  <path d="M4 13 L7 7 L17 7 L20 13" stroke="var(--orange)" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
  <rect x="3" y="15" width="2" height="6" fill="var(--orange)"/>
  <rect x="19" y="15" width="2" height="6" fill="var(--orange)"/>
`);
