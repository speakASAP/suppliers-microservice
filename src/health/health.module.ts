import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { CredentialSelfReporter } from './credential-self-reporter';

@Module({
  controllers: [HealthController],
  providers: [CredentialSelfReporter],
})
export class HealthModule {}
