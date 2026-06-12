import { AuthService } from './auth.service';
import { RegisterDto, LoginDto, GoogleLoginDto } from './dto/auth.dto';
import { Response, Request } from 'express';
export declare class AuthController {
    private authService;
    constructor(authService: AuthService);
    private setCookies;
    register(dto: RegisterDto, res: Response): Promise<{
        user: {
            id: string;
            email: string;
            subscriptionTier: string;
        };
    }>;
    login(dto: LoginDto, res: Response): Promise<{
        user: {
            id: any;
            email: any;
            subscriptionTier: any;
        };
    }>;
    googleLogin(dto: GoogleLoginDto, res: Response): Promise<{
        user: {
            id: any;
            email: any;
            subscriptionTier: any;
        };
    }>;
    refresh(req: Request, res: Response): Promise<{
        status: string;
    }>;
    logout(req: Request, res: Response): Promise<{
        status: string;
    }>;
}
