import { Logger } from 'homebridge';
import fetch, { RequestInfo, RequestInit, Response } from 'node-fetch';
import { URLSearchParams } from 'url';


export class Netatmo {

  private accessToken: string | undefined;

  private async authenticatedFetch(url: RequestInfo, init?: RequestInit | undefined, retryCount = 0): Promise<Response> {
    if (this.accessToken == null) {
      this.log?.info('Authenticating with refresh token:', this.refreshToken);
      const { access_token, refresh_token } = await this.authenticate();
      this.accessToken = access_token;
      this.refreshToken = refresh_token;
      this.tokenRefreshed(refresh_token);
      this.log?.info('Authentication successfull.');
    }

    const authorization = { Authorization: `Bearer ${this.accessToken}` };
    const response = await fetch(url, { ...init, headers: { ...init?.headers, ...authorization } });

    if (!response.ok) {
      this.log?.error(`HTTP ${init?.method ?? 'GET'} ${url} responded ${response.status}`);
    }

    if (response.status === 403 && retryCount === 0) {
      this.accessToken = undefined;
      return this.authenticatedFetch(url, init, retryCount + 1);
    }

    return response;
  }

  private async authenticate() {
    const body = new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: this.clientId,
      client_secret: this.clientSecret,
      refresh_token: this.refreshToken ?? '',
    });

    const res = await fetch('https://api.netatmo.com/oauth2/token', {
      method: 'POST',
      headers: {
        'Host': 'api.netatmo.com',
        'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
      },
      body,
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(text);
    }

    return await res.json() as AuthenticationResult;
  }

  constructor(
    private readonly clientId: string,
    private readonly clientSecret: string,
    private refreshToken: string,
    private readonly homeId: string,
    private readonly tokenRefreshed: (refreshToken: string) => void,
    private readonly log?: Logger) { }

  public async isAway() {
    const params = new URLSearchParams({
      'home_id': this.homeId,
    });
    const res = await this.authenticatedFetch(`https://api.netatmo.com/api/homestatus?${params.toString()}`, { method: 'GET' });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(text);
    }
    const result: HomeStatusResult = await res.json();
    const rooms = result.body?.home?.rooms ?? [];
    return rooms.some(r => r.therm_setpoint_mode.includes('away'));
  }

  public async setAway(away: boolean) {
    const params = new URLSearchParams({
      'home_id': this.homeId,
      'mode': away ? 'away' : 'schedule',
    });
    const res = await this.authenticatedFetch(`https://api.netatmo.com/api/setthermmode?${params.toString()}`, { method: 'POST' });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(text);
    }
  }
}

type AuthenticationResult = {
  access_token: string;
  refresh_token: string;
};

type HomeStatusResult = {
  body: {
    home: {
      rooms: Array<{
        id: number;
        therm_setpoint_mode: string;
      }>;
    };
  };
};
