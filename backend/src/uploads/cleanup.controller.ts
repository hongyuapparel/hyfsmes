import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AdminRoleGuard } from '../auth/admin-role.guard';
import { UploadCleanupService } from './cleanup.service';
import { DeleteOrphansDto } from './dto/delete-orphans.dto';

@Controller('uploads/cleanup')
@UseGuards(JwtAuthGuard, AdminRoleGuard)
export class UploadCleanupController {
  constructor(private readonly cleanupService: UploadCleanupService) {}

  @Post('scan')
  scan() {
    return this.cleanupService.scanOrphans();
  }

  @Post('delete')
  delete(@Body() dto: DeleteOrphansDto) {
    return this.cleanupService.deleteOrphans(dto.filenames);
  }
}
