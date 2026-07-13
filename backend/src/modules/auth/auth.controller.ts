import { Controller, Post, Get, Body, UseGuards, Req } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { AdminGuard } from './guards/jwt-auth.guard';
import type { Request } from 'express';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('login')
  async login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  @UseGuards(AdminGuard)
  @Get('me')
  async me(@Req() req: any) {
    const admin = req.user as any;
    if (!admin) {
      return null;
    }
    const { passwordHash, ...profile } = admin;
    return profile;
  }

  @UseGuards(AdminGuard)
  @Get('users')
  async getAllUsers() {
    return this.authService.getAllUsers();
  }
}
