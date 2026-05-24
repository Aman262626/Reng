/**
 * RENG - Image Reverse Engineering Tool
 * All processing happens client-side in the browser
 */
(function () {
    'use strict';

    // State
    let currentFile = null;
    let currentArrayBuffer = null;
    let analysisData = {};

    // DOM Elements
    const uploadArea = document.getElementById('upload-area');
    const fileInput = document.getElementById('file-input');
    const urlInput = document.getElementById('url-input');
    const urlFetchBtn = document.getElementById('url-fetch-btn');
    const uploadSection = document.getElementById('upload-section');
    const resultsSection = document.getElementById('results-section');
    const previewImage = document.getElementById('preview-image');
    const newImageBtn = document.getElementById('new-image-btn');
    const themeToggle = document.getElementById('theme-toggle');
    const exportJsonBtn = document.getElementById('export-json');
    const exportTxtBtn = document.getElementById('export-txt');

    // ===== THEME =====
    function initTheme() {
        var saved = localStorage.getItem('reng-theme');
        if (saved === 'light') {
            document.body.classList.add('light-theme');
            toggleThemeIcons(true);
        }
    }

    function toggleThemeIcons(isLight) {
        var sun = themeToggle.querySelector('.icon-sun');
        var moon = themeToggle.querySelector('.icon-moon');
        sun.style.display = isLight ? 'none' : 'block';
        moon.style.display = isLight ? 'block' : 'none';
    }

    themeToggle.addEventListener('click', function () {
        var isLight = document.body.classList.toggle('light-theme');
        localStorage.setItem('reng-theme', isLight ? 'light' : 'dark');
        toggleThemeIcons(isLight);
    });

    initTheme();

    // ===== UPLOAD HANDLERS =====
    uploadArea.addEventListener('click', function () {
        fileInput.click();
    });

    uploadArea.addEventListener('dragover', function (e) {
        e.preventDefault();
        uploadArea.classList.add('drag-over');
    });

    uploadArea.addEventListener('dragleave', function () {
        uploadArea.classList.remove('drag-over');
    });

    uploadArea.addEventListener('drop', function (e) {
        e.preventDefault();
        uploadArea.classList.remove('drag-over');
        if (e.dataTransfer.files.length > 0) {
            handleFile(e.dataTransfer.files[0]);
        }
    });

    fileInput.addEventListener('change', function () {
        if (fileInput.files.length > 0) {
            handleFile(fileInput.files[0]);
        }
    });

    urlFetchBtn.addEventListener('click', function () {
        var url = urlInput.value.trim();
        if (!url) return;
        fetchImageFromUrl(url);
    });

    urlInput.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') {
            urlFetchBtn.click();
        }
    });

    newImageBtn.addEventListener('click', function () {
        resetAnalysis();
    });

    // ===== FILE HANDLING =====
    function handleFile(file) {
        if (!file.type.startsWith('image/') && !file.name.match(/\.(jpg|jpeg|png|gif|bmp|webp|tiff|tif|svg|ico)$/i)) {
            showToast('Please upload a valid image file');
            return;
        }

        currentFile = file;
        analysisData = { fileName: file.name, fileSize: file.size, fileType: file.type || guessType(file.name) };

        var reader = new FileReader();
        reader.onload = function (e) {
            currentArrayBuffer = e.target.result;
            showResults(URL.createObjectURL(file));
            runAnalysis();
        };
        reader.readAsArrayBuffer(file);
    }

    function fetchImageFromUrl(url) {
        showToast('Fetching image...');
        fetch(url, { mode: 'cors' })
            .then(function (r) {
                if (!r.ok) throw new Error('Failed to fetch');
                return r.blob();
            })
            .then(function (blob) {
                var name = url.split('/').pop().split('?')[0] || 'image';
                var file = new File([blob], name, { type: blob.type });
                handleFile(file);
            })
            .catch(function () {
                showToast('Could not fetch image. Try downloading it manually.');
            });
    }

    function guessType(name) {
        var ext = name.split('.').pop().toLowerCase();
        var map = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', bmp: 'image/bmp', webp: 'image/webp', tiff: 'image/tiff', tif: 'image/tiff', svg: 'image/svg+xml', ico: 'image/x-icon' };
        return map[ext] || 'image/unknown';
    }

    // ===== UI =====
    function showResults(blobUrl) {
        uploadSection.style.display = 'none';
        resultsSection.style.display = 'grid';
        previewImage.src = blobUrl;
    }

    function resetAnalysis() {
        uploadSection.style.display = 'flex';
        resultsSection.style.display = 'none';
        currentFile = null;
        currentArrayBuffer = null;
        analysisData = {};
        fileInput.value = '';
        urlInput.value = '';
        document.getElementById('overview-grid').innerHTML = '';
        document.getElementById('exif-content').innerHTML = '<p class="loading">Extracting EXIF data</p>';
        document.getElementById('colors-content').innerHTML = '<p class="loading">Analyzing colors</p>';
        document.getElementById('hash-content').innerHTML = '<p class="loading">Computing hashes</p>';
        document.getElementById('binary-content').innerHTML = '<p class="loading">Reading binary data</p>';
        document.getElementById('strings-content').innerHTML = '<p class="loading">Extracting strings</p>';
        // Reset to overview tab
        document.querySelectorAll('.tab').forEach(function (t) { t.classList.remove('active'); });
        document.querySelectorAll('.tab-content').forEach(function (t) { t.classList.remove('active'); });
        document.querySelector('[data-tab="overview"]').classList.add('active');
        document.getElementById('tab-overview').classList.add('active');
    }

    // Tabs
    document.querySelectorAll('.tab').forEach(function (tab) {
        tab.addEventListener('click', function () {
            document.querySelectorAll('.tab').forEach(function (t) { t.classList.remove('active'); });
            document.querySelectorAll('.tab-content').forEach(function (t) { t.classList.remove('active'); });
            tab.classList.add('active');
            document.getElementById('tab-' + tab.dataset.tab).classList.add('active');
        });
    });

    // ===== ANALYSIS ENGINE =====
    function runAnalysis() {
        analyzeOverview();
        analyzeEXIF();
        analyzeColors();
        computeHashes();
        analyzeBinary();
        extractStrings();
    }

    // --- Overview ---
    function analyzeOverview() {
        var grid = document.getElementById('overview-grid');
        var img = new Image();
        img.onload = function () {
            analysisData.width = img.naturalWidth;
            analysisData.height = img.naturalHeight;
            analysisData.aspectRatio = (img.naturalWidth / img.naturalHeight).toFixed(3);
            analysisData.megapixels = ((img.naturalWidth * img.naturalHeight) / 1e6).toFixed(2);

            var cards = [
                { label: 'File Name', value: analysisData.fileName },
                { label: 'File Size', value: formatBytes(analysisData.fileSize), highlight: true },
                { label: 'MIME Type', value: analysisData.fileType, highlight: true },
                { label: 'Dimensions', value: img.naturalWidth + ' × ' + img.naturalHeight + ' px' },
                { label: 'Aspect Ratio', value: analysisData.aspectRatio },
                { label: 'Megapixels', value: analysisData.megapixels + ' MP' },
                { label: 'Bit Depth (est.)', value: estimateBitDepth() },
                { label: 'Last Modified', value: currentFile.lastModified ? new Date(currentFile.lastModified).toLocaleString() : 'N/A' },
            ];

            grid.innerHTML = cards.map(function (c) {
                return '<div class="info-card"><div class="label">' + c.label + '</div><div class="value' + (c.highlight ? ' highlight' : '') + '">' + escapeHtml(c.value) + '</div></div>';
            }).join('');
        };
        img.src = URL.createObjectURL(currentFile);
    }

    function estimateBitDepth() {
        var type = analysisData.fileType;
        if (type.includes('png')) return '8/16-bit per channel';
        if (type.includes('jpeg') || type.includes('jpg')) return '8-bit per channel';
        if (type.includes('gif')) return '8-bit (indexed)';
        if (type.includes('bmp')) return '24/32-bit';
        if (type.includes('webp')) return '8-bit per channel';
        return 'Unknown';
    }

    // --- EXIF ---
    function analyzeEXIF() {
        var container = document.getElementById('exif-content');

        try {
            if (typeof EXIF === 'undefined') {
                container.innerHTML = '<div class="no-data"><div class="icon">📋</div>EXIF library not loaded</div>';
                return;
            }

            var blob = new Blob([currentArrayBuffer]);
            var img = new Image();
            img.src = URL.createObjectURL(blob);

            img.onload = function () {
                EXIF.getData(img, function () {
                    var allTags = EXIF.getAllTags(this);
                    analysisData.exif = allTags;

                    if (!allTags || Object.keys(allTags).length === 0) {
                        container.innerHTML = '<div class="no-data"><div class="icon">📋</div>No EXIF data found in this image<br><small>EXIF data is typically found in JPEG images from cameras</small></div>';
                        return;
                    }

                    var groups = categorizeExif(allTags);
                    var html = '';

                    for (var group in groups) {
                        if (groups[group].length === 0) continue;
                        html += '<div class="exif-group-title">' + group + '</div>';
                        html += '<table class="exif-table">';
                        groups[group].forEach(function (item) {
                            var displayVal = formatExifValue(item.key, item.value);
                            html += '<tr><td>' + escapeHtml(item.key) + '</td><td>' + displayVal + '</td></tr>';
                        });
                        html += '</table>';
                    }

                    // GPS coordinates
                    var lat = allTags.GPSLatitude;
                    var lon = allTags.GPSLongitude;
                    if (lat && lon) {
                        var latRef = allTags.GPSLatitudeRef || 'N';
                        var lonRef = allTags.GPSLongitudeRef || 'E';
                        var latDec = dmsToDecimal(lat, latRef);
                        var lonDec = dmsToDecimal(lon, lonRef);
                        analysisData.gps = { lat: latDec, lon: lonDec };
                        html += '<div class="exif-group-title">📍 GPS Location</div>';
                        html += '<table class="exif-table">';
                        html += '<tr><td>Coordinates</td><td>' + latDec.toFixed(6) + ', ' + lonDec.toFixed(6) + '</td></tr>';
                        html += '<tr><td>View on Map</td><td><a class="gps-link" href="https://www.google.com/maps?q=' + latDec + ',' + lonDec + '" target="_blank" rel="noopener">Open in Google Maps ↗</a></td></tr>';
                        html += '</table>';
                    }

                    container.innerHTML = html;
                });
            };
        } catch (e) {
            container.innerHTML = '<div class="no-data"><div class="icon">⚠️</div>Error reading EXIF data</div>';
        }
    }

    function categorizeExif(tags) {
        var groups = {
            '📷 Camera': [],
            '⚙️ Settings': [],
            '📅 Date/Time': [],
            '🖼️ Image': [],
            '📝 Other': []
        };

        var cameraKeys = ['Make', 'Model', 'LensMake', 'LensModel', 'Software'];
        var settingsKeys = ['ExposureTime', 'FNumber', 'ISOSpeedRatings', 'ShutterSpeedValue', 'ApertureValue', 'ExposureBias', 'MaxApertureValue', 'MeteringMode', 'Flash', 'FocalLength', 'FocalLengthIn35mmFilm', 'WhiteBalance', 'ExposureProgram', 'ExposureMode', 'SceneCaptureType'];
        var dateKeys = ['DateTime', 'DateTimeOriginal', 'DateTimeDigitized'];
        var imageKeys = ['ImageWidth', 'ImageHeight', 'XResolution', 'YResolution', 'ResolutionUnit', 'ColorSpace', 'PixelXDimension', 'PixelYDimension', 'Orientation', 'Compression'];

        for (var key in tags) {
            if (key === 'thumbnail' || key === 'MakerNote' || key === 'UserComment') continue;
            var item = { key: key, value: tags[key] };
            if (cameraKeys.indexOf(key) !== -1) groups['📷 Camera'].push(item);
            else if (settingsKeys.indexOf(key) !== -1) groups['⚙️ Settings'].push(item);
            else if (dateKeys.indexOf(key) !== -1) groups['📅 Date/Time'].push(item);
            else if (imageKeys.indexOf(key) !== -1) groups['🖼️ Image'].push(item);
            else groups['📝 Other'].push(item);
        }

        return groups;
    }

    function formatExifValue(key, value) {
        if (value === undefined || value === null) return 'N/A';

        if (key === 'ExposureTime') {
            var num = typeof value === 'number' ? value : parseFloat(value);
            if (num > 0 && num < 1) return '1/' + Math.round(1 / num) + ' sec';
            return num + ' sec';
        }
        if (key === 'FNumber') {
            return 'f/' + (typeof value === 'number' ? value : value);
        }
        if (key === 'FocalLength') {
            return value + ' mm';
        }
        if (key === 'ISOSpeedRatings') {
            return 'ISO ' + value;
        }

        if (typeof value === 'object' && value.numerator !== undefined) {
            return value.numerator + '/' + value.denominator;
        }

        return escapeHtml(String(value));
    }

    function dmsToDecimal(dms, ref) {
        var d = dms[0], m = dms[1], s = dms[2];
        var dec = d + m / 60 + s / 3600;
        if (ref === 'S' || ref === 'W') dec = -dec;
        return dec;
    }

    // --- Colors ---
    function analyzeColors() {
        var container = document.getElementById('colors-content');
        var img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = function () {
            var canvas = document.createElement('canvas');
            var ctx = canvas.getContext('2d');
            var w = Math.min(img.naturalWidth, 200);
            var h = Math.round((img.naturalHeight / img.naturalWidth) * w);
            canvas.width = w;
            canvas.height = h;
            ctx.drawImage(img, 0, 0, w, h);

            var imageData = ctx.getImageData(0, 0, w, h);
            var data = imageData.data;

            // Extract dominant colors using simple quantization
            var colorMap = {};
            var totalR = 0, totalG = 0, totalB = 0, pixelCount = 0;
            var brightnessSum = 0;

            for (var i = 0; i < data.length; i += 4) {
                var r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];
                if (a < 128) continue;

                totalR += r; totalG += g; totalB += b;
                brightnessSum += (0.299 * r + 0.587 * g + 0.114 * b);
                pixelCount++;

                // Quantize to reduce color space
                var qr = Math.round(r / 32) * 32;
                var qg = Math.round(g / 32) * 32;
                var qb = Math.round(b / 32) * 32;
                var key = qr + ',' + qg + ',' + qb;
                colorMap[key] = (colorMap[key] || 0) + 1;
            }

            // Sort by frequency
            var sorted = Object.keys(colorMap).sort(function (a, b) {
                return colorMap[b] - colorMap[a];
            });

            var topColors = sorted.slice(0, 10).map(function (key) {
                var parts = key.split(',');
                return { r: parseInt(parts[0]), g: parseInt(parts[1]), b: parseInt(parts[2]), count: colorMap[key] };
            });

            var avgR = Math.round(totalR / pixelCount);
            var avgG = Math.round(totalG / pixelCount);
            var avgB = Math.round(totalB / pixelCount);
            var avgBrightness = Math.round(brightnessSum / pixelCount);

            analysisData.colors = {
                dominantColors: topColors,
                averageColor: { r: avgR, g: avgG, b: avgB },
                brightness: avgBrightness,
                pixelCount: pixelCount
            };

            // Build HTML
            var html = '<h4 style="margin-bottom:16px;font-size:0.9rem;">Dominant Colors</h4>';
            html += '<div class="color-palette">';
            topColors.forEach(function (c) {
                var hex = rgbToHex(c.r, c.g, c.b);
                var pct = ((c.count / pixelCount) * 100).toFixed(1);
                html += '<div class="color-swatch">';
                html += '<div class="color-box" style="background:' + hex + '" title="' + hex + ' (' + pct + '%)" onclick="navigator.clipboard.writeText(\'' + hex + '\')"></div>';
                html += '<span class="color-label">' + hex + '</span>';
                html += '<span class="color-label">' + pct + '%</span>';
                html += '</div>';
            });
            html += '</div>';

            html += '<h4 style="margin:24px 0 16px;font-size:0.9rem;">Color Statistics</h4>';
            html += '<div class="color-stats">';
            html += '<div class="color-stat-card"><div class="label">Average Color</div><div style="width:32px;height:32px;border-radius:6px;background:rgb(' + avgR + ',' + avgG + ',' + avgB + ');margin:8px auto 4px;border:1px solid var(--border-color)"></div><div class="value" style="font-size:0.8rem;font-family:var(--font-mono)">' + rgbToHex(avgR, avgG, avgB) + '</div></div>';
            html += '<div class="color-stat-card"><div class="label">Brightness</div><div class="value">' + avgBrightness + ' / 255</div></div>';
            html += '<div class="color-stat-card"><div class="label">Tone</div><div class="value">' + (avgBrightness > 180 ? '☀️ Light' : avgBrightness > 80 ? '🌤️ Medium' : '🌙 Dark') + '</div></div>';
            html += '<div class="color-stat-card"><div class="label">Unique Colors (sampled)</div><div class="value">' + sorted.length.toLocaleString() + '</div></div>';
            html += '</div>';

            container.innerHTML = html;
        };
        img.src = URL.createObjectURL(currentFile);
    }

    function rgbToHex(r, g, b) {
        return '#' + [r, g, b].map(function (v) {
            var hex = v.toString(16);
            return hex.length === 1 ? '0' + hex : hex;
        }).join('');
    }

    // --- Hashes ---
    function computeHashes() {
        var container = document.getElementById('hash-content');
        var ab = currentArrayBuffer;

        var md5Hash = MD5.hashArrayBuffer(ab);

        crypto.subtle.digest('SHA-256', ab).then(function (sha256buf) {
            return crypto.subtle.digest('SHA-1', ab).then(function (sha1buf) {
                var sha256 = bufToHex(sha256buf);
                var sha1 = bufToHex(sha1buf);

                analysisData.hashes = { md5: md5Hash, sha1: sha1, sha256: sha256 };

                var hashes = [
                    { label: 'MD5', value: md5Hash },
                    { label: 'SHA-1', value: sha1 },
                    { label: 'SHA-256', value: sha256 }
                ];

                var html = '<div class="hash-list">';
                hashes.forEach(function (h) {
                    html += '<div class="hash-item">';
                    html += '<div class="label">' + h.label + '</div>';
                    html += '<div class="hash-value-row">';
                    html += '<span class="hash-value">' + h.value + '</span>';
                    html += '<button class="btn-copy" onclick="copyHash(this, \'' + h.value + '\')">Copy</button>';
                    html += '</div></div>';
                });
                html += '</div>';

                html += '<div style="margin-top:20px;padding:14px 16px;background:var(--bg-input);border:1px solid var(--border-color);border-radius:var(--radius-sm)">';
                html += '<div class="label" style="font-size:0.72rem;color:var(--text-muted);font-family:var(--font-mono);text-transform:uppercase;letter-spacing:1px;margin-bottom:8px">🔍 Reverse Search</div>';
                html += '<p style="font-size:0.82rem;color:var(--text-secondary);margin-bottom:8px">Use these hashes to search for this image on:</p>';
                html += '<div style="display:flex;gap:8px;flex-wrap:wrap">';
                html += '<a href="https://www.virustotal.com/gui/search/' + sha256 + '" target="_blank" rel="noopener" class="gps-link" style="font-size:0.82rem">VirusTotal ↗</a>';
                html += '</div></div>';

                container.innerHTML = html;
            });
        });
    }

    function bufToHex(buffer) {
        return Array.from(new Uint8Array(buffer)).map(function (b) {
            return b.toString(16).padStart(2, '0');
        }).join('');
    }

    // Global copy function
    window.copyHash = function (btn, text) {
        navigator.clipboard.writeText(text).then(function () {
            btn.textContent = 'Copied!';
            btn.classList.add('copied');
            setTimeout(function () {
                btn.textContent = 'Copy';
                btn.classList.remove('copied');
            }, 2000);
        });
    };

    // --- Binary / Hex ---
    function analyzeBinary() {
        var container = document.getElementById('binary-content');
        var bytes = new Uint8Array(currentArrayBuffer);

        // Magic bytes detection
        var magic = detectMagicBytes(bytes);
        analysisData.magic = magic;

        var html = '<div class="magic-bytes">';
        html += '<div class="label">Magic Bytes / File Signature</div>';
        html += '<div class="value">' + escapeHtml(magic.signature) + ' → ' + escapeHtml(magic.description) + '</div>';
        html += '</div>';

        // File structure info
        html += '<div class="magic-bytes" style="margin-bottom:16px">';
        html += '<div class="label">File Structure</div>';
        html += '<div class="value">' + escapeHtml(magic.structure) + '</div>';
        html += '</div>';

        // Hex dump (first 512 bytes)
        var dumpSize = Math.min(bytes.length, 512);
        html += '<div class="hex-header"><h4>Hex Dump (first ' + dumpSize + ' bytes of ' + formatBytes(bytes.length) + ')</h4></div>';
        html += '<div class="hex-dump">';

        for (var i = 0; i < dumpSize; i += 16) {
            var offset = i.toString(16).padStart(8, '0');
            var hexPart = '';
            var asciiPart = '';

            for (var j = 0; j < 16; j++) {
                if (i + j < dumpSize) {
                    hexPart += bytes[i + j].toString(16).padStart(2, '0') + ' ';
                    var ch = bytes[i + j];
                    asciiPart += (ch >= 32 && ch <= 126) ? String.fromCharCode(ch) : '.';
                } else {
                    hexPart += '   ';
                    asciiPart += ' ';
                }
                if (j === 7) hexPart += ' ';
            }

            html += '<span class="hex-offset">' + offset + '</span>  <span class="hex-bytes">' + hexPart + '</span> <span class="hex-ascii">|' + escapeHtml(asciiPart) + '|</span>\n';
        }

        html += '</div>';
        container.innerHTML = html;
    }

    function detectMagicBytes(bytes) {
        var hex = '';
        for (var i = 0; i < Math.min(bytes.length, 16); i++) {
            hex += bytes[i].toString(16).padStart(2, '0') + ' ';
        }
        hex = hex.trim();

        // Check signatures
        if (bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF) {
            return { signature: 'FF D8 FF', description: 'JPEG Image', structure: 'JPEG uses sequential markers (FFxx). Contains SOI, APP markers (EXIF/JFIF), quantization tables, Huffman tables, and scan data. Ends with EOI (FF D9).' };
        }
        if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47) {
            return { signature: '89 50 4E 47 (‰PNG)', description: 'PNG Image', structure: 'PNG uses chunk-based structure: IHDR (header), IDAT (compressed pixel data), IEND (end). May contain tEXt, iTXt, zTXt chunks with metadata.' };
        }
        if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46) {
            return { signature: '47 49 46 (GIF)', description: 'GIF Image', structure: 'GIF uses block-based structure with a global color table, image descriptors, and LZW-compressed pixel data. May contain animation extension blocks.' };
        }
        if (bytes[0] === 0x42 && bytes[1] === 0x4D) {
            return { signature: '42 4D (BM)', description: 'BMP Bitmap', structure: 'BMP contains a file header (14 bytes), DIB header (variable), optional color table, and raw pixel data (typically uncompressed).' };
        }
        if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) {
            return { signature: '52 49 46 46 ... 57 45 42 50 (RIFF...WEBP)', description: 'WebP Image', structure: 'WebP uses RIFF container format. May contain VP8 (lossy), VP8L (lossless), or VP8X (extended) chunks with alpha, animation, or EXIF data.' };
        }
        if (bytes[0] === 0x49 && bytes[1] === 0x49 && bytes[2] === 0x2A && bytes[3] === 0x00) {
            return { signature: '49 49 2A 00 (II*)', description: 'TIFF Image (Little Endian)', structure: 'TIFF uses IFD (Image File Directory) chain structure. Each IFD contains tags describing the image. Supports multiple images and various compression schemes.' };
        }
        if (bytes[0] === 0x4D && bytes[1] === 0x4D && bytes[2] === 0x00 && bytes[3] === 0x2A) {
            return { signature: '4D 4D 00 2A (MM)', description: 'TIFF Image (Big Endian)', structure: 'TIFF uses IFD chain structure (big-endian byte order). Each IFD contains tags describing the image data.' };
        }
        if (bytes[0] === 0x00 && bytes[1] === 0x00 && bytes[2] === 0x01 && bytes[3] === 0x00) {
            return { signature: '00 00 01 00', description: 'ICO Icon', structure: 'ICO contains an ICONDIR header followed by ICONDIRENTRY records. Each entry points to embedded BMP or PNG image data.' };
        }

        // SVG (text-based)
        var textStart = String.fromCharCode.apply(null, bytes.slice(0, 100));
        if (textStart.includes('<svg') || textStart.includes('<?xml')) {
            return { signature: 'Text/XML', description: 'SVG Vector Image', structure: 'SVG is an XML-based vector format. Contains path, shape, text, and style elements. May embed raster images as base64 data URIs.' };
        }

        return { signature: hex.substring(0, 23), description: 'Unknown format', structure: 'Could not identify the file structure from the magic bytes.' };
    }

    // --- Strings ---
    function extractStrings() {
        var container = document.getElementById('strings-content');
        var bytes = new Uint8Array(currentArrayBuffer);
        var strings = [];
        var current = '';
        var startOffset = 0;
        var minLen = 4;

        for (var i = 0; i < bytes.length; i++) {
            var ch = bytes[i];
            if (ch >= 32 && ch <= 126) {
                if (current.length === 0) startOffset = i;
                current += String.fromCharCode(ch);
            } else {
                if (current.length >= minLen) {
                    strings.push({ offset: startOffset, value: current });
                }
                current = '';
            }
        }
        if (current.length >= minLen) {
            strings.push({ offset: startOffset, value: current });
        }

        analysisData.strings = strings;

        if (strings.length === 0) {
            container.innerHTML = '<div class="no-data"><div class="icon">📝</div>No readable strings found</div>';
            return;
        }

        var html = '<div style="margin-bottom:12px;color:var(--text-secondary);font-size:0.85rem">Found <strong>' + strings.length + '</strong> readable strings (min ' + minLen + ' chars)</div>';
        html += '<div class="strings-list">';

        // Show first 200 strings
        var limit = Math.min(strings.length, 200);
        for (var s = 0; s < limit; s++) {
            html += '<div class="string-entry">';
            html += '<span class="string-offset">0x' + strings[s].offset.toString(16).padStart(8, '0') + '</span>';
            html += '<span class="string-value">' + escapeHtml(strings[s].value) + '</span>';
            html += '</div>';
        }

        if (strings.length > 200) {
            html += '<div style="padding:12px;color:var(--text-muted);text-align:center">... and ' + (strings.length - 200) + ' more strings</div>';
        }

        html += '</div>';
        container.innerHTML = html;
    }

    // ===== EXPORT =====
    exportJsonBtn.addEventListener('click', function () {
        var json = JSON.stringify(analysisData, null, 2);
        downloadFile(json, (analysisData.fileName || 'analysis') + '_report.json', 'application/json');
    });

    exportTxtBtn.addEventListener('click', function () {
        var text = generateTextReport();
        downloadFile(text, (analysisData.fileName || 'analysis') + '_report.txt', 'text/plain');
    });

    function generateTextReport() {
        var lines = [];
        lines.push('═══════════════════════════════════════════');
        lines.push('  RENG - Image Reverse Engineering Report');
        lines.push('═══════════════════════════════════════════');
        lines.push('');
        lines.push('Generated: ' + new Date().toISOString());
        lines.push('');

        lines.push('── FILE INFO ──');
        lines.push('Name:       ' + (analysisData.fileName || 'N/A'));
        lines.push('Size:       ' + formatBytes(analysisData.fileSize || 0));
        lines.push('Type:       ' + (analysisData.fileType || 'N/A'));
        lines.push('Dimensions: ' + (analysisData.width || '?') + ' × ' + (analysisData.height || '?') + ' px');
        lines.push('Megapixels: ' + (analysisData.megapixels || 'N/A'));
        lines.push('');

        if (analysisData.magic) {
            lines.push('── MAGIC BYTES ──');
            lines.push('Signature:   ' + analysisData.magic.signature);
            lines.push('Description: ' + analysisData.magic.description);
            lines.push('');
        }

        if (analysisData.hashes) {
            lines.push('── HASHES ──');
            lines.push('MD5:    ' + analysisData.hashes.md5);
            lines.push('SHA-1:  ' + analysisData.hashes.sha1);
            lines.push('SHA-256:' + analysisData.hashes.sha256);
            lines.push('');
        }

        if (analysisData.exif && Object.keys(analysisData.exif).length > 0) {
            lines.push('── EXIF DATA ──');
            for (var key in analysisData.exif) {
                if (key === 'thumbnail' || key === 'MakerNote') continue;
                lines.push(key + ': ' + analysisData.exif[key]);
            }
            lines.push('');
        }

        if (analysisData.gps) {
            lines.push('── GPS ──');
            lines.push('Latitude:  ' + analysisData.gps.lat.toFixed(6));
            lines.push('Longitude: ' + analysisData.gps.lon.toFixed(6));
            lines.push('Map: https://www.google.com/maps?q=' + analysisData.gps.lat + ',' + analysisData.gps.lon);
            lines.push('');
        }

        if (analysisData.colors) {
            lines.push('── COLOR ANALYSIS ──');
            lines.push('Average Color: ' + rgbToHex(analysisData.colors.averageColor.r, analysisData.colors.averageColor.g, analysisData.colors.averageColor.b));
            lines.push('Brightness: ' + analysisData.colors.brightness + '/255');
            lines.push('Dominant Colors:');
            analysisData.colors.dominantColors.forEach(function (c, i) {
                lines.push('  ' + (i + 1) + '. ' + rgbToHex(c.r, c.g, c.b) + ' (' + ((c.count / analysisData.colors.pixelCount) * 100).toFixed(1) + '%)');
            });
            lines.push('');
        }

        if (analysisData.strings && analysisData.strings.length > 0) {
            lines.push('── STRINGS (' + analysisData.strings.length + ' found) ──');
            analysisData.strings.slice(0, 50).forEach(function (s) {
                lines.push('  0x' + s.offset.toString(16).padStart(8, '0') + '  ' + s.value);
            });
            if (analysisData.strings.length > 50) lines.push('  ... and ' + (analysisData.strings.length - 50) + ' more');
        }

        lines.push('');
        lines.push('═══════════════════════════════════════════');
        lines.push('  Report generated by RENG');
        lines.push('═══════════════════════════════════════════');

        return lines.join('\n');
    }

    function downloadFile(content, filename, type) {
        var blob = new Blob([content], { type: type });
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
        showToast('Report downloaded: ' + filename);
    }

    // ===== UTILITIES =====
    function formatBytes(bytes) {
        if (bytes === 0) return '0 B';
        var k = 1024;
        var sizes = ['B', 'KB', 'MB', 'GB'];
        var i = Math.floor(Math.log(bytes) / Math.log(k));
        return (bytes / Math.pow(k, i)).toFixed(2) + ' ' + sizes[i];
    }

    function escapeHtml(str) {
        if (typeof str !== 'string') return String(str);
        return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    function showToast(message) {
        var existing = document.querySelector('.toast');
        if (existing) existing.remove();
        var toast = document.createElement('div');
        toast.className = 'toast';
        toast.textContent = message;
        document.body.appendChild(toast);
        setTimeout(function () { toast.remove(); }, 3000);
    }
})();
