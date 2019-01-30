const AWS = require('aws-sdk');
const cognito = new AWS.CognitoIdentityServiceProvider();

let UserPoolId;
let UserPoolClientId;

const createUser = async (email, password) => {
  const params = {
    UserPoolId,
    Username: email,
    MessageAction: 'SUPPRESS', // Do not send welcome email
    TemporaryPassword: password,
    UserAttributes: [
      {
        Name: 'email',
        Value: email
      },
      {
        // Don't verify email addresses
        Name: 'email_verified',
        Value: 'true'
      }
    ]
  };

  let data = await cognito.adminCreateUser(params).promise();

  // We created the user above, but the password is marked as temporary.
  // We need to set the password again. Initiate an auth challenge to get
  // started.
  const initiateParams = {
    AuthFlow: 'ADMIN_NO_SRP_AUTH',
    ClientId: UserPoolClientId,
    UserPoolId,
    AuthParameters: {
      USERNAME: email,
      PASSWORD: password
    }
  };

  data = await cognito.adminInitiateAuth(initiateParams).promise();
  console.log('InitiateAuth gave:', data);

  // We now have a proper challenge, set the password permanently.
  const challengeResponseData = {
    USERNAME: email,
    NEW_PASSWORD: password
  };

  const responseParams = {
    ChallengeName: 'NEW_PASSWORD_REQUIRED',
    ClientId: UserPoolClientId,
    UserPoolId,
    ChallengeResponses: challengeResponseData,
    Session: data.Session
  };

  await cognito.adminRespondToAuthChallenge(responseParams).promise();
};

exports.handler = async message => {
  console.log('Here in Signup');

  UserPoolId = process.env.USER_POOL_ID;
  UserPoolClientId = process.env.USER_POOL_CLIENT_ID;

  console.log('UserPoolClientId: ', UserPoolClientId);

  if (!UserPoolClientId) {
    console.log(process.env);
    throw new Error('missing environment stuff');
  }

  const body = JSON.parse(message.body);
  const { email, password } = body;
  if (!email || !password) {
    console.log('Email: ', email, 'Password: ', password);
    return { statusCode: 400 };
  }

  await createUser(email, password);

  return { statusCode: 200 };
};
