import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CategoryMapping } from './category-mapping.entity';
import { MappingsService } from './mappings.service';
import { MappingsController } from './mappings.controller';
import { LoggerModule } from '../logger/logger.module';
import { SuppliersModule } from '../suppliers/suppliers.module';

@Module({
  imports: [TypeOrmModule.forFeature([CategoryMapping]), LoggerModule, SuppliersModule],
  controllers: [MappingsController],
  providers: [MappingsService],
  exports: [MappingsService],
})
export class MappingsModule {}

