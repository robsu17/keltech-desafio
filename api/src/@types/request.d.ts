/// <reference types="multer" />
import type { TokenPayload } from '../modules/authentication/types/token-payload';

declare global {
  namespace Express {
    interface Request {
      user?: TokenPayload;
    }
  }
}

export {};
