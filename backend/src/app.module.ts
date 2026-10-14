import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { LegacyModule } from './legacy/legacy.module';
import { ColegiadosModule } from './colegiados/colegiados.module';
import { BeneficiosModule } from './beneficios/beneficios.module';
import { PagosModule } from './pagos/pagos.module';
import { AuditModule } from './audit/audit.module';
import { FamModule } from './fam/fam.module';
import { FamBeneficiosModule } from './fam-beneficios/fam-beneficios.module';
import { ConfiguracionesModule } from './configuraciones/configuraciones.module';
import { MetodosPagoModule } from './metodos-pago/metodos-pago.module';
import { CatalogosModule } from './catalogos/catalogos.module';
import { FamCovidModule } from './fam-covid/fam-covid.module';
import { FamDuplicadosModule } from './fam-duplicados/fam-duplicados.module';
import { ExpedienteSlaModule } from './expediente-sla/expediente-sla.module';
import { TesoreriaModule } from './tesoreria/tesoreria.module';
import { ReportesModule } from './reportes/reportes.module';
import { AuditInterceptor } from './audit/audit.interceptor';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    PrismaModule,
    AuthModule,
    LegacyModule,
    ColegiadosModule,
    BeneficiosModule,
    PagosModule,
    AuditModule,
    FamModule,
    FamBeneficiosModule,
    ConfiguracionesModule,
    MetodosPagoModule,
    CatalogosModule,
    FamCovidModule,
    FamDuplicadosModule,
    ExpedienteSlaModule,
    TesoreriaModule,
    ReportesModule,
  ],
  providers: [
    { provide: APP_INTERCEPTOR, useClass: AuditInterceptor },
  ],
})
export class AppModule {}
