import { Logger } from 'homebridge';
import NodeCache from 'node-cache';
import fetch from 'node-fetch';
import { URLSearchParams } from 'url';

export interface AuthInfo {
  readonly clientId: string;
  readonly clientSecret: string;
  readonly refreshToken: string;
}

export class Netatmo {

  private readonly cache = new NodeCache({ stdTTL: 3600 * 3, checkperiod: 3600 * 3 * 0.2, useClones: false });

  private async authenticate() {
    const token = this.cache.get<string>('token');
    if (token) {
      return token;
    }

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

    const data = await res.json();
    const newToken = data.access_token as string;
    this.log?.info('Authentication Ok: ', newToken);

    this.cache.set('token', newToken);

    return newToken;
  }

  private async getTemperature(roomId: string, token: string) {
    const roomMeasureParams = new URLSearchParams({
      'home_id': this.homeId,
      'room_id': roomId,
      'scale': '30min',
      'type': 'temperature',
      'date_end': 'last',
      'optimize': 'false',
      'real_time': 'false',
      'lower_access_level': '0',
    });
    const res = await fetch(`https://api.netatmo.com/api/getroommeasure?${roomMeasureParams.toString()}`,
      {
        method: 'GET',
        headers: { Authorization: `Bearer ${token}` },
      });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(text);
    }
    const data = await res.json();
    return data.body[Object.keys(data.body)[0]][0] as number;
  }

  private async setTemperature(roomId: string, temperature: number, token: string) {
    const setTempParams = new URLSearchParams({
      'home_id': this.homeId,
      'room_id': roomId,
      'mode': 'manual',
      'temp': temperature.toString(),
      'endtime': (Math.floor(Date.now() / 1000) + 60 * 30).toString(),
    });
    const res = await fetch(`https://api.netatmo.com/api/setroomthermpoint?${setTempParams.toString()}`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(text);
    }
    return await res.json();
  }

  private async getMode(roomId: string, token: string) {
    const params = new URLSearchParams({
      'home_id': this.homeId,
    });
    const res = await fetch(`https://api.netatmo.com/api/homestatus?${params.toString()}`,
      {
        method: 'GET',
        headers: { Authorization: `Bearer ${token}` },
      });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(text);
    }
    const result = await res.json();

    const rooms = result.body?.home?.rooms as any[];
    const room = rooms?.find(r => r.id === roomId);
    return room?.therm_setpoint_mode as string;
  }

  private async setMode(mode: string, token: string) {
    const params = new URLSearchParams({
      'home_id': this.homeId,
      'mode': mode,
    });
    const res = await fetch(`https://api.netatmo.com/api/setthermmode?${params.toString()}`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(text);
    }
  }

  constructor(private authInfo: AuthInfo, private readonly homeId = '5bff18550f21e196648b4826', private log?: Logger) { }

  async boostTemperature(roomId = '3627429255', boost = 0.5) {
    const token = await this.authenticate();
    const currentTemp = await this.getTemperature(roomId, token);
    this.log?.info('Current Temp: ', currentTemp);

    const newTemp = (Math.round(currentTemp * 2) / 2) + boost;

    await this.setTemperature(roomId, newTemp, token);
    this.log?.info('New Temp set: ', newTemp);
  }

  async setAwayMode() {
    const token = await this.authenticate();
    await this.setMode('away', token);
  }

  async setScheduleMode() {
    const token = await this.authenticate();
    await this.setMode('schedule', token);
  }

  async isAwayMode(roomId: string) {
    const token = await this.authenticate();
    const mode = await this.getMode(roomId, token);
    return mode === 'away';
  }
}
