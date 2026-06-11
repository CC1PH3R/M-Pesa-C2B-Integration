import axios, { AxiosError } from 'axios';
import prisma from '../lib/prisma';
import mpesaConfig from '../config/mpesa';
import { createLogger } from '../lib/logger';

const log = createLogger('auth');

class AuthService {
  async getAccessToken(): Promise<string> {
    try {
      const bufferTime = new Date(Date.now() + 5 * 60 * 1000);

      const cachedToken = await prisma.accessToken.findFirst({
        where: { expiresAt: { gt: bufferTime } },
        orderBy: { createdAt: 'desc' },
      });

      if (cachedToken) {
        const timeRemaining = Math.floor(
          (cachedToken.expiresAt.getTime() - Date.now()) / 1000,
        );
        log.info({ expiresAt: cachedToken.expiresAt.toISOString(), remainingSecs: timeRemaining }, 'Using cached access token');
        return cachedToken.token;
      }

      log.info('Generating new access token');
      await prisma.accessToken.deleteMany({});

      const auth = Buffer.from(
        `${mpesaConfig.consumerKey}:${mpesaConfig.consumerSecret}`,
      ).toString('base64');

      log.info({ url: `${mpesaConfig.baseURL}${mpesaConfig.endpoints.auth}` }, 'Making auth request');

      const response = await axios.get<{ access_token: string; expires_in: number }>(
        `${mpesaConfig.baseURL}${mpesaConfig.endpoints.auth}`,
        {
          headers: {
            Authorization: `Basic ${auth}`,
            'Content-Type': 'application/json',
          },
          timeout: 30000,
        },
      );

      log.info({ status: response.status, expiresIn: response.data.expires_in }, 'Auth response received');

      const { access_token, expires_in } = response.data;

      if (!access_token) {
        throw new Error('No access token in response');
      }

      const expiresAt = new Date(Date.now() + (expires_in - 300) * 1000);

      await prisma.accessToken.create({
        data: { token: access_token, expiresAt },
      });

      log.info({ expiresAt: expiresAt.toISOString() }, 'Access token generated and cached');
      return access_token;
    } catch (error) {
      const axiosError = error as AxiosError;
      log.error({ err: axiosError, mpesaError: axiosError.response?.data }, 'Failed to get access token');
      throw new Error(`M-Pesa auth failed: ${axiosError.message}`);
    }
  }

  async clearCachedTokens(): Promise<void> {
    await prisma.accessToken.deleteMany({});
  }
}

export default new AuthService();
