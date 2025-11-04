// ----------- Library Imports ----------
require("dotenv").config();
const { fromNodeProviderChain } = require("@aws-sdk/credential-providers");

// general purpose related imports
const os = require("os");
const fs = require("fs");
const path = require("path");
const axios = require("axios");

// video related imports
const ffmpeg = require("fluent-ffmpeg");
const { stream, Readable, PassThrough, pipeline} = require("stream");
const { promisify } = require("util");
const streamPipeline = promisify(pipeline);

// S3 related imports
const { S3Client, GetObjectCommand, PutObjectCommand } = require("@aws-sdk/client-s3");
const s3Client = new S3Client({ region: process.env.AWS_REGION, credentials: fromNodeProviderChain()});
const S3Presigner = require("@aws-sdk/s3-request-presigner");

//dynamoDB related imports
const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, PutCommand, GetCommand} = require("@aws-sdk/lib-dynamodb");
const dynamodbClient = new DynamoDBClient({ region: process.env.AWS_REGION, credentials: fromNodeProviderChain()});
const docClient = DynamoDBDocumentClient.from(dynamodbClient);

// parameter store related imports
SSM = require("@aws-sdk/client-ssm");
const SSMClient = new SSM.SSMClient({ region: process.env.AWS_REGION, credentials: fromNodeProviderChain()});

// secrets manager related imports
const SecretsManager = require("@aws-sdk/client-secrets-manager");
const SMClient = new SecretsManager.SecretsManagerClient({ region: process.env.AWS_REGION, credentials: fromNodeProviderChain()});

const QualityToSize = {
  "480":  "854x480",
  "720":  "1280x720",
  "1080": "1920x1080",
  "1440": "2560x1440",
  "2160": "3840x2160",
};

// ---------- Helpers ----------

const numOrNull = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};
/**
 * this helper method takes a video file and uses ffmpeg to read the metadata
 * @param {*} video 
 * @returns a dictionary containing video metadata
 */
async function createMetadata(video){
  return new Promise((resolve, reject) => {
    const src = Buffer.isBuffer(video) ? Readable.from(video) : video;
    ffmpeg(src).ffprobe((err, metadata) => {
      if (err) return reject(err);

      const format = metadata?.format || {};
      const streams = Array.isArray(metadata?.streams) ? metadata.streams : [];
      const v = streams.find(s => s.codec_type === "video");
      const a = streams.find(s => s.codec_type === "audio");

      resolve({
        filename: format.filename || null,
        format: format.format_long_name || null,
        duration: numOrNull(format.duration),
        size: numOrNull(format.size),
        bit_rate: numOrNull(format.bit_rate),
        video: v ? {
          codec: v.codec_name || null,
          width: numOrNull(v.width),
          height: numOrNull(v.height),
        } : null,
        audio: a ? {
          codec: a.codec_name || null,
          channels: numOrNull(a.channels),
          sample_rate: numOrNull(a.sample_rate),
        } : null,
      });
    });
  });
}

async function sendMetadata(metadata, filename){
  try{
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

    const item = {
      [partitionKey]: "n11970677@qut.edu.au", //replace with param store later
      filename,
      ...metadata,
    };

    await docClient.send(new PutCommand({
      TableName: DynamoDBName,
      Item: item,
    }));

    return item;
  } catch (err) {
    console.error("Unable to add item:", JSON.stringify(err, null, 2));
    revertToSnapshot();
    throw err;
  }
}
// ---------- Endpoints ----------

/**
 * Returns an encrypted video file stored in AWS S3
 *  
 * @param {*} req used to retrieve the file id
 * @param {*} res the video file encrypted
 * @throws_Error the error is thrown if no video is found
 * if error then volume of the server is reverted back before the error with an EBS snapshot
 */
