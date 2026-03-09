import { SetMetadata } from '@nestjs/common';

export const REQUIRE_PERMISSION = 'require_permission';

/**
 * 可传 route_path 或 permission code，守卫会校验当前用户是否拥有该权限。
 * 若传数组，则拥有其中任一权限即通过。
 */
export const RequirePermission = (routeOrCode: string | string[]) =>
  SetMetadata(REQUIRE_PERMISSION, routeOrCode);
