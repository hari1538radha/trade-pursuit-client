// Dashboard backgrounds. Add more by dropping a photo in public/cars and listing it here.
export const CARS = [
  { id: 'm4-snow', name: 'BMW M4 Competition', sub: 'Snow forest', src: '/cars/m4-snow.jpg', thumb: '/cars/m4-snow-thumb.jpg', pos: 'center 74%' },
  { id: 'm4-rain', name: 'BMW M4 Competition', sub: 'Isle of Man green, rain', src: '/cars/m4-rain.jpg', thumb: '/cars/m4-rain-thumb.jpg', pos: 'center 48%' },
];

export const DEFAULT_APPEARANCE = { car: 'm4-snow', customImage: '', customName: '', glass: 50 };

/** Resolve the user's appearance settings into { src, pos, name } or null. */
export function carBackground(appearance) {
  const a = { ...DEFAULT_APPEARANCE, ...(appearance || {}) };
  if (a.car === 'none') return null;
  if (a.car === 'custom') return a.customImage ? { src: a.customImage, pos: 'center', name: a.customName || 'Your car' } : null;
  const c = CARS.find((x) => x.id === a.car) || CARS[0];
  return { src: c.src, pos: c.pos, name: c.name };
}
