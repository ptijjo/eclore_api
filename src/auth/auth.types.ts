export type AuthTokens = {
  accessToken: string;
  refreshToken: string;
};

export type AuthSessionView = {
  sessionId: string;
  createdAt: string;
  lastSeenAt: string;
  userAgent?: string;
};

export type JwtAccessPayload = {
  sub: string;
  sid: string;
};

export type AuthenticatedRequestUser = {
  userId: string;
  sessionId: string;
  role: string;
  status: string;
};

export type RegisterResult = {
  id: string;
  email: string;
  pseudonym: string;
  message: string;
};
