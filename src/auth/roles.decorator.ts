/**
 * Roles decorator - required roles for endpoint (OR logic).
 */

import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';
export const Public = () => SetMetadata('public', true);
export const PUBLIC_KEY = 'public';

export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, { roles });
