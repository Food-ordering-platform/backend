import { Request, Response, NextFunction } from "express";

export const captureRawBody = (req: Request, res: Response, buf: Buffer) => {
  (req as any).rawBody = buf.toString();
};
