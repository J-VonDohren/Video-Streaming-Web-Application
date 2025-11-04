/**
 * @file API for News Reporters to manage Media via the cloud
 * @description This API provides endpoints for uploading, downloading and transcoding media files
 * It can alsogive recommendations to other media sources
 * 
 * Features:
 * - Uploading media files from the local machine to the cloud
 * - Downloading raw media files from the cloud
 * - Downloaing media files metadata from the cloud
 * - Generate presigned URLs for media files
 * - Retrieving Transcoded media files from the cloud
 * - Retrieving article recommendations based on media metadata
 * - Backing up media files on S3
 * - Versioning metadatain dynamoDb
 */
const express = require('express'); // npm install express

const videosRouter = require('./src/routes/videos');
const authenticationRouter = require('./src/routes/authentication');
const rollbackRouter = require('./src/routes/rollbacks');

const app = express();
const PORT = 3000;

app.use(express.json());

app.use('/api/auth', authenticationRouter);

app.use('/api/vid', videosRouter);

app.use('/api/manage', rollbackRouter);

// app.listen(PORT, '0.0.0.0');

app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
