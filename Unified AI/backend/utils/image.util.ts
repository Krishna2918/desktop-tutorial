/**
 * Image Utility
 *
 * Provides image processing, EXIF extraction, and thumbnail generation
 * using the sharp library for high-performance image manipulation.
 */

import sharp from 'sharp';
import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * EXIF metadata interface
 */
export interface ExifMetadata {
  make?: string;
  model?: string;
  orientation?: number;
  dateTime?: string;
  dateTimeOriginal?: string;
  dateTimeDigitized?: string;
  exposureTime?: number;
  fNumber?: number;
  iso?: number;
  focalLength?: number;
  flash?: number;
  width?: number;
  height?: number;
  gps?: {
    latitude?: number;
    longitude?: number;
    altitude?: number;
  };
  software?: string;
  copyright?: string;
  artist?: string;
  [key: string]: any;
}

/**
 * Image information
 */
export interface ImageInfo {
  width: number;
  height: number;
  format: string;
  size: number;
  hasAlpha: boolean;
  orientation?: number;
  colorSpace?: string;
  density?: number;
}

/**
 * Thumbnail options
 */
export interface ThumbnailOptions {
  width?: number;
  height?: number;
  fit?: 'cover' | 'contain' | 'fill' | 'inside' | 'outside';
  quality?: number;
  format?: 'jpeg' | 'png' | 'webp';
  withoutEnlargement?: boolean;
}

/**
 * Image processing options
 */
export interface ImageProcessOptions {
  resize?: {
    width?: number;
    height?: number;
    fit?: 'cover' | 'contain' | 'fill' | 'inside' | 'outside';
  };
  rotate?: number;
  flip?: boolean;
  flop?: boolean;
  sharpen?: boolean;
  blur?: number;
  grayscale?: boolean;
  normalize?: boolean;
  quality?: number;
  format?: 'jpeg' | 'png' | 'webp';
}

/**
 * Default thumbnail sizes
 */
export const THUMBNAIL_SIZES = {
  small: { width: 150, height: 150 },
  medium: { width: 300, height: 300 },
  large: { width: 600, height: 600 }
} as const;

/**
 * Image Utility Class
 */
