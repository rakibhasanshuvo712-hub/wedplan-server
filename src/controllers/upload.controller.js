const fs = require('fs');
const path = require('path');
const config = require('../config');

/**
 * Handle image upload either via ImgBB API or local fallback storage
 */
const uploadImage = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No image file uploaded.',
      });
    }

    const apiKey = config.imgbb.apiKey;

    // If ImgBB API key is configured, upload to ImgBB
    if (apiKey) {
      const base64Image = req.file.buffer.toString('base64');
      const formData = new URLSearchParams();
      formData.append('image', base64Image);

      const response = await fetch(`https://api.imgbb.com/1/upload?key=${apiKey}`, {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();
      if (data && data.success) {
        return res.status(200).json({
          success: true,
          url: data.data.url,
          displayUrl: data.data.display_url,
          deleteUrl: data.data.delete_url,
        });
      } else {
        console.warn('ImgBB API returned failure, falling back to local storage:', data);
      }
    }

    // Fallback: save file locally to public/uploads
    const uploadsDir = path.join(__dirname, '../../uploads');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    const ext = path.extname(req.file.originalname) || '.jpg';
    const filename = `img_${Date.now()}_${Math.round(Math.random() * 1e9)}${ext}`;
    const filePath = path.join(uploadsDir, filename);

    fs.writeFileSync(filePath, req.file.buffer);

    const protocol = req.protocol;
    const host = req.get('host');
    const localUrl = `${protocol}://${host}/uploads/${filename}`;

    return res.status(200).json({
      success: true,
      url: localUrl,
      filename,
    });
  } catch (error) {
    console.error('Image Upload Error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to process image upload.',
    });
  }
};

module.exports = {
  uploadImage,
};
