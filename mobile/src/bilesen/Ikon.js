// Çizgi ikon seti — web'deki kit.jsx → Icon'ın react-native-svg karşılığı.
// Yollar BİREBİR AYNI: emoji kullanmama ve tek ikon dili kuralı mobilde
// de geçerli (emoji platforma göre değişen, yazı tipinin kontrol
// etmediği bir görsel).
import React from 'react';
import Svg, { Path, Circle, Polyline, Polygon, Line, Rect } from 'react-native-svg';

export function Ikon({ n, size = 18, color = '#1C1917', strokeWidth = 2 }) {
  const o = { stroke: color, strokeWidth, strokeLinecap: 'round', strokeLinejoin: 'round', fill: 'none' };
  const yollar = {
    plate: <><Circle cx="12" cy="12" r="9" {...o} /><Circle cx="12" cy="12" r="4" {...o} /></>,
    shield: <Path d="M12 2l8 4v6c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V6l8-4z" {...o} />,
    doc: <><Path d="M6 2h9l5 5v15H6z" {...o} /><Path d="M15 2v5h5" {...o} /></>,
    camera: <><Path d="M4 8h3l2-3h6l2 3h3v12H4z" {...o} /><Circle cx="12" cy="14" r="3.5" {...o} /></>,
    sparkle: <Path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5L18 18M18 6l-2.5 2.5M8.5 15.5L6 18" {...o} />,
    check: <Polyline points="20 6 9 17 4 12" {...o} />,
    clock: <><Circle cx="12" cy="12" r="9" {...o} /><Polyline points="12 7 12 12 16 14" {...o} /></>,
    heart: <Path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" {...o} />,
    cross: <><Line x1="18" y1="6" x2="6" y2="18" {...o} /><Line x1="6" y1="6" x2="18" y2="18" {...o} /></>,
    chat: <Path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z" {...o} />,
    star: <Polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" {...o} />,
    flame: <Path d="M12 2c1 3-3 4-3 8a3 3 0 006 0c1.5 1 2 3 2 4a5 5 0 01-10 0c0-4 3-6 5-12z" {...o} />,
    eye: <><Path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" {...o} /><Circle cx="12" cy="12" r="3" {...o} /></>,
    chart: <><Line x1="4" y1="20" x2="4" y2="10" {...o} /><Line x1="12" y1="20" x2="12" y2="4" {...o} /><Line x1="20" y1="20" x2="20" y2="14" {...o} /></>,
    pin: <><Path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" {...o} /><Circle cx="12" cy="10" r="3" {...o} /></>,
    bulb: <Path d="M9 18h6M10 22h4M12 2a7 7 0 00-4 12.7c.6.5 1 1.2 1 2.3h6c0-1.1.4-1.8 1-2.3A7 7 0 0012 2z" {...o} />,
    trash: <><Polyline points="3 6 5 6 21 6" {...o} /><Path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" {...o} /></>,
    search: <><Circle cx="11" cy="11" r="8" {...o} /><Line x1="21" y1="21" x2="16.65" y2="16.65" {...o} /></>,
    brokenHeart: <><Path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" {...o} /><Line x1="10" y1="9" x2="14" y2="14" {...o} /><Line x1="14" y1="9" x2="10" y2="14" {...o} /></>,
    photo: <><Rect x="3" y="3" width="18" height="18" rx="2" {...o} /><Circle cx="8.5" cy="8.5" r="1.5" {...o} /><Polyline points="21 15 16 10 5 21" {...o} /></>,
    geri: <Polyline points="15 18 9 12 15 6" {...o} />,
    ok: <><Line x1="5" y1="12" x2="19" y2="12" {...o} /><Polyline points="12 5 19 12 12 19" {...o} /></>,
    kisi: <><Circle cx="12" cy="8" r="4" {...o} /><Path d="M4 21c0-4 3.6-6 8-6s8 2 8 6" {...o} /></>,
    kart: <><Rect x="6" y="3" width="12" height="15" rx="2.5" transform="rotate(-8 12 10.5)" {...o} /><Rect x="6" y="6" width="12" height="15" rx="2.5" {...o} /></>,
    izgara: <><Rect x="3" y="3" width="7" height="7" rx="1.5" {...o} /><Rect x="14" y="3" width="7" height="7" rx="1.5" {...o} /><Rect x="3" y="14" width="7" height="7" rx="1.5" {...o} /><Rect x="14" y="14" width="7" height="7" rx="1.5" {...o} /></>,
  };
  return <Svg width={size} height={size} viewBox="0 0 24 24">{yollar[n] || null}</Svg>;
}

export default Ikon;
