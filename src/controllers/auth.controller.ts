import { Request, Response } from 'express';
import { AxiosError } from 'axios';
import authService from '../services/auth.service';

class AuthController {
  async health(_req: Request, res: Response): Promise<Response> {
    return res.status(200).json({
      success: true,
      message: 'M-Pesa C2B API is running',
      timestamp: new Date().toISOString(),
    });
  }

  async testAuth(_req: Request, res: Response): Promise<Response> {
    try {
      console.log('Testing authentication');

      await authService.clearCachedTokens();
      console.log('Cleared cached tokens');

      const token = await authService.getAccessToken();

      return res.status(200).json({
        success: true,
        message: 'Authentication successful',
        tokenInfo: {
          length: token.length,
          prefix: token.substring(0, 20) + '...',
        },
      });
    } catch (error) {
      const axiosError = error as AxiosError<Record<string, unknown>>;
      console.error('Test auth failed', error);

      return res.status(500).json({
        success: false,
        message: 'Authentication failed',
        error: axiosError.message,
        details: axiosError.response?.data,
      });
    }
  }
}

export default new AuthController();
