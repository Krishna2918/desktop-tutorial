const { Photo, Case } = require('../models');
const { asyncHandler } = require('../middleware/errorHandler');
const path = require('path');
const fs = require('fs');
const faceRecognitionService = require('../services/faceRecognitionService');
const objectDetectionService = require('../services/objectDetectionService');
const imageSimilarityService = require('../services/imageSimilarityService');

// @desc    Upload photos for a case
// @route   POST /api/v1/cases/:caseId/photos
// @access  Private (case poster only)
const uploadPhotos = asyncHandler(async (req, res) => {
  const { caseId } = req.params;

  const caseData = await Case.findByPk(caseId);

  if (!caseData) {
    return res.status(404).json({
      success: false,
      message: 'Case not found',
    });
  }

  // Check if user is the poster
  if (caseData.poster_id !== req.userId && req.user.user_type !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Not authorized to upload photos for this case',
    });
  }

  if (!req.files || req.files.length === 0) {
    return res.status(400).json({
      success: false,
      message: 'No files uploaded',
    });
  }

  // Check max photos limit
  const existingPhotosCount = await Photo.count({ where: { case_id: caseId } });
  const maxPhotos = parseInt(process.env.MAX_PHOTOS_PER_CASE) || 10;

  if (existingPhotosCount + req.files.length > maxPhotos) {
    return res.status(400).json({
      success: false,
      message: `Maximum ${maxPhotos} photos allowed per case`,
    });
  }

  const photos = [];

  for (const file of req.files) {
    const photoPath = file.path;
    const photoUrl = `/uploads/${caseId}/${file.filename}`;

    // Create photo record
    const photo = await Photo.create({
      case_id: caseId,
      image_url: photoUrl,
      file_size: file.size,
      mime_type: file.mimetype,
      is_primary: existingPhotosCount === 0 && photos.length === 0, // First photo is primary
      upload_status: 'processing',
    });

    // Process photo with AI in background (don't await to speed up response)
    processPhotoWithAI(photo, photoPath).catch(error => {
      console.error('AI processing error:', error);
    });

    photos.push(photo);
  }

  res.status(201).json({
    success: true,
    message: 'Photos uploaded successfully (AI processing in background)',
    data: { photos },
  });
});

// @desc    Get photos for a case
// @route   GET /api/v1/cases/:caseId/photos
// @access  Public
const getPhotosByCase = asyncHandler(async (req, res) => {
  const { caseId } = req.params;

  const photos = await Photo.findAll({
    where: { case_id: caseId },
    order: [
      ['is_primary', 'DESC'],
      ['created_at', 'ASC'],
    ],
  });

  res.status(200).json({
    success: true,
    data: { photos },
  });
});

// @desc    Set primary photo
// @route   PUT /api/v1/photos/:id/set-primary
// @access  Private (case poster only)
const setPrimaryPhoto = asyncHandler(async (req, res) => {
  const photo = await Photo.findByPk(req.params.id, {
    include: [{ model: Case, as: 'case' }],
  });

  if (!photo) {
    return res.status(404).json({
      success: false,
      message: 'Photo not found',
    });
  }

  // Check if user is the poster
  if (photo.case.poster_id !== req.userId && req.user.user_type !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Not authorized',
    });
  }

  // Unset all primary photos for this case
  await Photo.update(
    { is_primary: false },
    { where: { case_id: photo.case_id } }
  );

  // Set this photo as primary
  photo.is_primary = true;
  await photo.save();

  res.status(200).json({
    success: true,
    message: 'Primary photo updated',
    data: { photo },
  });
});

// @desc    Delete photo
// @route   DELETE /api/v1/photos/:id
// @access  Private (case poster only)
const deletePhoto = asyncHandler(async (req, res) => {
  const photo = await Photo.findByPk(req.params.id, {
    include: [{ model: Case, as: 'case' }],
  });

  if (!photo) {
    return res.status(404).json({
      success: false,
      message: 'Photo not found',
    });
  }

  // Check if user is the poster
  if (photo.case.poster_id !== req.userId && req.user.user_type !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Not authorized',
    });
  }

  // Delete file from filesystem
  try {
    const filePath = path.join(__dirname, '../../', photo.image_url);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch (error) {
    console.error('Error deleting file:', error);
  }

  await photo.destroy();

  res.status(200).json({
    success: true,
    message: 'Photo deleted successfully',
  });
});

// Helper function to process photo with AI
async function processPhotoWithAI(photo, photoPath) {
  try {
    console.log(`🤖 Processing photo ${photo.id} with AI...`);

    // Process photo with all AI services in parallel
    const [faceResult, objectResult, imageResult] = await Promise.all([
      faceRecognitionService.processPhoto(photoPath),
      objectDetectionService.processPhoto(photoPath),
      imageSimilarityService.processPhoto(photoPath),
    ]);

    // Update photo with AI results
    photo.face_detected = faceResult.faceDetected || false;
    photo.face_vector = faceResult.descriptor || null;
    photo.ai_confidence_score = faceResult.confidence || null;

    photo.ai_metadata = {
      faces_count: faceResult.facesCount || 0,
      objects_detected: objectResult.objects?.map(o => o.class) || [],
      colors: objectResult.colors?.map(c => c.hex) || [],
      primary_object: objectResult.primaryObject || null,
      dominant_color: objectResult.dominantColor || null,
    };

    // Store image features for similarity search
    photo.image_features = imageResult.features || null;
    photo.upload_status = 'completed';

    await photo.save();

    console.log(`✅ Photo ${photo.id} processed successfully`);
  } catch (error) {
    console.error(`❌ Failed to process photo ${photo.id}:`, error);

    // Mark as failed
    photo.upload_status = 'failed';
    photo.upload_error = error.message;
    await photo.save();
  }
}

module.exports = {
  uploadPhotos,
  getPhotosByCase,
  setPrimaryPhoto,
  deletePhoto,
};
