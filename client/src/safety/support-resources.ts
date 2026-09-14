// A local, non-diagnostic suggestion. Never logged, uploaded or persisted as a
// flag against the writer. The resource entry remains available without a match.
export function mightNeedSupport(text: string): boolean {
  return /\b(?:kill myself|end my life|want to die|thinking (?:of|about) suicide|hurt myself|cannot go on|can't go on)\b/i.test(text.slice(0, 20000));
}
export const SUPPORT_RESOURCES = [
  { label: 'Find a helpline in my country', url: 'https://findahelpline.com/' },
  { label: 'India · Tele-MANAS 14416', url: 'tel:14416' },
  { label: 'US & Canada · Call 988', url: 'tel:988' },
] as const;
