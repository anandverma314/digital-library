import { Controller, Get, Query } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { FEE_PLANS, FEE_STATUSES, feeStatusFilter } from '../common/fees.js';
import { Student } from '../models/student.schema.js';
import { SettingsService } from '../settings/settings.service.js';
import { StudentListQuery } from '../students/students.dto.js';
import { StudentsService } from '../students/students.service.js';

@Controller('fees')
export class FeesController {
  constructor(
    private readonly studentsService: StudentsService,
    private readonly settings: SettingsService,
    @InjectModel(Student.name) private readonly students: Model<Student>,
  ) {}

  /** Fee list of active students (same filters as /students, sorted by due date by default). */
  @Get()
  list(@Query() q: StudentListQuery) {
    return this.studentsService.list({
      ...q,
      status: 'active',
      sort: q.sort === 'createdAt' ? 'nextDueDate' : q.sort,
    });
  }

  /** Counts for the filter chips. */
  @Get('summary')
  async summary() {
    const { dueReminderDays } = await this.settings.get();
    const active = { status: 'active' as const };
    const [all, ...rest] = await Promise.all([
      this.students.countDocuments(active),
      ...FEE_STATUSES.map((s) => this.students.countDocuments({ ...active, ...feeStatusFilter(s, dueReminderDays) })),
      ...FEE_PLANS.map((p) => this.students.countDocuments({ ...active, feePlan: p })),
    ]);
    const byStatus = Object.fromEntries(FEE_STATUSES.map((s, i) => [s, rest[i]]));
    const byPlan = Object.fromEntries(FEE_PLANS.map((p, i) => [p, rest[FEE_STATUSES.length + i]]));
    return { all, byStatus, byPlan, dueReminderDays };
  }
}
