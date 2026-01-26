import { HttpService } from '@nestjs/axios';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AxiosResponse } from 'axios';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class LearnworldsGateway {
  private readonly logger = new Logger(LearnworldsGateway.name);

  constructor(
    private readonly config: ConfigService,
    private readonly http: HttpService,
  ) {}

  isEnabled() {
    return this.config.get<boolean>('learnworls.learnworlds_enable') === true;
  }

  private getHeaders() {
    const bearer = this.config.get<string>(
      'learnworls.learnworld_bearer_token',
    );
    const clientId = this.config.get<string>(
      'learnworls.learnworld_lw_client_id',
    );

    return {
      Authorization: `Bearer ${bearer}`,
      'Lw-Client': clientId,
      Accept: 'application/json',
    };
  }

  async updateUserByEmail(
    url: string,
    payload: any,
  ): Promise<
    { skipped: true } | { skipped: false; response: AxiosResponse<any, any> }
  > {
    if (!this.isEnabled()) {
      this.logger.warn(`[LW DISABLED] Skipping updateUserByEmail for`);
      return { skipped: true };
    }

    const baseURL = this.config.get<string>(
      'learnworls.learnworld_api_base_url',
    );

    const response = await firstValueFrom(
      this.http.put(url, payload, { baseURL, headers: this.getHeaders() }),
    );

    return {
      skipped: false,
      response,
    };
  }
}
