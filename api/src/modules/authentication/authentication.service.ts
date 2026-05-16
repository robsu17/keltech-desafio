import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { compare } from 'bcryptjs';
import { PrismaService } from '../../prisma/prisma.service';
import type { TokenPayload } from './types/token-payload';
import type { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthenticationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async login({ email, password }: LoginDto) {
    const user = await this.prisma.user.findUnique({ where: { email } });

    if (!user) throw new UnauthorizedException('Credenciais inválidas');

    const passwordMatch = await compare(password, user.passwordHash);
    if (!passwordMatch) throw new UnauthorizedException('Credenciais inválidas');

    const payload: TokenPayload = { sub: user.id, role: user.role };
    const accessToken = await this.jwtService.signAsync(payload);

    return { accessToken };
  }
}
