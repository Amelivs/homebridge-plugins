import { Netatmo } from './netatmo';


const homeId = '';
const authInfo = {
  clientId: '',
  clientSecret: '',
  refreshToken: '',
};

const netatmo = new Netatmo(authInfo, homeId);
netatmo.isAwayMode('289466472')
  .then(f => {
    const gf = 0;
  })
  .catch(err => {
    const f = 0;
  });
