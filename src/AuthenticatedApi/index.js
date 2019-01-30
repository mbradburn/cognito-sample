// This code is mostly liberated from:
// https://github.com/awslabs/aws-support-tools/blob/master/Cognito/decode-verify-jwt/decode-verify-jwt.js

const superagent = require('superagent');
const jose = require('node-jose');

let UserPoolId;
let UserPoolClientId;

// Note that we're fetching the keys for each request, where
// the right way to do it.
exports.handler = async message => {
  UserPoolId = process.env.USER_POOL_ID;
  UserPoolClientId = process.env.USER_POOL_CLIENT_ID;

  const region = process.env.AWS_REGION;

  console.log('region: ', region);

  const keysUrl = `https://cognito-idp.${region}.amazonaws.com/${UserPoolId}/.well-known/jwks.json`;

  console.log('Url: ', keysUrl);

  const token = message.headers.Authorization;
  if (!token) {
    console.log('No token provided');
    return { statusCode: 400 };
  }

  let sections = token.split('.');
  // get the kid from the headers prior to verification
  let header = jose.util.base64url.decode(sections[0]);
  header = JSON.parse(header);
  let kid = header.kid;

  // download the public keys
  const response = await superagent.get(keysUrl).set('accept', 'json');

  if (response.statusCode !== 200) {
    console.log('Failed to get keys: ', response.statusCode);
    return;
  }

  const body = response.body;
  const keys = body.keys;

  // search for the kid in the downloaded public keys
  let keyIndex = -1;
  for (let i = 0; i < keys.length; i++) {
    if (kid === keys[i].kid) {
      keyIndex = i;
      break;
    }
  }

  try {
    if (keyIndex === -1) {
      console.log('Public key not found in jwks.json');
      throw new Error('Public key not found in jwks.json');
    }

    // construct the public key
    let result = await jose.JWK.asKey(keys[keyIndex]);

    // verify the signature
    result = await jose.JWS.createVerify(result).verify(token);

    // now we can use the claims
    let claims = JSON.parse(result.payload);

    // additionally we can verify the token expiration
    let currentTs = Math.floor(new Date() / 1000);
    if (currentTs > claims.exp) {
      console.log('Token expired');
      return { statusCode: 401 };
    }

    // and the Audience (use claims.client_id if verifying an access token)
    if (claims.client_id !== UserPoolClientId) {
      console.log('Wrong audience');
      return { statusCode: 401 };
    }
    return {
      statusCode: 200,
      headers: {},
      body: JSON.stringify(claims)
    };
  } catch (err) {
    console.log(err);
    return { statusCode: 500 };
  }
};
