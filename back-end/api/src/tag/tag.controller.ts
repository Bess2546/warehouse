// src/tag/tag.controller.ts
import { Controller, Get, Query, UseGuards} from '@nestjs/common';
import { TagService } from './tag.service';
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { CurrentUser } from "../auth/decorators";


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
  getPresent(@Query('orgId') orgId?: string){
    const orgIdNum = orgId ? parseInt(orgId, 10) : undefined;
    return this.tagService.getPresentTags();
  }

  @Get('timeline')
  getTimeline(@Query('limit') limit?: string){
    return this.tagService.getInOutTimeline(limit ? Number(limit) : 50);
  }

  @Get('list')
  @UseGuards(JwtAuthGuard)
  async getList(@CurrentUser() userInfo:any) {
    const orgId = userInfo.role === 'user' ? userInfo.organizationId : undefined;
    return this.tagService.getAllTags(orgId);
  }
}
