/**
 * Reading the clock is impure, so it is kept out of component bodies. Server
 * components render once per request, so a single call here gives the whole
 * page one consistent "now" — which is what the "New" badge cut-off needs.
 */
export function readClock(): number {
  return Date.now();
}
