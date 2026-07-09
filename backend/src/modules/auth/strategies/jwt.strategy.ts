import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../../../common/services/prisma.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly prisma: PrismaService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET || 'fallback-secret-for-jwt',
    });
  }

  async validate(payload: { sub: string; email: string }) {
    const admin = await this.prisma.admin.findUnique({
      where: { id: payload.sub },
      include: { company: true },
    });
    if (!admin) {
      throw new UnauthorizedException('Admin account not found');
    }
    return admin;
  }
}
