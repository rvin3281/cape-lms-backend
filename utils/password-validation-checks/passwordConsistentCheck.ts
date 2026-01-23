import { PASSWORDS_DO_NOT_MATCH } from '@app/shared';
import { BadRequestException } from '@nestjs/common';
import { errorResponseBuilder } from 'utils/errorResponseBuilder';

export const PasswordConsistentCheck = (
  password: string,
  confirmPassword: string,
) => {
  if (password !== confirmPassword) {
    throw new BadRequestException(
      errorResponseBuilder('FORM_FIELD_ERROR', [
        {
          code: PASSWORDS_DO_NOT_MATCH,
          meta: { field: 'confirmPassword' },
        },
      ]),
    );
  }
};
