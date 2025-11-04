const express = require('express');
const router = express.Router();
const multer = require('multer');
const controller = require('../controllers/videos');

const upload = multer({ storage: multer.memoryStorage() });

router.get('/file/:id/metadata', controller.getVideoMetaData); // sends the video metadata by id
router.get('/file/:id/Download', controller.getVideoFile); // sends the video file
router.get('/file/:id/transcode', controller.transcodeVideo); // sends the user a transcoded file of equal id
router.get('/file/:id/article-recommendations', controller.getArticleRecommendations); // sends the user recommended articles
router.post('/file/upload', upload.single('file'), (req, res, next) => {
  console.log('Headers:', req.headers['content-type']);
  console.log('Multer file:', !!req.file, req.file?.originalname, req.file?.mimetype, req.file?.size);
  next();
},controller.uploadVideo); //uploads a video file to the s3 bucket

module.exports = router;