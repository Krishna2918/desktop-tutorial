import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AppService {
  constructor(private configService: ConfigService) {}

  getInfo() {
    return {
      name: 'Universal Device Connector API',
      version: this.configService.get<string>('appVersion'),
      environment: this.configService.get<string>('nodeEnv'),
      documentation: '/api/docs',
      health: '/api/v1/health',
      timestamp: new Date().toISOString(),
    };
  }
}
