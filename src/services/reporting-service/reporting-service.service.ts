/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { CohortReportQueryDto } from '@app/shared/dto/reports/cohort-report.query';
import { BundlesResponse } from '@app/shared/interfaces/IBundle.interface';
import { MockDataService } from '@app/shared/mock-data.service';
import {
  HttpException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';

@Injectable()
export class ReportingServiceService {
  private readonly logger = new Logger(ReportingServiceService.name);

  constructor(private readonly mockData: MockDataService) {}

  async getCohortReport(query: CohortReportQueryDto): Promise<any> {
    try {
      // 1. Get all Bundle
      const { page } = query;

      const bundles = await this.mockData.getJson(
        'libs/shared/src/sample-data/bundle.json',
      );

      const itemsPerPage = bundles?.meta?.itemsPerPage;

      /** PAGINATION DATA */
      const totalItems = bundles.data.length;
      const totalPages = Math.max(1, Math.ceil(totalItems / itemsPerPage));
      // safePage is a “protected” version of the page number that guarantees we never ask for a page that doesn’t exist.
      const safePage = Math.min(Math.max(page, 1), totalPages);

      const start = (safePage - 1) * itemsPerPage;
      const end = start + itemsPerPage;

      const bundleData: BundlesResponse = {
        data: bundles?.data?.slice(start, end),
        meta: {
          totalItems,
          totalPages,
          page: safePage,
          itemsPerPage, // always 20
        },
      };

      // 1. Send request to Learwordls API /bundle
      return new Promise((resolve, reject) => {
        resolve(bundleData);
      });
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(
        message,
        error instanceof Error ? error.stack : undefined,
      );
      throw new InternalServerErrorException('An unexpected error occurs');
    }
  }

  async getCohortById(id: string): Promise<any> {
    try {
      // Note: Use learnworlds api to Get Bundle By id

      const bundleData: BundlesResponse = await this.mockData.getJson(
        'libs/shared/src/sample-data/bundle.json',
      );

      const findBundleById = bundleData.data.find((item) => item.id === id);

      if (!findBundleById) {
        throw new NotFoundException(`Bundle with id "${id}" not found`);
      }

      return findBundleById;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(
        message,
        error instanceof Error ? error.stack : undefined,
      );
      throw new InternalServerErrorException('An unexpected error occurs');
    }
  }
}
