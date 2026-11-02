import { ViewsService } from './views.service';
export declare class ViewsController {
    private readonly viewsService;
    constructor(viewsService: ViewsService);
    incrementView(entityType: string, slug: string): Promise<{
        entityType: string;
        slug: string;
        views: number;
    }>;
    getViewCount(entityType: string, slug: string): Promise<{
        entityType: string;
        slug: string;
        views: number;
    }>;
    getBatchViews(entityType: string): Promise<{
        entityType: string;
        views: Record<string, number>;
    }>;
}
