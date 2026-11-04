/*
 * One-click color themes. Each preset only sets color settings; shapes,
 * content and logo stay as they are. Every preset keeps dark dots on a light
 * background so it passes the contrast check.
 */
const BASE = { gradient: false, gradientType: 'linear', transparent: false, cornerCustom: false };

export const PRESETS = [
  { id: 'classic', name: 'Classic', ...BASE, fg: '#000000', bg: '#ffffff' },
  {
    id: 'midnight',
    name: 'Midnight blue',
    ...BASE,
    fg: '#14213d',
    bg: '#ffffff',
    cornerCustom: true,
    cornerColor: '#2f5bd3',
  },
  {
    id: 'forest',
    name: 'Forest',
    ...BASE,
    fg: '#1b4332',
    bg: '#f2f7ef',
    cornerCustom: true,
    cornerColor: '#2d6a4f',
  },
  {
    id: 'sunset',
    name: 'Sunset gradient',
    ...BASE,
    fg: '#c2410c',
    fg2: '#9f1239',
    gradient: true,
    bg: '#fff8f3',
  },
  {
    id: 'ocean',
    name: 'Ocean gradient',
    ...BASE,
    fg: '#0b6e79',
    fg2: '#1e3a8a',
    gradient: true,
    gradientType: 'radial',
    bg: '#ffffff',
  },
  {
    id: 'grape',
    name: 'Grape gradient',
    ...BASE,
    fg: '#5b3df5',
    fg2: '#2a1580',
    gradient: true,
    bg: '#ffffff',
  },
  {
    id: 'espresso',
    name: 'Espresso',
    ...BASE,
    fg: '#2b2420',
    bg: '#f6f1e7',
    cornerCustom: true,
    cornerColor: '#b4471b',
  },
  { id: 'rose', name: 'Rose', ...BASE, fg: '#831843', bg: '#fff1f5' },
];
