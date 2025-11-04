// ----------- Library Imports ----------

const { S3Client, CopyObjectCommand } = require("@aws-sdk/client-s3");
const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, QueryCommand, PutCommand } = require("@aws-sdk/lib-dynamodb");

const s3Client = new S3Client({ region: process.env.AWS_REGION });
const dynamodbClient = new DynamoDBClient({ region: process.env.AWS_REGION });
const docClient = DynamoDBDocumentClient.from(dynamodbClient);

const SecretsManager = require("@aws-sdk/client-secrets-manager");
const SMClient = new SecretsManager.SecretsManagerClient({ region: process.env.AWS_REGION, credentials: fromNodeProviderChain()});

SSM = require("@aws-sdk/client-ssm");
const SSMClient = new SSM.SSMClient({ region: process.env.AWS_REGION, credentials: fromNodeProviderChain()});

// ---------------- S3 related rollbacks ----------------

/**
 * creates a backup of a file in S3 by copying it to a backup/ key
 */
exports.backupFile = async (req, res) => {
  try {

    const bucketNameResponse = await SSMClient.send(
    new SSM.GetParameterCommand({
            Name: "/n11970677/s3-VideoBucketName"
         }));
    const bucketName = bucketNameResponse.Parameter.Value;

    const { key } = req.body;
    if (!key) return res.status(400).json({ error: "Missing S3 key" });

    const backupKey = `backup/${Date.now()}-${key}`;

    await s3Client.send(new CopyObjectCommand({
      Bucket: bucketName,
      CopySource: `${bucketName}/${key}`,
      Key: backupKey
    }));

    res.json({ message: "Backup created", backupKey });
  } catch (err) {
    console.error("backupFile error:", err);
    res.status(500).json({ error: err.message });
  }
};

/**
 * Restores a file from backup in S3
 */
exports.restoreFile = async (req, res) => {
  try {

    const bucketNameResponse = await SSMClient.send(
    new SSM.GetParameterCommand({
            Name: "/n11970677/s3-VideoBucketName"
         }));
    const bucketName = bucketNameResponse.Parameter.Value;

    const { key, backupKey } = req.body;
    if (!key || !backupKey) return res.status(400).json({ error: "Missing key or backupKey" });

    await s3Client.send(new CopyObjectCommand({
      Bucket: bucketName,
      CopySource: `${bucketName}/${backupKey}`,
      Key: key
    }));

    res.json({ message: "File restored", key });
  } catch (err) {
    console.error("restoreFile error:", err);
    res.status(500).json({ error: err.message });
  }
};

// ---------------- DynamoDB related rollbacks ----------------

/**
 * stores a new version of the videos metadata
 */
exports.storeMetadataVersion = async (req, res) => {
  try {
    const partitionKeyResponse = await SMClient.send(
            new SecretsManager.GetSecretValueCommand({
              SecretId: "n11970677/DynamoDBPartitionKey"
            }));
    const partitionKey = partitionKeyResponse.SecretString;
    
    const DynamoDBNameResponse = await SSMClient.send(
        new SSM.GetParameterCommand({
          Name: "/n11970677/dynamoDbName"
        }));
    const DynamoDBName = DynamoDBNameResponse.Parameter.Value;

    const { filename, metadata } = req.body;
    if (!filename || !metadata) return res.status(400).json({ error: "Missing filename or metadata" });

    const version = Date.now();

    await docClient.send(new PutCommand({
      TableName: DynamoDBName,
      Item: {
        [partitionKey]: "n11970677@qut.edu.au",
        filename,
        version,
        ...metadata
      },
    }));

    res.json({ message: "Metadata version stored", filename, version });
  } catch (err) {
    console.error("storeMetadataVersion error:", err);
    res.status(500).json({ error: err.message });
  }
};

/**
 * rollback metadata to the previous version
 */
exports.rollbackMetadata = async (req, res) => {
  try {
    const partitionKeyResponse = await SMClient.send(
            new SecretsManager.GetSecretValueCommand({
              SecretId: "n11970677/DynamoDBPartitionKey"
            }));
    const partitionKey = partitionKeyResponse.SecretString;
    
    const DynamoDBNameResponse = await SSMClient.send(
        new SSM.GetParameterCommand({
          Name: "/n11970677/dynamoDbName"
        }));
    const DynamoDBName = DynamoDBNameResponse.Parameter.Value;

    const { filename } = req.body;
    if (!filename) return res.status(400).json({ error: "Missing filename" });

    const result = await docClient.send(new QueryCommand({
      TableName: DynamoDBName,
      KeyConditionExpression: "#pk = :user and filename = :fn",
      ExpressionAttributeNames: { "#pk": partitionKey },
      ExpressionAttributeValues: {
        ":user": "n11970677@qut.edu.au",
        ":fn": filename
      }
    }));

    const versions = result.Items || [];
    if (versions.length < 2) {
      return res.status(400).json({ error: "No previous version to roll back to" });
    }

    versions.sort((a, b) => b.version - a.version);
    const previous = versions[1];

    await docClient.send(new PutCommand({
      TableName: DynamoDBName,
      Item: { ...previous, version: Date.now() }
    }));

    res.json({ message: "Rolled back metadata", filename, restoredFrom: previous.version });
  } catch (err) {
    console.error("rollbackMetadata error:", err);
    res.status(500).json({ error: err.message });
  }
};
