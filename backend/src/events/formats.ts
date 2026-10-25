/**
 * What kind of event it is. Races and Jedermann races are timed competitions; the others are
 * recreational rides (Breitensport) without times or placings.
 *
 * - `race`: licence race (Lizenzrennen, Hobby races included)
 * - `jedermann`: open race for riders without licence (Jedermann, Gran Fondo)
 * - `rtf`: Radtourenfahrt, marked road routes of 20–199 km
 * - `ctf`: Country-Tourenfahrt, marked off-road routes (MTB, cross)
 * - `marathon`: Radmarathon, road routes of 200 km and more
 * - `brevet`: randonneur ride (Audax, ARA/ACP brevets of 200/300/400/600 km)
 * - `gravel_ride`: gravel tour without timing
 * - `tour`: other rides (Radwandern, Volksradfahren, club tours)
 * - `kids`: races for young children without licence (Fette-Reifen-Rennen, Laufradrennen)
 */
export const EVENT_FORMATS = [
  'race',
  'jedermann',
  'rtf',
  'ctf',
  'marathon',
  'brevet',
  'gravel_ride',
  'tour',
  'kids',
] as const;
export type EventFormat = (typeof EVENT_FORMATS)[number];

/** Formats without times or placings: everyone may ride, routes only differ in length. */
export const TOURING_FORMATS: readonly EventFormat[] = [
  'rtf',
  'ctf',
  'marathon',
  'brevet',
  'gravel_ride',
  'tour',
];

/** Search shortcut for all touring formats. */
export const TOURING_GROUP = 'touring';

/** Oldest age (reached in the year) of a kids' race; also finds kids' classes of other events. */
export const KIDS_MAX_AGE = 12;

const RULES: [RegExp, EventFormat][] = [
  [/\bRTF\b|Radtourenfahrt/i, 'rtf'],
  [/\bCTF\b|Country[-\s]?Tour/i, 'ctf'],
  [/Radmarathon/i, 'marathon'],
  [/\bBrevet\b|\bAudax\b|Randonn/i, 'brevet'],
  [/Jedermann|Jederfrau|Gran\s?Fondo/i, 'jedermann'],
  [/Gravel[-\s]?(Ride|Tour|Fahrt)/i, 'gravel_ride'],
  [/Radwander|Volksradfahr/i, 'tour'],
  // Last: kids' races often run alongside an RTF or race named first.
  [
    /Fette[-\s]?Reifen|Laufrad[-\s]?Rennen|Kinder[-\s]?Rennen|Kids[-\s]?(Race|Rennen|Cup)|Bambini/i,
    'kids',
  ],
];

/** The format an event name clearly states, or null (a plain race name says nothing). */
export function inferFormat(name: string): EventFormat | null {
  for (const [pattern, format] of RULES) if (pattern.test(name)) return format;
  return null;
}