exports.getVideoFile = async (req, res) => {
  try {
    const bucketNameResponse = await SSMClient.send(
      new SSM.GetParameterCommand({
        Name: "/n11970677/s3-VideoBucketName"
      })
    );
    const bucketName = bucketNameResponse.Parameter.Value;

    const filename = req.params.id;
    if (!filename) {
      return res.status(400).json({ error: "Video filename is required" });
    }

    const command = new GetObjectCommand({
      Bucket: bucketName,
      Key: filename,
    });

    if (req.query.presignURL === "true") {
      const presignedURL = await S3Presigner.getSignedUrl(
        s3Client,
        command,
        { expiresIn: 3600 }
      );
      return res.status(200).json({ url: presignedURL });
    }

    const s3Response = await s3Client.send(command);
    if (!s3Response.Body) {
      return res.status(404).json({ error: "Video not found in S3" });
    }

    res.setHeader("Content-Type", "video/mp4");
    res.setHeader("Content-Disposition", `inline; filename="${filename}"`);
    s3Response.Body.pipe(res);
  } catch (err) {
    console.error("getVideoFile error:", err);
    if (!res.headersSent) {
      res.status(500).json({ error: err.message });
    }
  }
};


/**
 * Returns a json file containing metadata for a video stored in s3
 * 
 * @param {*} req used to retrive the file id, and query params
 * @param {*} res the json file
 * @throws_Error the error is thrown if no video is found
 * if error then volume of the server is reverted back before the error with an EBS snapshot
 */
exports.getVideoMetaData = async (req, res) =>{
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

    const filename = req.params.id;
    if (!filename) {
      return res.status(400).json({ error: "Video filename required" });
    }

    const command = new GetCommand({
      TableName: DynamoDBName,
      Key: {
        [partitionKey]: "n11970677@qut.edu.au",
      },
    });

    const result = await docClient.send(command);

    if (!result.Item) {
      return res.status(404).json({ error: "Metadata not found in DynamoDB" });
    }

    res.json(result.Item);
  } catch (err) {
    console.error("getVideoMetaData error:", err);
    res.status(500).json({ error: err.message });
  }
};

/**
 * Returns a transcoded version of a video file stored in s3
 * 
 * @param {*} req used to retrieve the file id, and query params
 * @param {*} res the transcoded video of requested quality
 * @throws_Error the error is thrown if no video is found
 * if error then volume of the server is reverted back before the error with an EBS snapshot
 */
exports.transcodeVideo = async (req, res) => {
  try {

    const bucketNameResponse = await SSMClient.send(
    new SSM.GetParameterCommand({
            Name: "/n11970677/s3-VideoBucketName"
         }));
    const bucketName = bucketNameResponse.Parameter.Value;

    const filename = req.params.id;
    if (!filename) return res.status(400).json({ error: "Video filename required" });

    const quality = String(req.query.quality || "1080");
    const size = QualityToSize[quality];
    if (!size) {
      return res.status(400).json({ error: "Unsupported quality. Use ?quality=480|720|1080|1440|2160" });
    }

    const s3Obj = await s3Client.send(new GetObjectCommand({
      Bucket: bucketName,
      Key: filename,
    }));

    if (!s3Obj.Body) return res.status(404).json({ error: "Video not found in S3" });

    const inPath = path.join(os.tmpdir(), `in_${Date.now()}_${Math.random().toString(36).slice(2)}_${path.basename(filename)}`);
    const outPath = path.join(os.tmpdir(), `out_${Date.now()}_${quality}p.mp4`);

    await streamPipeline(s3Obj.Body, fs.createWriteStream(inPath));

    ffmpeg(inPath)
      .inputOptions([
        "-analyzeduration", "200M",
        "-probesize", "200M",
      ])
      .videoCodec("libx264")
      .audioCodec("aac")
      .size(size)
      .outputOptions([
        "-profile:v", "high",
        "-preset", "veryfast",
        "-movflags", "+faststart",
        "-pix_fmt", "yuv420p",
        "-crf", "23",
      ])
      .format("mp4")
      .on("start", (cmd) => console.log("FFmpeg start:", cmd))
      .on("progress", (p) => console.log(`Transcoding ${quality}p: ${Math.round(p?.percent ?? 0)}%`))
      .on("error", async (err) => {
        console.error("Transcode error:", err?.message);
        try { fs.existsSync(inPath) && fs.unlinkSync(inPath); } catch {}
        try { fs.existsSync(outPath) && fs.unlinkSync(outPath); } catch {}
        if (!res.headersSent) res.status(500).json({ error: "Error during transcoding" });
      })
      .on("end", () => {
        res.setHeader("Content-Type", "video/mp4");
        res.setHeader("Content-Disposition", `inline; filename="${path.basename(filename, path.extname(filename))}-${quality}p.mp4"`);
        res.sendFile(outPath, (sendErr) => {
          try { fs.existsSync(inPath) && fs.unlinkSync(inPath); } catch {}
          try { fs.existsSync(outPath) && fs.unlinkSync(outPath); } catch {}
          if (sendErr) console.error("sendFile error:", sendErr);
        });
      })
      .save(outPath);
  } catch (err) {
    console.error("transcodeVideo error:", err);
    if (!res.headersSent) res.status(500).json({ error: err.message });
  }
};

