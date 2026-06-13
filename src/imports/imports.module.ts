import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { HttpModule } from "@nestjs/axios";
import { ImportJob } from "./import-job.entity";
import { ImportsService } from "./imports.service";
import { ImportsController } from "./imports.controller";
import { SupplierAdapterRegistry } from "./adapters/supplier-adapter-registry";
import { SyntheticTraceSupplierAdapter } from "./adapters/synthetic-trace-supplier-adapter";
import { LoggerModule } from "../logger/logger.module";
import { Supplier } from "../suppliers/supplier.entity";

@Module({
  imports: [TypeOrmModule.forFeature([ImportJob, Supplier]), HttpModule, LoggerModule],
  controllers: [ImportsController],
  providers: [
    ImportsService,
    SupplierAdapterRegistry,
    SyntheticTraceSupplierAdapter,
    {
      provide: "SUPPLIER_ADAPTER_REGISTRATION",
      inject: [SupplierAdapterRegistry, SyntheticTraceSupplierAdapter],
      useFactory: (registry: SupplierAdapterRegistry, syntheticAdapter: SyntheticTraceSupplierAdapter) => {
        registry.register(syntheticAdapter);
        return true;
      },
    },
  ],
  exports: [ImportsService, SupplierAdapterRegistry],
})
export class ImportsModule {}
