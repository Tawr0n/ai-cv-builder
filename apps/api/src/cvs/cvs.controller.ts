import type { CvList, User } from '@ai-cv-builder/shared';
import { Controller, Get } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { CvsService } from './cvs.service.js';

@Controller('cvs')
export class CvsController {
  constructor(private readonly cvs: CvsService) {}

  @Get()
  list(@CurrentUser() user: User): Promise<CvList> {
    return this.cvs.list(user.id);
  }
}
