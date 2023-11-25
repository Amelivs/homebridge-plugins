import { Netatmo } from './netatmo';


const homeId = '';
const authInfo = {
  clientId: '',
  clientSecret: '',
  refreshToken: '',
};

const netatmo = new Netatmo(authInfo, homeId);
netatmo.isAway()
  .then(f => {
    const gf = 0;
  })
  .catch(err => {
    const f = 0;
  });
