import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { FinanceControlController } from './finance-control.controller';
import { FinanceControlService } from './finance-control.service';
import { FinanceLedgerService } from './finance-ledger.service';

@Module({ imports: [AuthModule], controllers: [FinanceControlController], providers: [FinanceControlService, FinanceLedgerService], exports: [FinanceControlService, FinanceLedgerService] })
export class FinanceControlModule {}
