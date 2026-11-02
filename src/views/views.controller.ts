import { Controller, Post, Get, Param, BadRequestException } from '@nestjs/common';
import { ViewsService } from './views.service';

@Controller('views')
export class ViewsController {
  constructor(private readonly viewsService: ViewsService) {}

  /**
   * Increment view count when a blog or tool is viewed
   * e.g., POST /views/tool/tiktok-subtitle-generator
   *       POST /views/blog/silent-view-secret
   */
  @Post(':entityType/:slug')
  async incrementView(
    @Param('entityType') entityType: string,
    @Param('slug') slug: string,
  ) {
    if (!entityType || !slug) {
      throw new BadRequestException('entityType and slug are required');
    }

    const views = await this.viewsService.incrementView(entityType, slug);
    return {
      entityType,
      slug,
      views,
    };
  }

  /**
   * Get single page view count
   * e.g., GET /views/tool/tiktok-subtitle-generator
   */
  @Get(':entityType/:slug')
  async getViewCount(
    @Param('entityType') entityType: string,
    @Param('slug') slug: string,
  ) {
    if (!entityType || !slug) {
      throw new BadRequestException('entityType and slug are required');
    }

    const views = await this.viewsService.getViewCount(entityType, slug);
    return {
      entityType,
      slug,
      views,
    };
  }

  /**
   * Get batch view counts for all items in an entity type
   * e.g., GET /views/tool
   *       GET /views/blog
   */
  @Get(':entityType')
  async getBatchViews(@Param('entityType') entityType: string) {
    if (!entityType) {
      throw new BadRequestException('entityType is required');
    }

    const views = await this.viewsService.getAllViews(entityType);
    return {
      entityType,
      views,
    };
  }
}
