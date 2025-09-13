// Camera and OCR service for ISBN scanning
class CameraOCRService {
  constructor() {
    this.stream = null;
    this.video = null;
    this.canvas = null;
    this.context = null;
    this.isScanning = false;
  }

  async initCamera(videoElement) {
    this.video = videoElement;
    
    try {
      // Request camera access with back camera preference
      const constraints = {
        video: {
          facingMode: { ideal: 'environment' }, // Back camera
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      };

      this.stream = await navigator.mediaDevices.getUserMedia(constraints);
      this.video.srcObject = this.stream;
      
      return new Promise((resolve) => {
        this.video.onloadedmetadata = () => {
          this.video.play();
          this.setupCanvas();
          resolve();
        };
      });
    } catch (error) {
      console.error('Camera initialization failed:', error);
      throw new Error('Camera access denied or not available');
    }
  }

  setupCanvas() {
    this.canvas = document.createElement('canvas');
    this.canvas.width = this.video.videoWidth;
    this.canvas.height = this.video.videoHeight;
    this.context = this.canvas.getContext('2d');
  }

  captureFrame() {
    if (!this.video || !this.canvas || !this.context) {
      throw new Error('Camera not initialized');
    }

    this.context.drawImage(this.video, 0, 0, this.canvas.width, this.canvas.height);
    return this.canvas.toDataURL('image/jpeg', 0.8);
  }

  async extractISBN(imageData) {
    try {
      // Load Tesseract.js dynamically
      if (!window.Tesseract) {
        await this.loadTesseract();
      }

      const { data: { text } } = await window.Tesseract.recognize(
        imageData,
        'eng',
        {
          logger: m => console.log(m) // Progress logging
        }
      );

      // Extract ISBN from OCR text
      const isbn = this.parseISBNFromText(text);
      return isbn;
    } catch (error) {
      console.error('OCR failed:', error);
      throw new Error('Failed to extract ISBN from image');
    }
  }

  parseISBNFromText(text) {
    // Clean text and look for ISBN patterns
    const cleanText = text.replace(/\s+/g, '').toUpperCase();
    
    // ISBN-13 pattern (13 digits)
    const isbn13Pattern = /(?:ISBN)?(?:\-)?(?:13)?(?:\:)?(?:\s)?(?:978|979)(\d{10})/;
    const isbn13Match = cleanText.match(isbn13Pattern);
    
    if (isbn13Match) {
      return '978' + isbn13Match[1];
    }
    
    // ISBN-10 pattern (10 digits/characters)
    const isbn10Pattern = /(?:ISBN)?(?:\-)?(?:10)?(?:\:)?(?:\s)?(\d{9}[\dX])/;
    const isbn10Match = cleanText.match(isbn10Pattern);
    
    if (isbn10Match) {
      return this.convertISBN10to13(isbn10Match[1]);
    }
    
    // Fallback: look for any 10 or 13 digit sequence
    const digitPattern = /(\d{13}|\d{10})/;
    const digitMatch = cleanText.match(digitPattern);
    
    if (digitMatch) {
      const digits = digitMatch[1];
      if (digits.length === 13 && (digits.startsWith('978') || digits.startsWith('979'))) {
        return digits;
      } else if (digits.length === 10) {
        return this.convertISBN10to13(digits);
      }
    }
    
    throw new Error('No valid ISBN found in image');
  }

  convertISBN10to13(isbn10) {
    // Remove any non-digit characters except X
    const clean = isbn10.replace(/[^\dX]/g, '');
    
    if (clean.length !== 10) {
      throw new Error('Invalid ISBN-10 format');
    }
    
    // Take first 9 digits and prepend 978
    const isbn13Base = '978' + clean.substring(0, 9);
    
    // Calculate check digit for ISBN-13
    let sum = 0;
    for (let i = 0; i < 12; i++) {
      const digit = parseInt(isbn13Base[i]);
      sum += (i % 2 === 0) ? digit : digit * 3;
    }
    
    const checkDigit = (10 - (sum % 10)) % 10;
    return isbn13Base + checkDigit;
  }

  async loadTesseract() {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  async startScanning(onISBNFound, onError) {
    if (this.isScanning) return;
    
    this.isScanning = true;
    
    const scanFrame = async () => {
      if (!this.isScanning) return;
      
      try {
        const imageData = this.captureFrame();
        const isbn = await this.extractISBN(imageData);
        
        if (isbn) {
          this.stopScanning();
          onISBNFound(isbn);
          return;
        }
      } catch (error) {
        // Continue scanning on individual frame errors
        console.log('Frame scan failed:', error.message);
      }
      
      // Scan next frame after a short delay
      setTimeout(scanFrame, 1000);
    };
    
    scanFrame();
  }

  stopScanning() {
    this.isScanning = false;
  }

  stopCamera() {
    this.stopScanning();
    
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }
    
    if (this.video) {
      this.video.srcObject = null;
    }
  }

  // Check if camera is supported
  static isSupported() {
    return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
  }

  // Request camera permissions
  static async requestPermissions() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      stream.getTracks().forEach(track => track.stop());
      return true;
    } catch (error) {
      return false;
    }
  }
}

export const cameraOCRService = new CameraOCRService();