/**
 * Uploads a video file to the S3 bucket
 * 
 * @param {*} req used to retrive the video file
 * @param {*} res sends the status code 200 for successful upload
 * @throws_Error error is thrown if the video was not able to be uploaded to the S3 bucket
 * if error then volume of the server is reverted back before the error with an EBS snapshot
 */
exports.uploadVideo = async (req, res) =>{
  try{
    const bucketNameResponse = await SSMClient.send(
    new SSM.GetParameterCommand({
            Name: "/n11970677/s3-VideoBucketName"
         }));
    const bucketName = bucketNameResponse.Parameter.Value;

    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded step 1" });
    }

    const fileName = req.file.originalname;
    const fileContent = req.file.buffer;

    const params = {
    Bucket: bucketName, //change to the buckets name in param store
    Key: fileName,
    Body: fileContent
    };

    const command = new PutObjectCommand(params);
    await s3Client.send(command);

    const metadata = await createMetadata(req.file.buffer);

    await sendMetadata(metadata, fileName);

    res.status(200).json({ message: "Upload successful", key: fileName });
  }
  catch (err) {
    console.error("Error uploading file:", err);
    res.status(500).json({ error: err.message });
  }
};

/**
 * Users Guardian API to send a list of URLs to relevant Articles
 * 
 * @param {*} req used to retrieve the files id for metadata
 * @param {*} res an array of URLs to relevant articles
 * @returns the res in the form of a json document
 */
exports.getArticleRecommendations = async (req, res) => {
  try {
    const GUARDIAN_API_KEY_RESPONSE = await SMClient.send(
         new SecretsManager.GetSecretValueCommand({
            SecretId: "n11970677/Guardian-API-Key"
         }));
    const GUARDIAN_API_KEY = GUARDIAN_API_KEY_RESPONSE.SecretString;

    if (!GUARDIAN_API_KEY) {
      return res.status(500).json({ error: "Missing GUARDIAN_API_KEY" });
    }

    const filename = req.params.id;
    if (!filename) return res.status(404).json({ error: "Video not found" });

    const query = filename.split(".")[0];

    const url = "https://content.guardianapis.com/search";
    const params = {
      "api-key": GUARDIAN_API_KEY,
      "q": query,
      "order-by": "relevance",
      "page-size": 6,
      "show-fields": "headline"
    };

    const { data } = await axios.get(url, { params });
    const results = data?.response?.results || [];
    const urls = results.map(r => r.webUrl).filter(Boolean);

    return res.json({ id, query, urls });
  } catch (err) {
    console.error("Guardian recommendations error:", err?.response?.data || err.message);
    res.status(500).json({ error: err.message });
  }
};
