import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { SuppliersModule } from './suppliers/suppliers.module';
import { ImportsModule } from './imports/imports.module';
import { MappingsModule } from './mappings/mappings.module';
import { HealthModule } from './health/health.module';
import { LoggerModule } from './logger/logger.module';
import { AuthModule } from './auth/auth.module';
import { JwtRolesGuard } from './auth/jwt-roles.guard';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    AuthModule,
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST || 'db-server-postgres',
      port: parseInt(process.env.DB_PORT || '5432', 10),
      username: process.env.DB_USER || 'dbadmin',
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME || 'supplier_db',
      entities: [__dirname + '/**/*.entity{.ts,.js}'],
      synchronize: process.env.NODE_ENV !== 'production',
    }),
    LoggerModule,
    HealthModule,
    SuppliersModule,
    ImportsModule,
    MappingsModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: JwtRolesGuard },
  ],
})
export class AppModule {}

