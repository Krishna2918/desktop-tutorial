import { ApiProperty } from '@nestjs/swagger';

export class AuthResponseDto {
  @ApiProperty({
    description: 'Access token (JWT)',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  })
  accessToken: string;

  @ApiProperty({
    description: 'Refresh token (JWT)',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  })
  refreshToken: string;

  @ApiProperty({
    description: 'Access token expiry time in seconds',
    example: 900,
  })
  expiresIn: number;

  @ApiProperty({
    description: 'User information',
  })
  user: {
    id: string;
    email: string;
    displayName?: string;
    avatarUrl?: string;
    emailVerified: boolean;
  };

  @ApiProperty({
    description: 'Device information',
  })
  device: {
    id: string;
    deviceName: string;
    deviceType: string;
  };
}
