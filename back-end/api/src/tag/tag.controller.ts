import { Controller, Get } from '@nestjs/common';
import { TagService } from './tag.service';

@Controller('tags')
export class TagController {
  constructor(private readonly tagService: TagService) {}

  @Get('active')
  getActiveTags() {
    return this.tagService.getActiveTags();
  }

  @Get('events')
  getEvents() {
    return this.tagService.getEvents();
  }
}
