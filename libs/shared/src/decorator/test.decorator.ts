import { SetMetadata } from '@nestjs/common';

/**
 * HOW REFLECTOR + INTERCEPTOR WORK TOGETHER
 *
 * 1) A custom decorator (e.g. @TestDecorotar) uses SetMetadata()
 *    to ATTACH configuration data (code, message, meta, etc.)
 *    to a controller method.
 *
 * 2) At runtime, when a request hits that controller method,
 *    the Interceptor is executed AFTER the controller/service
 *    returns a value, but BEFORE the response is sent to client.
 *
 * 3) Inside the Interceptor, Reflector is used to READ the metadata
 *    attached to the current controller method (context.getHandler()).
 *
 * 4) The Interceptor then uses that metadata to APPLY LOGIC
 *    (e.g. wrap success response, add meta, change message),
 *    and RETURNS the final HTTP response.
 *
 * IMPORTANT:
 * - Controller returns RAW DATA only (business result)
 * - Interceptor formats the SUCCESS response
 * - Reflector enables per-route customization without
 *   duplicating response logic in controllers
 */

export const API_SUCCESS_KEY = 'test_decorator';

export const TestDecorotar = (options: { code: string; message: string }) =>
  SetMetadata(API_SUCCESS_KEY, options);
