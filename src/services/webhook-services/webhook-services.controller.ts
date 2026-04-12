/* eslint-disable @typescript-eslint/require-await */
import { LearnWorldsUserProgramEnrollmentDto } from '@app/shared';
import { Body, Controller, Headers, HttpCode, Post } from '@nestjs/common';
import { WebhookServicesService } from './webhook-services.service';

@Controller('webhook/learnworlds')
export class WebhookServicesController {
  constructor(private readonly webHookService: WebhookServicesService) {}

  // This is only to test webhook and to console.log the header data and body data from learnworlds
  @Post('bulk-import-user')
  async bulkImportUserWebhook(
    @Body() body: any,
    @Headers() headers: any,
  ): Promise<any> {
    console.log('LearnWorlds headers:', headers);
    console.log('LearnWorlds payload:', body);

    // IMPORTANT: respond 200 fast
    return { ok: true };
  }

  @Post('learworlds-user')
  async bulkImportLearnworldsUser(
    @Body() body: any,
    @Headers() headers: any,
  ): Promise<any> {
    console.log('LearnWorlds headers:', headers);
    console.log('LearnWorlds payload:', body);

    // IMPORTANT: respond 200 fast
    return { ok: true };
  }

  @Post('user-program-enrollment')
  @HttpCode(200)
  async userProgramEnrollment(
    @Body() body: LearnWorldsUserProgramEnrollmentDto,
  ) {
    return this.webHookService.userProgramEnrollment(body);
  }
}
