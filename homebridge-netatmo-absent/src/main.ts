import { Netatmo } from './netatmo';


const homeId = '';
const authInfo = {
  clientId: '',
  clientSecret: '',
};

const netatmo = new Netatmo(authInfo, homeId, (token) => {
  console.log('new token', token);
});

netatmo.currentRefreshToken = '';

netatmo.isAway()
  .then(f => {
    const gf = 0;
  })
  .catch(err => {
    const f = 0;
  });
