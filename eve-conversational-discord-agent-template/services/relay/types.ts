export interface GatewayCheckpoint {
  readonly sequence?: number;
  readonly sessionId?: string;
  readonly resumeGatewayUrl?: string;
}

export interface GatewayStepResult extends GatewayCheckpoint {
  readonly outcome:
    | "completed"
    | "reconnect"
    | "invalid-session"
    | "delivery-backpressure"
    | "delivery-failed"
    | "closed"
    | "not-configured";
  readonly forwarded: number;
  readonly lastEventAt?: string;
  readonly closeCode?: number;
  readonly closeReason?: string;
  readonly retryAfterMs?: number;
}

export interface RelayStatus {
  readonly configured: boolean;
  readonly forwardAuthConfigured: boolean;
  readonly environment: string;
  readonly gatewayRunMs: number;
}
