import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { UpdateUserDto } from './dto/update-user.dto';
export declare class UsersController {
    private prisma;
    private redisService;
    constructor(prisma: PrismaService, redisService: RedisService);
    getMe(req: any): Promise<any>;
    updateMe(req: any, updateUserDto: UpdateUserDto): Promise<{
        message: string;
        user?: undefined;
    } | {
        message: string;
        user: {
            email: string;
            id: string;
            createdAt: Date;
        };
    }>;
}
