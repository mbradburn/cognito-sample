#!/usr/bin/env node

const superagent = require('superagent');
const AmazonCognitoIdentity = require('./amazon-cognito-identity-js');

// "Invoke URL" of API gateway, copied from Stackery console or the AWS API Gateway
// console under "Stages".
// ---- PASTE YOUR OWN VALUE
const SERVER = 'https://qi5vbjmo9j.execute-api.us-west-2.amazonaws.com/development';

// Copy-pasted from Cognito console
// ---- PASTE YOUR OWN VALUES
const USER_POOL_ID = 'us-west-2_t3B7zTtiX';
const USER_POOL_CLIENT_ID = '5t5sru4o5vq71e50g9bbru5gd9';

const argv = require('yargs')
  .usage('Usage: $0 --sign-up --email <email> --password <pass> \n' +
            '    $0 --sign-in --email <email> --password <pass> \n' +
            '    $0 --fetch --token <JWT>')
  .conflicts('sign-up', ['sign-in', 'fetch'])
  .conflicts('sign-in', ['sign-up', 'fetch'])
  .conflicts('fetch', ['sign-up', 'sign-in'])
  .argv;

if (argv['sign-up']) {
  const { email, password } = argv;
  if (!email) {
    console.log('Need email address for sign-up');
    process.exit(1);
  }
  if (!password) {
    console.log('Need password for sign-up');
    process.exit(1);
  }
  signup(email, password);
} else if (argv['sign-in']) {
  const { email, password } = argv;
  if (!email) {
    console.log('Need email address for sign-in');
    process.exit(1);
  }
  if (!password) {
    console.log('Need pasword for sign-in');
    process.exit(1);
  }

  signin(email, password);
} else if (argv.fetch) {
  const { token } = argv;
  if (!token) {
    console.log('Need token for fetch');
    process.exit(1);
  }
  fetch(token);
} else {
  console.log('Unclear on command: use --sign-up, --sign-in, or --fetch');
  process.exit(1);
}

// Sign-up sends a request to the server, asking it to create the user
// with the given password.
async function signup (email, password) {
  const url = `${SERVER}/signup`;

  const payload = { email, password };

  try {
    const res = await superagent
      .post(url)
      .send(payload)
      .set('accept', 'json');
    console.log('result: ', res.status);
  } catch (err) {
    console.log('Error from post: ', err);
  }
}

// Sign-in talks to Cognito to get a JWT -- 'case 4' from
// https://www.npmjs.com/package/amazon-cognito-identity-js
async function signin (email, password) {
  const authenticationData = {
    Username: email,
    Password: password
  };
  const authenticationDetails = new AmazonCognitoIdentity.AuthenticationDetails(authenticationData);
  const poolData = {
    UserPoolId: USER_POOL_ID,
    ClientId: USER_POOL_CLIENT_ID
  };
  const userPool = new AmazonCognitoIdentity.CognitoUserPool(poolData);
  const userData = {
    Username: email,
    Pool: userPool
  };
  const cognitoUser = new AmazonCognitoIdentity.CognitoUser(userData);
  cognitoUser.authenticateUser(authenticationDetails, {
    onSuccess: function (result) {
      const accessToken = result.getAccessToken().getJwtToken();

      console.log('Access token: ', accessToken);

      /*
      //POTENTIAL: Region needs to be set if not already set previously elsewhere.
      AWS.config.region = '<region>';

      AWS.config.credentials = new AWS.CognitoIdentityCredentials({
        IdentityPoolId : '...', // your identity pool id here
        Logins: {
          // Change the key below according to the specific region your user pool is in.
          'cognito-idp.<region>.amazonaws.com/<YOUR_USER_POOL_ID>' : result.getIdToken().getJwtToken()
        }
      });

      //refreshes credentials using AWS.CognitoIdentity.getCredentialsForIdentity()
      AWS.config.credentials.refresh((error) => {
        if (error) {
          console.error(error);
        } else {
          // Instantiate aws sdk service objects now that the credentials have been updated.
          // example: var s3 = new AWS.S3();
          console.log('Successfully logged!');
        }
      });
      */
    },
    onFailure: function (err) {
      console.log(err.message || JSON.stringify(err));
    }
  });
}

// This function is just to exercise the server-side JWT checking; we make
// and authenticated request to get some arbitary stuff.
async function fetch (token) {
  const url = `${SERVER}/userstuff`;

  try {
    const res = await superagent
      .get(url)
      .set('accept', 'json')
      .set('Authorization', token);

    console.log('result: ', res.status);
    console.log(res.body);
  } catch (err) {
    console.log('Error from get: ', err.status);
  }
}
