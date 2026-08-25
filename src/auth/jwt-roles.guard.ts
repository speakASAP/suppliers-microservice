/**
 * JWT Roles Guard - validates Bearer JWT and enforces roles from payload.roles.
 */

import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  ForbiddenException, Logger } from '@nestjs/common';
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
  private readonly logger = new Logger(JwtRolesGuard.name);

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
    // Deny by default. The previous fallback was
    // ['authenticated', 'global:superadmin', 'internal:suppliers-microservice:admin'],
    // and 'authenticated' matches any valid token in the ecosystem — so every
    // undecorated route here, supplier creation and import runs included, was
    // reachable by any caller holding any credential. An omission is now a 403.
    const requiredRoles = rolesMetadata?.roles?.length ? rolesMetadata.roles : null;
    if (!requiredRoles) {
      const handler = `${context.getClass().name}.${context.getHandler().name}`;
      this.logger.error(
        `Route ${handler} has neither @Roles nor @Public; denying. Add an explicit policy.`,
      );
      throw new ForbiddenException('Route is missing an authorization policy');
    }

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

}
