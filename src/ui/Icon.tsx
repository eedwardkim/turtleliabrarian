import type { ButtonHTMLAttributes } from 'react';

const paths = {
  play: 'm8 5 11 7-11 7Z',
  pause: 'M8 5v14M16 5v14',
  stop: 'M6 6h12v12H6Z',
  queue: 'M4 7h11M4 12h11M4 17h7m6-3 4 3-4 3',
  close: 'm6 6 12 12M18 6 6 18',
  minus: 'M5 12h14',
  plus: 'M12 5v14M5 12h14',
  restore: 'M8 4h12v12M4 8h12v12H4Z',
  move: 'M12 3v18M3 12h18M9 6l3-3 3 3M9 18l3 3 3-3M6 9l-3 3 3 3m12-6 3 3-3 3',
  resize: 'M10 20 20 10M15 20l5-5M5 20 20 5',
  book: 'M12 6C8 3 4 4 3 4v15c3-1 6-1 9 1 3-2 6-2 9-1V4c-3-1-6 0-9 2Zm0 0v14',
  settings: 'M4 7h16M4 17h16M8 4v6M16 14v6',
  windows: 'M3 4h12v11H3ZM9 15v5h12V9h-6M3 8h12',
  bell: 'M5 16h14l-2-4V9a5 5 0 0 0-10 0v3Zm5 4h4M12 2v2',
  ink: 'M8 3h8M9 3v5l-4 5v7h14v-7l-4-5V3M5 14h14',
  stars: 'm12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9Z',
  oil: 'M7 21h10M12 21v-5M5 16h14L16 5H8ZM10 5V2h4v3',
  eggs: 'M19 14c0 5-3 7-7 7s-7-2-7-7S9 3 12 3s7 6 7 11Z',
  served: 'M4 20v-3a5 5 0 0 1 10 0v3M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8m7 1 2 2 4-5',
  arrow: 'M4 12h16m-6-6 6 6-6 6',
  back: 'M20 12H4m6-6-6 6 6 6',
  check: 'm5 12 5 5L20 6',
  hint: 'M8 16c0-3-3-3-3-7a7 7 0 0 1 14 0c0 4-3 4-3 7ZM9 20h6M10 23h4',
  save: 'M4 3h13l4 4v14H3V3Zm3 0v7h10V3M7 21v-7h10v7',
  download: 'M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5',
  upload: 'M12 16V4m-5 5 5-5 5 5M4 16v5h16v-5',
  rewind: 'M4 11a8 8 0 1 1 1 6M4 4v7h7',
  step: 'm5 5 10 7-10 7ZM19 5v14',
  terminal: 'm4 6 6 6-6 6M13 18h7',
  shop: 'M3 9h18L19 3H5ZM5 9v12h14V9M9 21v-7h6v7',
  order: 'M5 3h14v18H5ZM8 7h8M8 11h8M8 15h4',
  ghost: 'M5 20V10a7 7 0 0 1 14 0v10l-3-2-4 3-4-3ZM9 10v2m6-2v2',
  search: 'm15 15 6 6M17 10a7 7 0 1 1-14 0 7 7 0 0 1 14 0',
  warning: 'm12 3 10 18H2ZM12 9v5m0 3v1',
  key: 'M14 7a5 5 0 1 1-10 0 5 5 0 0 1 10 0Zm-1 4 8 8m-4-4-3 3m6 0-3 3',
} satisfies Record<string, string>;

export type IconName = keyof typeof paths;

export function Icon({ name, className = '' }: { name: IconName; className?: string }) {
  return <svg className={`icon ${className}`} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name]} /></svg>;
}

export function IconButton({ icon, label, className = '', showLabel = false, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { icon: IconName; label: string; showLabel?: boolean }) {
  return <button type="button" className={`icon-button ${showLabel ? 'labeled-button' : ''} ${className}`} aria-label={label} title={label} {...props}><Icon name={icon} />{showLabel && <span>{label}</span>}</button>;
}

export function TurtleMark({ walking = false }: { walking?: boolean }) {
  return <svg className={`turtle-mark ${walking ? 'walking' : ''}`} viewBox="0 0 120 76" aria-hidden="true">
    <path className="turtle-foot foot-back" d="M27 53v12h13V52" fill="#4F7F60" />
    <path className="turtle-foot foot-front" d="M73 52v13h13V50" fill="#6FA37F" />
    <path d="m21 47-13 8 17 1" fill="#4F7F60" />
    <path d="M20 52c-3-46 62-52 70-7l-4 10H26Z" fill="#C27E41" stroke="#6E4020" strokeWidth="2" />
    <path d="m40 21 22-4 13 18-11 18H43L31 35Z" fill="#D89A55" stroke="#A8652F" strokeWidth="2" />
    <path d="m41 22 2 30m21-35v36M22 40l11-5m43 0 10 3" fill="none" stroke="#E3AE6A" strokeWidth="2" />
    <path d="M84 48c0-4 0-11 9-16 18-9 25 20 8 23H81" fill="#93C49D" />
    <circle cx="101" cy="40" r="6" fill="#DDEBEA" stroke="#C99A3E" strokeWidth="2" />
    <circle cx="103" cy="40" r="2" fill="#2A2522" />
    <path d="m94 39-8-2m20 13 5-2" stroke="#6E4020" strokeWidth="1.5" fill="none" />
    <path d="M40 13h31v7H40Z" fill="#3E5C8A" /><path d="M44 6h22v7H44Z" fill="#B5475A" /><path d="M47 8h17v3H47Z" fill="#F4ECD8" />
  </svg>;
}