export class ImageUtil {
  /**
   * Get image metadata and information
   */
  static async getImageInfo(filePath: string): Promise<ImageInfo> {
    try {
      const metadata = await sharp(filePath).metadata();

      return {
        width: metadata.width || 0,
        height: metadata.height || 0,
        format: metadata.format || 'unknown',
        size: metadata.size || 0,
        hasAlpha: metadata.hasAlpha || false,
        orientation: metadata.orientation,
        colorSpace: metadata.space,
        density: metadata.density
      };
    } catch (error) {
      throw new Error(`Failed to get image info: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Extract EXIF metadata from image
   */
  static async extractExif(filePath: string): Promise<ExifMetadata> {
    try {
      const metadata = await sharp(filePath).metadata();
      const exif = metadata.exif;

      if (!exif) {
        return {};
      }

      // Parse EXIF buffer
      const exifData: ExifMetadata = {};

      // Basic metadata
      if (metadata.width) exifData.width = metadata.width;
      if (metadata.height) exifData.height = metadata.height;
      if (metadata.orientation) exifData.orientation = metadata.orientation;

      // Try to extract common EXIF fields
      // Note: sharp provides raw EXIF buffer, proper parsing would require exif-parser or similar
      // For now, we'll extract what sharp provides directly
      if (metadata.density) exifData.density = metadata.density;
      if (metadata.chromaSubsampling) exifData.chromaSubsampling = metadata.chromaSubsampling;
      if (metadata.isProgressive !== undefined) exifData.isProgressive = metadata.isProgressive;

      return exifData;
    } catch (error) {
      throw new Error(`Failed to extract EXIF: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Generate thumbnail from image
   */
  static async generateThumbnail(
    inputPath: string,
    outputPath: string,
    options: ThumbnailOptions = {}
  ): Promise<{ width: number; height: number; size: number; path: string }> {
    try {
      const {
        width = THUMBNAIL_SIZES.medium.width,
        height = THUMBNAIL_SIZES.medium.height,
        fit = 'cover',
        quality = 80,
        format = 'jpeg',
        withoutEnlargement = true
      } = options;

      // Ensure output directory exists
      const outputDir = path.dirname(outputPath);
      await fs.mkdir(outputDir, { recursive: true });

      // Create sharp instance
      let pipeline = sharp(inputPath)
        .resize(width, height, {
          fit,
          withoutEnlargement
        })
        .rotate(); // Auto-rotate based on EXIF orientation

      // Apply format-specific options
      if (format === 'jpeg') {
        pipeline = pipeline.jpeg({ quality, mozjpeg: true });
      } else if (format === 'png') {
        pipeline = pipeline.png({ quality, compressionLevel: 9 });
      } else if (format === 'webp') {
        pipeline = pipeline.webp({ quality });
      }

      // Process and save
      const info = await pipeline.toFile(outputPath);

      return {
        width: info.width,
        height: info.height,
        size: info.size,
        path: outputPath
      };
    } catch (error) {
      throw new Error(`Failed to generate thumbnail: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Generate multiple thumbnail sizes
   */
  static async generateThumbnails(
    inputPath: string,
    outputDir: string,
    baseName: string,
    sizes: Array<{ name: string; width: number; height: number }> = [
      { name: 'small', width: 150, height: 150 },
      { name: 'medium', width: 300, height: 300 },
      { name: 'large', width: 600, height: 600 }
    ]
  ): Promise<Record<string, { width: number; height: number; size: number; path: string }>> {
    const results: Record<string, { width: number; height: number; size: number; path: string }> = {};

    for (const size of sizes) {
      const outputPath = path.join(outputDir, `${baseName}_${size.name}.jpg`);
      const result = await this.generateThumbnail(inputPath, outputPath, {
        width: size.width,
        height: size.height
      });
      results[size.name] = result;
    }

    return results;
  }

  /**
   * Process image with various transformations
   */
  static async processImage(
    inputPath: string,
    outputPath: string,
    options: ImageProcessOptions
  ): Promise<{ width: number; height: number; size: number }> {
    try {
      // Ensure output directory exists
      const outputDir = path.dirname(outputPath);
      await fs.mkdir(outputDir, { recursive: true });

      // Create sharp instance
      let pipeline = sharp(inputPath);

      // Apply transformations
      if (options.resize) {
        pipeline = pipeline.resize(
          options.resize.width,
          options.resize.height,
          { fit: options.resize.fit || 'cover' }
        );
      }

      if (options.rotate) {
        pipeline = pipeline.rotate(options.rotate);
      }

      if (options.flip) {
        pipeline = pipeline.flip();
      }

      if (options.flop) {
        pipeline = pipeline.flop();
      }

      if (options.sharpen) {
        pipeline = pipeline.sharpen();
      }

      if (options.blur) {
        pipeline = pipeline.blur(options.blur);
      }

      if (options.grayscale) {
        pipeline = pipeline.grayscale();
      }

      if (options.normalize) {
        pipeline = pipeline.normalize();
      }

      // Apply format and quality
      const format = options.format || 'jpeg';
      const quality = options.quality || 80;

      if (format === 'jpeg') {
        pipeline = pipeline.jpeg({ quality, mozjpeg: true });
      } else if (format === 'png') {
        pipeline = pipeline.png({ quality, compressionLevel: 9 });
      } else if (format === 'webp') {
        pipeline = pipeline.webp({ quality });
      }

      // Process and save
      const info = await pipeline.toFile(outputPath);

      return {
        width: info.width,
        height: info.height,
        size: info.size
      };
    } catch (error) {
      throw new Error(`Failed to process image: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Optimize image (reduce file size while maintaining quality)
   */
  static async optimizeImage(
    inputPath: string,
    outputPath: string,
    quality: number = 85
  ): Promise<{ originalSize: number; optimizedSize: number; reduction: number }> {
    try {
      // Get original file size
      const originalStats = await fs.stat(inputPath);
      const originalSize = originalStats.size;

      // Detect format
      const metadata = await sharp(inputPath).metadata();
      const format = metadata.format;

      // Optimize based on format
      let pipeline = sharp(inputPath);

      if (format === 'jpeg' || format === 'jpg') {
        pipeline = pipeline.jpeg({ quality, mozjpeg: true });
      } else if (format === 'png') {
        pipeline = pipeline.png({ quality, compressionLevel: 9 });
      } else if (format === 'webp') {
        pipeline = pipeline.webp({ quality });
      }

      // Save optimized image
      await pipeline.toFile(outputPath);

      // Get optimized file size
      const optimizedStats = await fs.stat(outputPath);
      const optimizedSize = optimizedStats.size;

      const reduction = ((originalSize - optimizedSize) / originalSize) * 100;

      return {
        originalSize,
        optimizedSize,
        reduction
      };
    } catch (error) {
      throw new Error(`Failed to optimize image: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Convert image to different format
   */
  static async convertImage(
    inputPath: string,
    outputPath: string,
    format: 'jpeg' | 'png' | 'webp',
    quality: number = 80
  ): Promise<{ width: number; height: number; size: number }> {
    try {
      // Ensure output directory exists
      const outputDir = path.dirname(outputPath);
      await fs.mkdir(outputDir, { recursive: true });

      // Convert image
      let pipeline = sharp(inputPath);

      if (format === 'jpeg') {
        pipeline = pipeline.jpeg({ quality, mozjpeg: true });
      } else if (format === 'png') {
        pipeline = pipeline.png({ quality, compressionLevel: 9 });
      } else if (format === 'webp') {
        pipeline = pipeline.webp({ quality });
      }

      const info = await pipeline.toFile(outputPath);

      return {
        width: info.width,
        height: info.height,
        size: info.size
      };
    } catch (error) {
      throw new Error(`Failed to convert image: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Create a circular avatar/profile image
   */
  static async createCircularImage(
    inputPath: string,
    outputPath: string,
    size: number = 200
  ): Promise<{ width: number; height: number; size: number }> {
    try {
      // Create a circular mask
      const circle = Buffer.from(
        `<svg><circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}" /></svg>`
      );

      // Process image
      const info = await sharp(inputPath)
        .resize(size, size, { fit: 'cover' })
        .composite([{
          input: circle,
          blend: 'dest-in'
        }])
        .png()
        .toFile(outputPath);

      return {
        width: info.width,
        height: info.height,
        size: info.size
      };
    } catch (error) {
      throw new Error(`Failed to create circular image: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Extract dominant colors from image
   */
  static async extractDominantColor(filePath: string): Promise<{ r: number; g: number; b: number }> {
    try {
      const { dominant } = await sharp(filePath)
        .resize(1, 1, { fit: 'cover' })
        .raw()
        .toBuffer({ resolveWithObject: true });

      const stats = await sharp(filePath).stats();

      return {
        r: Math.round(stats.dominant.r),
        g: Math.round(stats.dominant.g),
        b: Math.round(stats.dominant.b)
      };
    } catch (error) {
      throw new Error(`Failed to extract dominant color: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Validate image file
   */
  static async validateImage(filePath: string): Promise<{ valid: boolean; error?: string; info?: ImageInfo }> {
    try {
      const info = await this.getImageInfo(filePath);

      // Check if dimensions are valid
      if (info.width === 0 || info.height === 0) {
        return { valid: false, error: 'Invalid image dimensions' };
      }

      // Check if dimensions are too large (prevent DoS)
      const maxDimension = 20000; // 20k pixels
      if (info.width > maxDimension || info.height > maxDimension) {
        return { valid: false, error: 'Image dimensions too large' };
      }

      return { valid: true, info };
    } catch (error) {
      return {
        valid: false,
        error: `Invalid image file: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Auto-rotate image based on EXIF orientation
   */
  static async autoRotate(inputPath: string, outputPath: string): Promise<void> {
    try {
      await sharp(inputPath)
        .rotate()
        .toFile(outputPath);
    } catch (error) {
      throw new Error(`Failed to auto-rotate image: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Strip EXIF metadata from image (for privacy)
   */
  static async stripMetadata(inputPath: string, outputPath: string): Promise<void> {
    try {
      const metadata = await sharp(inputPath).metadata();
      const format = metadata.format;

      let pipeline = sharp(inputPath).withMetadata({
        orientation: undefined,
        exif: {},
        icc: undefined,
        iptc: undefined,
        xmp: undefined
      });

      // Preserve format
      if (format === 'jpeg' || format === 'jpg') {
        pipeline = pipeline.jpeg({ quality: 90 });
      } else if (format === 'png') {
        pipeline = pipeline.png();
      } else if (format === 'webp') {
        pipeline = pipeline.webp({ quality: 90 });
      }

      await pipeline.toFile(outputPath);
    } catch (error) {
      throw new Error(`Failed to strip metadata: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Check if file is a valid image
   */
  static async isValidImage(filePath: string): Promise<boolean> {
    try {
      await sharp(filePath).metadata();
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get image aspect ratio
   */
  static async getAspectRatio(filePath: string): Promise<number> {
    try {
      const metadata = await sharp(filePath).metadata();
      if (!metadata.width || !metadata.height) {
        throw new Error('Invalid image dimensions');
      }
      return metadata.width / metadata.height;
    } catch (error) {
      throw new Error(`Failed to get aspect ratio: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}
