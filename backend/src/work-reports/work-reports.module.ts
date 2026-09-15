import { ProductionCuttingModule } from '../production-cutting/production-cutting.module';
import { ProductionSewingModule } from '../production-sewing/production-sewing.module';
import { ProductionFinishingModule } from '../production-finishing/production-finishing.module';
import { Module } from '@nestjs/common';
import { WorkReportsController } from './work-reports.controller';
import { WorkReportsService } from './work-reports.service';
import { WorkReportSettingsService } from './work-report-settings.service';
import { ProductionPurchaseModule } from '../production-purchase/production-purchase.module';
@Module({ imports: [ProductionPurchaseModule, ProductionCuttingModule, ProductionSewingModule, ProductionFinishingModule], controllers: [WorkReportsController], providers: [WorkReportsService, WorkReportSettingsService] })
export class WorkReportsModule {}
