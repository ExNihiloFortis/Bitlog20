// lib/validateTicket.ts
// Valida el formato del ticket para evitar basura / inputs raros.
// Permitimos letras, números, guion y guion bajo. Máx 40 chars.

export function isValidTicket(input: string): boolean {
  const s = input.trim();
  if (!s) return false;
  const re = /^[A-Za-z0-9_-]{1,40}$/;
  return re.test(s);
}

