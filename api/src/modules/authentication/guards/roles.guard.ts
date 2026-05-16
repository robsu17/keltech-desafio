import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import type { Role } from '../../../../generated/prisma/enums';
import { ROLES_KEY } from '../decorators/roles.decorator';
import type { TokenPayload } from '../types/token-payload';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) return true;

    const request = context
      .switchToHttp()
      .getRequest<Request & { user?: TokenPayload }>();

    if (!request.user) {
      throw new ForbiddenException('Usuário não autenticado');
    }

    if (!requiredRoles.includes(request.user.role)) {
      throw new ForbiddenException('Acesso negado para este cargo');
    }

    return true;
  }
}
