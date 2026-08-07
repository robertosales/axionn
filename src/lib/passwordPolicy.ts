export const PASSWORD_MIN_LENGTH = 12;

export function passwordPolicyError(password: string): string | null {
  if (password.length < PASSWORD_MIN_LENGTH) {
    return `A senha deve ter ao menos ${PASSWORD_MIN_LENGTH} caracteres`;
  }
  if (!/[a-z]/.test(password) || !/[A-Z]/.test(password)
    || !/[0-9]/.test(password) || !/[^A-Za-z0-9]/.test(password)) {
    return "Use letras maiúsculas e minúsculas, número e símbolo";
  }
  return null;
}
