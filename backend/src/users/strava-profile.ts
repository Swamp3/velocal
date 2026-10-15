import { BadRequestException } from '@nestjs/common';

const ATHLETE_ID = /^\d{1,12}$/;
const PROFILE_URL =
  /^https:\/\/(?:www\.)?strava\.com\/(?:athletes|pros)\/([A-Za-z0-9_.-]{1,60})\/?(?:[?#].*)?$/i;

/**
 * Turns what a user typed into a canonical Strava profile link: an athlete id
 * (`12345678`) or a profile URL. Anything else is rejected, so only strava.com
 * links are ever stored and shown to other people.
 */
export function normalizeStravaProfile(input: string): string | null {
  const value = input.trim();
  if (!value) return null;
  if (ATHLETE_ID.test(value)) {
    return `https://www.strava.com/athletes/${value}`;
  }
  const match = PROFILE_URL.exec(value);
  if (!match) {
    throw new BadRequestException(
      'Enter a strava.com profile link or your athlete ID',
    );
  }
  return `https://www.strava.com/athletes/${match[1]}`;
}
