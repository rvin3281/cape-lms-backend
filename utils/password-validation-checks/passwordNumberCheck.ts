import { BadRequestException } from '@nestjs/common';
import { errorResponseBuilder } from 'utils/errorResponseBuilder';

export const PasswordNumberCheck = (password: string) => {
  if (!/[0-9]/.test(password)) {
    throw new BadRequestException(
      errorResponseBuilder('FORM_FIELD_ERROR', [
        {
          code: 'PASSWORD_NUMBER_REQUIRED',
          meta: {
            field: 'password',
            reason: 'Password must contain at least one number',
          },
        },
      ]),
    );
  }
};
