# RENG — Image Reverse Engineering Tool 🔍

A powerful, fully client-side image reverse engineering tool. Upload any image and extract detailed information including metadata, EXIF data, color analysis, file hashes, binary structure, and embedded strings.

**All processing happens in your browser — no data is sent to any server.**

## Features

| Feature | Description |
|---------|-------------|
| 📋 **Overview** | File name, size, MIME type, dimensions, megapixels, aspect ratio, bit depth |
| 📷 **EXIF Data** | Camera make/model, lens, exposure, ISO, aperture, GPS coordinates with Google Maps link |
| 🎨 **Color Analysis** | Dominant colors palette, average color, brightness, tone classification |
| 🔐 **Hash Generation** | MD5, SHA-1, SHA-256 hashes with copy button + VirusTotal reverse search link |
| 🔢 **Binary/Hex Dump** | Magic bytes detection, file structure description, hex dump viewer |
| 📝 **String Extraction** | All readable ASCII strings found in the binary with byte offsets |
| 🔍 **Reverse Search** | Search image on Google, Yandex, Bing, TinEye, Instagram, Facebook, Twitter/X, Pinterest, Reddit, LinkedIn, TikTok, VirusTotal |
| 📥 **Export** | Download full report as JSON or plain text |

## How to Use

1. Open `index.html` in any modern browser
2. Drag & drop an image or click to browse
3. Explore the analysis tabs
4. Export the report as JSON or text

## Supported Formats

JPEG, PNG, GIF, BMP, WebP, TIFF, SVG, ICO

## Tech Stack

- Vanilla HTML / CSS / JavaScript (no build step required)
- [exif-js](https://github.com/exif-js/exif-js) for EXIF metadata extraction
- Web Crypto API for SHA-1 and SHA-256 hashing
- Custom MD5 implementation

## Privacy

All image processing is performed entirely in the browser using JavaScript. No image data is uploaded to any server.

## Deployment

This is a static site — deploy it anywhere:
- **GitHub Pages**: Push to `main` branch and enable Pages
- **Vercel / Netlify**: Connect the repo and deploy
- **Local**: Just open `index.html` in a browser

## License

MIT
