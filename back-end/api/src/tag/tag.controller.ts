import { Controller, Get } from '@nestjs/common';
import { TagService } from './tag.service';
import { count } from 'console';

@Controller('tags')
export class TagController {
  constructor(private readonly tagService: TagService) {}

  @Get('active')
  async getActive() {
    const tags = await this.tagService.getActiveTags();

    return{
      count: tags.length,
      tags
    };
  }

  @Get('events')
  getEvents() {
    return this.tagService.getEvents();
  }
}
