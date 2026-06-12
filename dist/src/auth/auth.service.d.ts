import { PrismaService } from '../prisma/prisma.service';
import { RegisterDto, LoginDto, GoogleLoginDto } from './dto/auth.dto';
import { JwtService } from '@nestjs/jwt';
export declare class AuthService {
    private prisma;
    private jwtService;
    constructor(prisma: PrismaService, jwtService: JwtService);
    private hashValue;
    private compareHash;
    private generateTokens;
    private claimGuestProjects;
    register(dto: RegisterDto): Promise<{
        user: {
            id: string;
            email: string;
            subscriptionTier: string;
        };
        tokens: {
            accessToken: string;
            refreshToken: string;
        };
    }>;
    login(dto: LoginDto): Promise<{
        user: {
            id: any;
            email: any;
            subscriptionTier: any;
        };
        tokens: {
            accessToken: string;
            refreshToken: string;
        };
    }>;
    googleLogin(dto: GoogleLoginDto): Promise<{
        user: {
            id: any;
            email: any;
            subscriptionTier: any;
        };
        tokens: {
            accessToken: string;
            refreshToken: string;
        };
    }>;
    refreshToken(token: string): Promise<{
        tokens: {
            accessToken: string;
            refreshToken: string;
        };
    }>;
    logout(token: string): Promise<void>;
}
