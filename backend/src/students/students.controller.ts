import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { AdminOnly, CurrentUser, type AuthUser } from '../common/decorators.js';
import { JsonBodyPipe } from '../common/json-body.pipe.js';
import { ParseObjectIdPipe } from '../common/parse-object-id.pipe.js';
import { MAX_PHOTO_BYTES } from './photo-storage.js';
import { CreateStudentDto, StudentListQuery, UpdateStudentDto } from './students.dto.js';
import { StudentsService } from './students.service.js';

// Photos are kept in memory, validated, then written to disk by the service.
// The multipart `data` params are typed Readonly<Dto> so the global ValidationPipe skips the raw
// JSON string (it only checks class metatypes); JsonBodyPipe parses and validates it instead.
const photoUpload = FileInterceptor('photo', { limits: { fileSize: MAX_PHOTO_BYTES, files: 1 } });

@Controller('students')
export class StudentsController {
  constructor(private readonly students: StudentsService) {}

  @Get()
  list(@Query() q: StudentListQuery) {
    return this.students.list(q);
  }

  @Get(':id')
  get(@Param('id', ParseObjectIdPipe) id: string) {
    return this.students.get(id);
  }

  /** multipart/form-data: `data` (JSON of the form fields) + optional `photo` file */
  @Post()
  @UseInterceptors(photoUpload)
  create(
    @Body('data', new JsonBodyPipe(CreateStudentDto)) dto: Readonly<CreateStudentDto>,
    @UploadedFile() photo: Express.Multer.File | undefined,
    @CurrentUser() user: AuthUser,
  ) {
    return this.students.create(dto, photo, user.id);
  }

  @Put(':id')
  @UseInterceptors(photoUpload)
  update(
    @Param('id', ParseObjectIdPipe) id: string,
    @Body('data', new JsonBodyPipe(UpdateStudentDto)) dto: Readonly<UpdateStudentDto>,
    @UploadedFile() photo: Express.Multer.File | undefined,
  ) {
    return this.students.update(id, dto, photo);
  }

  @Patch(':id/deactivate')
  deactivate(@Param('id', ParseObjectIdPipe) id: string) {
    return this.students.setStatus(id, 'inactive');
  }

  @Patch(':id/activate')
  activate(@Param('id', ParseObjectIdPipe) id: string) {
    return this.students.setStatus(id, 'active');
  }

  @AdminOnly()
  @Delete(':id')
  remove(@Param('id', ParseObjectIdPipe) id: string) {
    return this.students.remove(id);
  }

  /** Photos are personal data, so they are only served to signed-in staff. */
  @Get(':id/photo')
  async photo(@Param('id', ParseObjectIdPipe) id: string, @Res() res: Response) {
    const path = await this.students.photoFile(id);
    res.setHeader('Cache-Control', 'private, max-age=86400');
    res.sendFile(path);
  }
}
