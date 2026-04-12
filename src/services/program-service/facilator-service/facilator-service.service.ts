import { PrismaService } from '@app/database';
import {
  AddFacilitatorDto,
  PaginationQueryDto,
  UpdateFacilitatorDto,
} from '@app/shared';
import {
  BadRequestException,
  HttpException,
  Injectable,
  Logger,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { errorResponseBuilder } from 'utils/errorResponseBuilder';

@Injectable()
export class FacilatorServiceService {
  private readonly logger = new Logger(FacilatorServiceService.name);

  constructor(private readonly prismaService: PrismaService) {}

  async addFacilitator(dto: AddFacilitatorDto): Promise<any> {
    try {
      const facilator = await this.prismaService.facilitator.findFirst({
        where: {
          facilitatorName: dto.facilitatorName,
        },
      });

      if (facilator) {
        throw new BadRequestException(
          errorResponseBuilder(
            'FACILITATOR_NAME_EXIST',
            undefined,
            `Facilitator with name ${dto.facilitatorName} added`,
          ),
        );
      }

      const newFacilitator = await this.prismaService.facilitator.create({
        data: {
          facilitatorName: dto.facilitatorName,
        },
      });

      return { facilitator: newFacilitator };
    } catch (error: any) {
      if (error instanceof HttpException) throw error;
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(
        message,
        error instanceof Error ? error.stack : undefined,
      );
      throw new InternalServerErrorException('An unexpected error occurs');
    }
  }

  async getAllFacilitator(query: PaginationQueryDto): Promise<any> {
    try {
      const page = query.page ?? 1;
      const pageSize = query.pageSize ?? 10;

      const skip = (page - 1) * pageSize;
      const take = pageSize;

      const [items, total] = await this.prismaService.$transaction([
        this.prismaService.facilitator.findMany({
          skip,
          take,
          orderBy: {
            createdAt: 'desc',
          },
        }),
        this.prismaService.facilitator.count(),
      ]);

      return {
        items: items ?? [], // safety (optional but clean)
        meta: {
          page,
          pageSize,
          total,
          totalPages: total === 0 ? 0 : Math.ceil(total / pageSize),
        },
      };
    } catch (error: any) {
      if (error instanceof HttpException) throw error;

      const message = error instanceof Error ? error.message : 'Unknown error';

      this.logger.error(
        message,
        error instanceof Error ? error.stack : undefined,
      );

      throw new InternalServerErrorException('An unexpected error occurs');
    }
  }

  async updateFacilitator(id: string, dto: UpdateFacilitatorDto): Promise<any> {
    try {
      // 1. Find facilitator by id
      const facilitator = await this.prismaService.facilitator.findUnique({
        where: { facilitatorId: id },
      });

      // 2. if not found return error
      if (!facilitator) {
        throw new NotFoundException(
          errorResponseBuilder(
            'FACILITATOR_NOT_FOUND',
            undefined,
            `Facilitator with ID ${id} not found`,
          ),
        );
      }

      const data: Record<string, any> = {};

      if (
        dto.facilitatorName.trim() !== '' &&
        dto.facilitatorName !== undefined &&
        facilitator.facilitatorName !== dto.facilitatorName
      ) {
        data.facilitatorName = dto.facilitatorName;
      }

      if (Object.keys(data).length === 0) {
        return {
          success: true,
          message: 'No changes detected',
          data: facilitator,
        };
      }

      const updatedFacilitator = await this.prismaService.facilitator.update({
        where: { facilitatorId: id },
        data,
      });

      return {
        success: true,
        message: 'Facilitator updated successfully',
        data: updatedFacilitator,
      };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(
        message,
        error instanceof Error ? error.stack : undefined,
      );
      throw new InternalServerErrorException('An unexpected error occurs');
    }
  }

  async deleteFacilitator(id: string) {
    try {
      await this.prismaService.facilitator.delete({
        where: { facilitatorId: id },
      });
    } catch (error) {
      if (error instanceof HttpException) throw error;
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(
        message,
        error instanceof Error ? error.stack : undefined,
      );
      throw new InternalServerErrorException('An unexpected error occurs');
    }
  }
}
