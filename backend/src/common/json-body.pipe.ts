import { BadRequestException, Injectable, ValidationPipe, type PipeTransform, type Type } from '@nestjs/common';

/**
 * For multipart requests: parses the JSON in the `data` field and validates it
 * against a DTO class exactly like a normal JSON body.
 */
@Injectable()
export class JsonBodyPipe<T> implements PipeTransform<string, Promise<T>> {
  private readonly validation = new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  });

  constructor(private readonly dto: Type<T>) {}

  async transform(value: string): Promise<T> {
    let parsed: unknown;
    try {
      parsed = JSON.parse(value ?? '');
    } catch {
      throw new BadRequestException('Invalid form data');
    }
    return this.validation.transform(parsed, { type: 'body', metatype: this.dto });
  }
}
