import { BadRequestException } from '@nestjs/common';
import { errorResponseBuilder } from 'utils/errorResponseBuilder';

export const PasswordSpecialCharCheck = (password: string) => {
  if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    throw new BadRequestException(
      errorResponseBuilder('FORM_FIELD_ERROR', [
        {
          code: 'PASSWORD_SPCIALCHAR_REQUIRED',
          meta: {
            field: 'password',
            reason: 'Password must contain at least one special character',
          },
        },
      ]),
    );
  }
};
