import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, IsNotEmpty } from 'class-validator';

export class LoginDto {
  @ApiProperty({
    description: 'User email address',
    example: 'user@example.com',
  })
  @IsEmail({}, { message: 'Invalid email address' })
  @IsNotEmpty({ message: 'Email is required' })
  email: string;

  @ApiProperty({
    description: 'User password',
    example: 'SecureP@ssw0rd123',
  })
  @IsString()
  @IsNotEmpty({ message: 'Password is required' })
  password: string;

  @ApiProperty({
    description: 'Device information',
    example: {
      deviceName: 'iPhone 14 Pro',
      deviceType: 'ios',
      osVersion: '17.2',
      appVersion: '0.1.0',
    },
  })
  @IsNotEmpty({ message: 'Device information is required' })
  deviceInfo: {
    deviceName: string;
    deviceType: 'ios' | 'android' | 'macos' | 'windows';
    osVersion: string;
    appVersion: string;
    deviceModel?: string;
    uniqueIdentifier: string;
    publicKey: string;
    capabilities: {
      biometric: boolean;
      clipboard: boolean;
      files: boolean;
      remoteControl: boolean;
      contacts: boolean;
      screenShare: boolean;
    };
  };
}
