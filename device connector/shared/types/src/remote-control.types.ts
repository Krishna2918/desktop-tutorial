/**
 * Remote control session types
 */

export type SessionMode = 'view_only' | 'view_and_control';
export type RemoteSessionStatus = 'pending' | 'active' | 'ended' | 'denied' | 'failed';
export type ConnectionType = 'p2p' | 'relayed';

export interface QualitySettings {
  resolution: string;
  fps: number;
  bitrate: number;
  codec: string;
}

export interface RemoteControlSession {
  id: string;
  userId: string;
  controllerDeviceId: string;
  controlledDeviceId: string;
  sessionMode: SessionMode;
  sessionStatus: RemoteSessionStatus;
  connectionType?: ConnectionType;
  webrtcOffer?: string;
  webrtcAnswer?: string;
  iceCandidates: RTCIceCandidateInit[];
  qualitySettings: QualitySettings;
  requestedAt: Date;
  approvedAt?: Date;
  startedAt?: Date;
  endedAt?: Date;
  durationSeconds?: number;
  endReason?: string;
  errorMessage?: string;
}

export interface RequestRemoteControlDto {
  targetDeviceId: string;
  mode: SessionMode;
  qualitySettings?: Partial<QualitySettings>;
}

export interface ApproveRemoteControlDto {
  sessionId: string;
  biometricVerified: boolean;
}

export interface DenyRemoteControlDto {
  sessionId: string;
  reason?: string;
}

export interface WebRTCSignalingMessage {
  sessionId: string;
  type: 'offer' | 'answer' | 'ice-candidate';
  data: any;
}

export interface RemoteControlInput {
  sessionId: string;
  type: 'mouse' | 'keyboard' | 'touch';
  data: MouseInput | KeyboardInput | TouchInput;
}

export interface MouseInput {
  x: number;
  y: number;
  button?: 'left' | 'right' | 'middle';
  action: 'move' | 'down' | 'up' | 'scroll';
  scrollDelta?: { x: number; y: number };
}

export interface KeyboardInput {
  key: string;
  action: 'down' | 'up';
  modifiers?: {
    ctrl?: boolean;
    shift?: boolean;
    alt?: boolean;
    meta?: boolean;
  };
}

export interface TouchInput {
  x: number;
  y: number;
  action: 'start' | 'move' | 'end';
  touchId: number;
}
