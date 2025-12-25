// src/tag/tag.controller.ts
import { Controller, Get, Query } from '@nestjs/common';
import { TagService } from './tag.service';


@Controller('tag')
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

  @Get('summary')
  getSummary(){
    return this.tagService.getDashboardSummary();
  }

  @Get('present')
  getPresent(){
    return this.tagService.getPresentTags();
  }

  @Get('timeline')
  getTimeline(@Query('limit') limit?: string){
    return this.tagService.getInOutTimeline(limit ? Number(limit) : 50);
  }
}
