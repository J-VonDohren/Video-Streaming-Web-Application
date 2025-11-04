const Cognito = require("@aws-sdk/client-cognito-identity-provider");
const jwt = require("aws-jwt-verify");
const crypto = require("crypto");

const SecretsManager = require("@aws-sdk/client-secrets-manager");
const SMClient = new SecretsManager.SecretsManagerClient({ region: process.env.AWS_REGION, credentials: fromNodeProviderChain()});

function secretHash(clientId, clientSecret, username) {
  const hasher = crypto.createHmac('sha256', clientSecret);
  hasher.update(`${username}${clientId}`);
  return hasher.digest('base64');
}

exports.userLogin = async (req, res) =>{
   try {
    const UserPoolIDResponse = await SSMClient.send(
    new SSM.GetParameterCommand({
            Name: "/n11970677/UserPoolID"
         }));
    const UserPoolID = UserPoolIDResponse.Parameter.Value;

    const ClientIDResponse = await SSMClient.send(
    new SSM.GetParameterCommand({
            Name: "/n11970677/ClientID"
         }));
    const ClientID = ClientIDResponse.Parameter.Value;

    const ClientSecretResponse = await SMClient.send(
             new SecretsManager.GetSecretValueCommand({
                SecretId: "n11970677/Client-Secret"
             }));
    const ClientSecret = ClientSecretResponse.SecretString;
    
    const client = new Cognito.CognitoIdentityProviderClient({ region: "ap-southeast-2" });
    const command = new Cognito.InitiateAuthCommand({
      AuthFlow: Cognito.AuthFlowType.USER_PASSWORD_AUTH,
      AuthParameters: {
        USERNAME: req.body.username,
        PASSWORD: req.body.password,
        SECRET_HASH: secretHash(ClientID, ClientSecret, req.body.username),
      },
      ClientId: ClientID,
    });

    const result = await client.send(command);

    // verify tokens
    const idVerifier = jwt.CognitoJwtVerifier.create({
      userPoolId: UserPoolID,
      tokenUse: "id",
      clientId: ClientID,
    });

    const IdToken = result.AuthenticationResult.IdToken;
    await idVerifier.verify(IdToken);

    res.json({ message: "Login successful", tokens: result.AuthenticationResult });
  } catch (err) {
    console.error(err);
    res.status(401).json({ error: "Invalid login", details: err.message });
  }
};

/**
 *  this method handles cognito user signup requests via /signup endpoint
 * 
 * @param {*} req a json containing the feilds necessary for signup
 * {
 *    username : jake,
 *    password : password123,
 *    email : email@outlook.com
 * }
 * @param {*} res 
 */
exports.userSignup = async (req, res) => {
   try {
    const ClientIDResponse = await SSMClient.send(
    new SSM.GetParameterCommand({
            Name: "/n11970677/ClientID"
         }));
    const ClientID = ClientIDResponse.Parameter.Value;

    const ClientSecretResponse = await SMClient.send(
             new SecretsManager.GetSecretValueCommand({
                SecretId: "n11970677/Client-Secret"
             }));
    const ClientSecret = ClientSecretResponse.SecretString;

    userAttributes = [
    { Name: "email", Value: req.body.email },
    { Name: "birthdate", Value: req.body.birthdate },
    { Name: "gender", Value: req.body.gender },
    { Name: "name", Value: req.body.name },
    { Name: "updated_at", Value: req.body.updated_at }
    ];

    const client = new Cognito.CognitoIdentityProviderClient({ region: "ap-southeast-2" });
    const command = new Cognito.SignUpCommand({
      ClientId: ClientID,
      SecretHash: secretHash(ClientID, ClientSecret, req.body.username),
      Username: req.body.username,
      Password: req.body.password,
      UserAttributes: userAttributes,
    });

    const result = await client.send(command);
    res.json({ message: "Signup successful, please confirm your email.", result });
  } catch (err) {
    console.error(err);
    res.status(400).json({ error: err.message });
  }
};

exports.confirmUser = async (req, res) => {
  try {
    const ClientIDResponse = await SSMClient.send(
    new SSM.GetParameterCommand({
            Name: "/n11970677/ClientID"
         }));
    const ClientID = ClientIDResponse.Parameter.Value;

    const ClientSecretResponse = await SMClient.send(
             new SecretsManager.GetSecretValueCommand({
                SecretId: "n11970677/Client-Secret"
             }));
    const ClientSecret = ClientSecretResponse.SecretString;

    const client = new Cognito.CognitoIdentityProviderClient({ region: "ap-southeast-2" });
    const command = new Cognito.ConfirmSignUpCommand({
      ClientId: ClientID,
      SecretHash: secretHash(ClientID, ClientSecret, req.body.username),
      Username: req.body.username,
      ConfirmationCode: req.body.code
    });

    const result = await client.send(command);
    res.json({ message: "User confirmed successfully", result });
  } catch (err) {
    console.error(err);
    res.status(400).json({ error: err.message });
  }
};