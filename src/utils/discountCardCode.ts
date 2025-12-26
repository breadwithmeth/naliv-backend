import crypto from 'crypto';

const CROCKFORD_BASE32_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

/**
 * Генерирует 12-символьный код дисконтной/бонусной карты.
 * Формат: Crockford Base32 (без I, L, O, U), верхний регистр.
 * 12 символов = 60 бит энтропии.
 */
export function generateDiscountCardCode12(): string {
  const bytes = crypto.randomBytes(8); // 64 бита

  // Берем только 60 бит, чтобы ровно уложиться в 12 base32-символов.
  let value = BigInt('0x' + bytes.toString('hex'));
  value = value & ((1n << 60n) - 1n);

  let out = '';
  for (let i = 0; i < 12; i += 1) {
    const shift = BigInt(5 * (11 - i));
    const index = Number((value >> shift) & 31n);
    out += CROCKFORD_BASE32_ALPHABET[index];
  }

  return out;
}
