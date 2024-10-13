import { LocalStorage } from 'node-localstorage';
import { Netatmo } from './netatmo';

const localStorage = new LocalStorage('./storage');

const homeId = '';
const clientId = '';
const clientSecret = '';
const refreshToken = localStorage.getItem('refreshToken') ?? '';

const netatmo = new Netatmo(clientId, clientSecret, refreshToken, homeId, (token) => {
  console.log('new token', token);
  localStorage.setItem('refreshToken', token);
});

netatmo.isAway()
  .then(f => {
    const gf = 0;
  })
  .catch(err => {
    const f = 0;
  });
