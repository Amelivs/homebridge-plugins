import { Service, PlatformAccessory, CharacteristicValue } from 'homebridge';

import { NetatmoAbsentHomebridgePlatform } from './platform';
import { Netatmo } from './netatmo';
import NodeCache from 'node-cache';
import { DEVICE } from './settings';


/**
 * Platform Accessory
 * An instance of this class is created for each accessory your platform registers
 * Each accessory may expose multiple services of different service types.
 */
export class NetatmoAbsentPlatformAccessory {

  private readonly netatmo: Netatmo;

  private readonly awayModeCache = new NodeCache({ stdTTL: 120, checkperiod: 0, useClones: false });

  constructor(
    private readonly platform: NetatmoAbsentHomebridgePlatform,
    private readonly accessory: PlatformAccessory,
  ) {

    // set accessory information
    this.accessory.getService(this.platform.Service.AccessoryInformation)!
      .setCharacteristic(this.platform.Characteristic.Manufacturer, DEVICE.manufacturer)
      .setCharacteristic(this.platform.Characteristic.Model, DEVICE.model)
      .setCharacteristic(this.platform.Characteristic.SerialNumber, DEVICE.serialNumber);

    // get the LightBulb service if it exists, otherwise create a new LightBulb service
    // you can create multiple services for each accessory
    // this.service = this.accessory.getService(this.platform.Service.Switch) || this.accessory.addService(this.platform.Service.Switch);

    // set the service name, this is what is displayed as the default name on the Home app
    // in this example we are using the name we stored in the `accessory.context` in the `discoverDevices` method.
    // this.service.setCharacteristic(this.platform.Characteristic.Name, accessory.context.device.exampleDisplayName);

    // each service must implement at-minimum the "required characteristics" for the given service type
    // see https://developers.homebridge.io/#/service/Lightbulb

    // register handlers for the On/Off Characteristic
    // this.service.getCharacteristic(this.platform.Characteristic.On)
    //  .onSet(this.setOn.bind(this))               // SET - bind to the `setOn` method below
    //  .onGet(this.getOn.bind(this));              // GET - bind to the `getOn` method below

    /**
     * Creating multiple services of the same type.
     *
     * To avoid "Cannot add a Service with the same UUID another Service without also defining a unique 'subtype' property." error,
     * when creating multiple services of the same type, you need to use the following syntax to specify a name and subtype id:
     * this.accessory.getService('NAME') || this.accessory.addService(this.platform.Service.Lightbulb, 'NAME', 'USER_DEFINED_SUBTYPE_ID');
     *
     * The USER_DEFINED_SUBTYPE must be unique to the platform accessory (if you platform exposes multiple accessories, each accessory
     * can use the same sub type id.)
     */

    //Absence
    const absentService = this.accessory.getService('Absent') || this.accessory.addService(this.platform.Service.Switch, 'Absent', '7042c1bf-fdad-4b5d-9869-9b7aea10c8b5');
    absentService.setCharacteristic(this.platform.Characteristic.Name, 'Absent');
    absentService.getCharacteristic(this.platform.Characteristic.On)
      .onSet(value => this.setOn(absentService, value))
      .onGet(() => this.getOn(absentService));

    const auth = this.platform.config['auth'];
    const homeId = this.platform.config['homeId'];

    const authInfo = {
      clientId: auth.client_id,
      clientSecret: auth.client_secret,
      refreshToken: auth.refresh_token,
    };

    this.netatmo = new Netatmo(authInfo, homeId, this.platform.log);
  }

  /**
   * Handle "SET" requests from HomeKit
   * These are sent when the user changes the state of an accessory, for example, turning on a Light bulb.
   */
  async setOn(service: Service, value: CharacteristicValue) {
    await this.netatmo.setAway(value === true)
      .then(() => {
        this.platform.log.info('Set Away mode `%s`', value);
        this.awayModeCache.set('mode', !!value);
      })
      .catch(err => {
        this.platform.log.error(err.message);
        throw new this.platform.api.hap.HapStatusError(this.platform.api.hap.HAPStatus.SERVICE_COMMUNICATION_FAILURE);
      });
  }

  /**
   * Handle the "GET" requests from HomeKit
   * These are sent when HomeKit wants to know the current state of the accessory, for example, checking if a Light bulb is on.
   *
   * GET requests should return as fast as possbile. A long delay here will result in
   * HomeKit being unresponsive and a bad user experience in general.
   *
   * If your device takes time to respond you should update the status of your device
   * asynchronously instead using the `updateCharacteristic` method instead.

   * @example
   * this.service.updateCharacteristic(this.platform.Characteristic.On, true)
   */
  getOn(service: Service): CharacteristicValue {
    const isAway = this.awayModeCache.get<boolean>('mode');
    if (isAway != null) {
      this.platform.log.info('Get Away mode `%s` from cache', isAway);
      return isAway;
    }

    this.netatmo.isAway()
      .then(isAway => {
        this.awayModeCache.set('mode', isAway);
        this.platform.log.info('Get Away mode `%s` from API', isAway);
        service.updateCharacteristic(this.platform.Characteristic.On, isAway);
      })
      .catch(err => {
        this.platform.log.error(err.message);
        throw new this.platform.api.hap.HapStatusError(this.platform.api.hap.HAPStatus.SERVICE_COMMUNICATION_FAILURE);
      });

    // if you need to return an error to show the device as "Not Responding" in the Home app:
    // throw new this.platform.api.hap.HapStatusError(this.platform.api.hap.HAPStatus.SERVICE_COMMUNICATION_FAILURE);

    return false;
  }
}
