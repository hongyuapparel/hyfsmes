import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { User } from '../entities/user.entity';

export interface JwtPayload {
  sub: number;
  username: string;
  roleId?: number;
  roleIds?: number[];
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    @InjectRepository(User)
    private userRepo: Repository<User>,
    private configService: ConfigService,
  ) {
    const secret = configService.get<string>('JWT_SECRET') ?? process.env.JWT_SECRET ?? 'dev_secret_123456';
    if (process.env.NODE_ENV === 'production' && (secret === 'dev_secret_123456' || !secret)) {
      throw new Error('生产环境必须配置 JWT_SECRET 环境变量，且不能使用默认值 dev_secret_123456');
    }
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret,
    })
  }

  async validate(payload: JwtPayload): Promise<{ userId: number; username: string }> {
    if (process.env.NODE_ENV !== 'production') {
      // 仅在开发环境打印 payload，便于调试 JWT
      // 不打印完整 token
      // eslint-disable-next-line no-console
      console.log('[JwtStrategy] validate payload:', {
        sub: payload.sub,
        username: payload.username,
        roleId: payload.roleId,
        roleIds: payload.roleIds,
      });
    }
    const user = await this.userRepo.findOne({ where: { id: payload.sub } });
    if (!user) throw new UnauthorizedException();
    return { userId: user.id, username: user.username };
  }
}
