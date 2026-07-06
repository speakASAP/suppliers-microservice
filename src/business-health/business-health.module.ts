import { Module } from "@nestjs/common";
import { BusinessHealthController } from "./business-health.controller";
import { BusinessHealthService } from "./business-health.service";

@Module({
  controllers: [BusinessHealthController],
  providers: [BusinessHealthService],
})
export class BusinessHealthModule {}
