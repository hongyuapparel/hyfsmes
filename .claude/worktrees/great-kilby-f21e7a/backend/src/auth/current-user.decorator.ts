import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const CurrentUserId = createParamDecorator((_: unknown, ctx: ExecutionContext): number => {
  const request = ctx.switchToHttp().getRequest();
  const user = request.user as { userId: number };
  return user?.userId;
});

export const CurrentUser = createParamDecorator((_: unknown, ctx: ExecutionContext) => {
  const request = ctx.switchToHttp().getRequest();
  return request.user;
});
