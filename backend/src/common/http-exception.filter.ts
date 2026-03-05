import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';
import { Request } from 'express';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();

    const isHttp = exception instanceof HttpException;
    const status = isHttp ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    let msg: string;
    if (isHttp) {
      const body = exception.getResponse();
      if (typeof body === 'string') msg = body;
      else if (typeof body === 'object' && body !== null && 'message' in body) {
        const m = (body as { message?: string | string[] }).message;
        msg = Array.isArray(m) ? (m[0] ?? '请求失败') : (m ?? '请求失败');
      } else msg = '请求失败';
    } else {
      msg = exception instanceof Error ? exception.message : '服务器内部错误';
    }
    if (status >= 500) {
      this.logger.error(`${req.method} ${req.url} ${status}`, exception instanceof Error ? exception.stack : String(exception));
    }

    res.status(status).json({
      statusCode: status,
      message: msg,
    });
  }
}
