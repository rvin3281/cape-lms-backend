import { BadRequestException } from '@nestjs/common';
import { errorResponseBuilder } from 'utils/errorResponseBuilder';

export const PasswordCapsCheck = (password: string) => {
  if (!/[A-Z]/.test(password)) {
    throw new BadRequestException(
      errorResponseBuilder('FORM_FIELD_ERROR', [
        {
          code: 'PASSWORD_CAPITAL_REQUIRED',
          meta: {
            field: 'password',
            reason: 'Password must contain at least one uppercase letter',
          },
        },
      ]),
    );
  }
};
