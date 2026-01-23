import { BadRequestException } from '@nestjs/common';
import { errorResponseBuilder } from 'utils/errorResponseBuilder';

export const PasswordLengthChecks = (password: string) => {
  if (password.length < 8) {
    throw new BadRequestException(
      errorResponseBuilder('FORM_FIELD_ERROR', [
        {
          code: 'PASSWORD_TOO_WEAK',
          meta: {
            field: 'password',
            reason: 'Password must be at least 8 characters long',
          },
        },
      ]),
    );
  }
};
