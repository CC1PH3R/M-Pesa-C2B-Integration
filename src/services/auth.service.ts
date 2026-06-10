import axios, { AxiosError } from 'axios';
import prisma from '../lib/prisma';
import mpesaConfig from '../config/mpesa';

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
        console.log('Using cached access token', cachedToken.expiresAt.toISOString(), `${timeRemaining}s remaining`);
        return cachedToken.token;
      }

      console.log('Generating new access token');
      await prisma.accessToken.deleteMany({});

      const auth = Buffer.from(
        `${mpesaConfig.consumerKey}:${mpesaConfig.consumerSecret}`,
      ).toString('base64');

      console.log('Making auth request', `${mpesaConfig.baseURL}${mpesaConfig.endpoints.auth}`);

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

      console.log('Auth response received', response.status, `expires_in=${response.data.expires_in}`);

      const { access_token, expires_in } = response.data;

      if (!access_token) {
        throw new Error('No access token in response');
      }

      const expiresAt = new Date(Date.now() + (expires_in - 300) * 1000);

      await prisma.accessToken.create({
        data: { token: access_token, expiresAt },
      });

      console.log('Access token generated and cached, expires at', expiresAt.toISOString());
      return access_token;
    } catch (error) {
      const axiosError = error as AxiosError;
      console.error('Failed to get access token', axiosError.message, axiosError.response?.data);
      throw new Error(`M-Pesa auth failed: ${axiosError.message}`);
    }
  }

  async clearCachedTokens(): Promise<void> {
    await prisma.accessToken.deleteMany({});
  }
}

export default new AuthService();
