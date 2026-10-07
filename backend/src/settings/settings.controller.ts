import { Body, Controller, Delete, Get, Param, ParseArrayPipe, Post, Put, Query } from '@nestjs/common';
import { AdminOnly } from '../common/decorators.js';
import { ParseObjectIdPipe } from '../common/parse-object-id.pipe.js';
import { FeePlanDto, SeatDto, SeatRangeDto, TimingDto, UpdateSettingsDto } from './settings.dto.js';
import { SettingsService } from './settings.service.js';

@Controller()
export class SettingsController {
  constructor(private readonly settings: SettingsService) {}

  @Get('settings')
  get() {
    return this.settings.get();
  }

  @AdminOnly()
  @Put('settings')
  update(@Body() dto: UpdateSettingsDto) {
    return this.settings.update(dto);
  }

  // ---- Timings ----
  @Get('timings')
  listTimings(@Query('active') active?: string) {
    return this.settings.listTimings(active === 'true');
  }

  @AdminOnly()
  @Post('timings')
  createTiming(@Body() dto: TimingDto) {
    return this.settings.createTiming(dto);
  }

  @AdminOnly()
  @Put('timings/:id')
  updateTiming(@Param('id', ParseObjectIdPipe) id: string, @Body() dto: TimingDto) {
    return this.settings.updateTiming(id, dto);
  }

  @AdminOnly()
  @Delete('timings/:id')
  deleteTiming(@Param('id', ParseObjectIdPipe) id: string) {
    return this.settings.deleteTiming(id);
  }

  // ---- Seats ----
  @Get('seats')
  listSeats() {
    return this.settings.listSeats();
  }

  @Get('seats/available')
  availableSeats(@Query('exceptStudent') exceptStudent?: string, @Query('timing') timing?: string) {
    return this.settings.availableSeats(exceptStudent || undefined, timing || undefined);
  }

  @AdminOnly()
  @Post('seats')
  createSeat(@Body() dto: SeatDto) {
    return this.settings.createSeat(dto);
  }

  @AdminOnly()
  @Post('seats/range')
  createSeatRange(@Body() dto: SeatRangeDto) {
    return this.settings.createSeatRange(dto);
  }

  @AdminOnly()
  @Put('seats/:id')
  updateSeat(@Param('id', ParseObjectIdPipe) id: string, @Body() dto: SeatDto) {
    return this.settings.updateSeat(id, dto);
  }

  @AdminOnly()
  @Delete('seats/:id')
  deleteSeat(@Param('id', ParseObjectIdPipe) id: string) {
    return this.settings.deleteSeat(id);
  }

  // ---- Fee plans ----
  @Get('fee-plans')
  listFeePlans() {
    return this.settings.listFeePlans();
  }

  @AdminOnly()
  @Put('fee-plans')
  updateFeePlans(@Body(new ParseArrayPipe({ items: FeePlanDto })) plans: FeePlanDto[]) {
    return this.settings.updateFeePlans(plans);
  }
}
