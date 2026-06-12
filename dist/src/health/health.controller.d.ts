export declare class HealthController {
    private readonly startTime;
    check(): {
        status: string;
        timestamp: string;
        uptime: number;
        environment: string;
    };
}
