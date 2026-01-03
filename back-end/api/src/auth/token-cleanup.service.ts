// src/auth/token-cleanup.service.ts
import { Injectable } from "@nestjs/common";
import { AuthService } from "./auth.service";
import { Cron, CronExpression} from "@nestjs/schedule";

@Injectable()
export class TokenCleanupService {
    constructor(private authService: AuthService) {}

    @Cron(CronExpression.EVERY_HOUR)
    async handleCleanup(){
        const result = await this.authService.cleanupExpiredTokens();
        
    }
}