import { Logger } from 'homebridge';
import fetch, { RequestInfo, RequestInit, Response } from 'node-fetch';
import { URLSearchParams } from 'url';


export class Netatmo {

  private authToken: string | undefined;

  private async authenticatedFetch(url: RequestInfo, init?: RequestInit | undefined, retryCount = 0): Promise<Response> {
    if (this.authToken == null) {
      this.log?.info('Requesting an authentication token...');
      this.authToken = await this.refreshToken();
      this.log?.info('Authentication token successfully requested.');
    }

    const authorization = { Authorization: `Bearer ${this.authToken}` };
    const response = await fetch(url, { ...init, headers: { ...init?.headers, ...authorization } });

    if (!response.ok) {
      this.log?.error(`HTTP ${init?.method ?? 'GET'} ${url} responded ${response.status}`);
    }

    if (response.status === 401 && retryCount === 0) {
      this.authToken = undefined;
      return this.authenticatedFetch(url, init, retryCount + 1);
    }

    return response;
  }

  private async refreshToken() {
    const body = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: this.authInfo.refreshToken,
      client_id: this.authInfo.clientId,
      client_secret: this.authInfo.clientSecret,
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

    const result: AuthenticationResult = await res.json();
    const newToken = result.access_token;

    return newToken;
  }

  constructor(
    private readonly authInfo: AuthInfo,
    private readonly homeId: string,
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

export interface AuthInfo {
  readonly clientId: string;
  readonly clientSecret: string;
  readonly refreshToken: string;
}

type AuthenticationResult = {
  access_token: string;
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
