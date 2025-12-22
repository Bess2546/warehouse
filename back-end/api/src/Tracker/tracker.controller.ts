//src/tracker/tracker.controller.ts
import { Controller,Get, Post, Body, Query, Param } from "@nestjs/common";
import { TrackerService } from "./tracker.service";
import { get } from "http";
import { count } from "console";

//DTO for adding trackers (matching TMS API)
class TracerExcelNew{
    Serial: string;
    Imie: string;
    Brand?: string;
    Model?: string;
    Description?: string;
    Version?: string;
}

class addBatchTrackersDto{
    trackers: TracerExcelNew[];
}

class AssignOrganizeDto{
    imei:string;
    organizeId:number;
}

@Controller('Tracker')
export class TrackerController{
    constructor(private readonly trackerService:TrackerService){}

    //GET /api/tracker/GetOrganizedByM5?imei=?
    @Get('GetOrganizeByM5')
    async getOrganizeByM5(@Query('imei') imei:string){
        return this.trackerService.getOrganizeByM5(imei);
    }

    //POST /api/Tracker/AddBatchTrackerNew
    @Post('AddBatchTrackerNew')
    async addBatchTrackers(@Body() dto: addBatchTrackersDto){
        const result = await this.trackerService.addBatchTrackers(dto.trackers);
        return result;
    }

    //GET /api/tracker/all
    @Get('all')
    async addAllTrackers(){
        const trackers = await this.trackerService.getAllTrackers();
        return{
            success:true,
            count: trackers.length,
            data: trackers,
        };
    }

    // GET /api/Tracker/byImei?imei=xxx
    @Get('byImei')
    async getTrackerByImei(@Query('imei') imei:string){
        const tracker = await this.trackerService.getTrackerByImei(imei);
    if (!tracker){
            return {seccess: false, message: 'Tracker not found'};
        }
        return { success: true, data: tracker };
    }

    // POST /api/tracker/assign
    @Post('assign')
    async assignToOrganize(@Body() dto: AssignOrganizeDto){
        return this.trackerService.assignToOrganize(dto.imei, dto.organizeId);
    }

    // POST /api/tracker/status
    @Post('status')
    async updateStatus(@Body() dto: {imei: string; status:string}){
        return this.trackerService.updateStatus(
            dto.imei,
            dto.status as 'ACTIVE' | 'INACTIVE' | 'MAINTENANCE' | 'STOCKED'
        );
    }
}