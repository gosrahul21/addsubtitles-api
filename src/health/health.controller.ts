import { Controller, Get, HttpCode, HttpStatus } from '@nestjs/common';

@Controller('health')
export class HealthController {
  private readonly startTime = Date.now();

  /**
   * GET /health
   * Lightweight liveness probe for uptime monitors, load balancers, and k8s.
   *
   * Returns HTTP 200 with a JSON body so that monitoring tools (e.g. UptimeRobot,
   * Render health-check, Railway, AWS ALB) can validate both the status code and
   * response payload.
   */
  @Get()
  @HttpCode(HttpStatus.OK)
  check() {
    const uptimeSeconds = Math.floor((Date.now() - this.startTime) / 1000);

    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: uptimeSeconds,
      environment: process.env.NODE_ENV ?? 'development',
    };
  }
}
