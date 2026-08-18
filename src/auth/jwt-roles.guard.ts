/**
 * JWT Roles Guard - validates Bearer JWT and enforces roles from payload.roles.
 */

import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import { ROLES_KEY, PUBLIC_KEY } from './roles.decorator';
import { verifyAuthToken } from './jwt-verifier';

export type AuthenticatedSupplierUser = {
  sub: string;
  email?: string;
  roles: string[];
};

export type AuthenticatedSupplierRequest = Request & { user?: AuthenticatedSupplierUser };

@Injectable()
export class JwtRolesGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private jwtService: JwtService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const rolesMetadata = this.reflector.getAllAndOverride<{ roles: string[] }>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    const requiredRoles = rolesMetadata?.roles?.length ? rolesMetadata.roles : this.getDefaultRoles();

    const request = context.switchToHttp().getRequest<Request>();
    const authHeader = request.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing or invalid Authorization header');
    }

    const token = authHeader.slice(7);
    try {
      // TASK-KEY-F3: accepts RS256 (auth's published key) and HS256 (the shared secret)
      // while the migration runs. See jwt-verifier.ts for the sequencing.
      const payload = await verifyAuthToken(token);
      const userRoles: string[] = Array.isArray(payload.roles) ? payload.roles : [];

      const hasRole = requiredRoles.includes('authenticated') || requiredRoles.some((r) => userRoles.includes(r));
      if (!hasRole) {
        throw new ForbiddenException('Insufficient permissions');
      }

      (request as AuthenticatedSupplierRequest).user = {
        sub: payload.sub,
        email: payload.email,
        roles: userRoles,
      };
      return true;
    } catch (err) {
      if (err instanceof UnauthorizedException || err instanceof ForbiddenException) throw err;
      throw new UnauthorizedException('Invalid token');
    }
  }

  private getDefaultRoles(): string[] {
    const name = process.env.SERVICE_NAME || 'suppliers-microservice';
    return ['authenticated', `global:superadmin`, `internal:${name}:admin`];
  }
}
