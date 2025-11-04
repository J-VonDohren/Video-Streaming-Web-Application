const express = require('express');
const router = express.Router();
const controller = require('../controllers/rollbacks.js');

router.post("/file/backup", controller.backupFile);
router.post("/file/restore", controller.restoreFile);
router.post("/metadata/store", controller.storeMetadataVersion);
router.post("/metadata/rollback", controller.rollbackMetadata);

module.exports = router;