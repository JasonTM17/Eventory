import { BadRequestException } from '@nestjs/common';

export function assertPasswordPolicy(password: string): void {
  const hasUppercase = /[A-Z]/.test(password);
  const hasLowercase = /[a-z]/.test(password);
  const hasNumber = /\d/.test(password);
  if (
    password.length < 12 ||
    password.length > 128 ||
    !hasUppercase ||
    !hasLowercase ||
    !hasNumber
  ) {
    throw new BadRequestException({
      code: 'WEAK_PASSWORD',
      message: 'Password must be 12-128 characters with upper, lower, and numeric characters',
    });
  }
}
