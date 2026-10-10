const SETS = ['ABCDEFGHJKLMNPQRSTUVWXYZ', 'abcdefghijkmnopqrstuvwxyz', '23456789', '@#$%&*!?'];

/**
 * A temporary password that meets the policy (12 characters, all four classes), without look-
 * alike characters (0/O, 1/l/I) so it can be read out over the phone.
 */
export function generatePassword(length = 12) {
  const rand = (n) => {
    const a = new Uint32Array(1);
    globalThis.crypto.getRandomValues(a);
    return a[0] % n;
  };
  const chars = SETS.map((s) => s[rand(s.length)]);
  const all = SETS.join('');
  while (chars.length < length) chars.push(all[rand(all.length)]);
  for (let i = chars.length - 1; i > 0; i--) {
    const j = rand(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
}
