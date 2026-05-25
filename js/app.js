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
        document.getElementById('search-content').innerHTML = '<p class="loading">Preparing reverse search links</p>';
        document.getElementById('platform-content').innerHTML = '<p class="loading">Analyzing image for platform signatures</p>';
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
        detectPlatform();
        buildReverseSearch();
        fetchVisitorInfo();
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

            // Section separator - Device & Personal Info
            grid.innerHTML += '<div class="info-section-header">📱 Device & Personal Info</div>';

            // Device info from User-Agent and browser APIs
            var deviceInfo = getDeviceInfo();
            analysisData.deviceInfo = deviceInfo;

            var deviceCards = [
                { label: '⏰ Current Time', value: new Date().toLocaleString() },
                { label: '📱 Device', value: deviceInfo.device, highlight: true },
                { label: '💻 OS / Platform', value: deviceInfo.os, highlight: true },
                { label: '🌐 Browser', value: deviceInfo.browser },
                { label: '📐 Screen Resolution', value: screen.width + ' × ' + screen.height + ' px' },
                { label: '📏 Viewport Size', value: window.innerWidth + ' × ' + window.innerHeight + ' px' },
                { label: '🔋 Battery', value: '<span class="loading-dots">Checking...</span>', id: 'battery-card' },
                { label: '🌍 Language', value: navigator.language || navigator.userLanguage || 'Unknown' },
                { label: '🔌 Connection', value: getConnectionInfo() },
                { label: '🖥️ CPU Cores', value: navigator.hardwareConcurrency ? navigator.hardwareConcurrency + ' cores' : 'Unknown' },
                { label: '💾 RAM (approx)', value: navigator.deviceMemory ? navigator.deviceMemory + ' GB' : 'Unknown' },
                { label: '📺 Pixel Ratio', value: window.devicePixelRatio ? window.devicePixelRatio.toFixed(1) + 'x' : 'Unknown' },
                { label: '🎯 Touch Support', value: ('ontouchstart' in window || navigator.maxTouchPoints > 0) ? 'Yes (' + (navigator.maxTouchPoints || 1) + ' points)' : 'No' },
                { label: '🔒 Secure Context', value: window.isSecureContext ? 'Yes (HTTPS)' : 'No (HTTP)' },
                { label: '📡 Online Status', value: navigator.onLine ? '🟢 Online' : '🔴 Offline' },
            ];

            grid.innerHTML += deviceCards.map(function (c) {
                var idAttr = c.id ? ' id="' + c.id + '"' : '';
                return '<div class="info-card"' + idAttr + '><div class="label">' + c.label + '</div><div class="value' + (c.highlight ? ' highlight' : '') + '">' + c.value + '</div></div>';
            }).join('');

            // Battery info (async)
            if (navigator.getBattery) {
                navigator.getBattery().then(function (battery) {
                    var batteryCard = document.getElementById('battery-card');
                    if (batteryCard) {
                        var level = Math.round(battery.level * 100);
                        var charging = battery.charging ? ' ⚡ Charging' : ' 🔋 Discharging';
                        var icon = level > 80 ? '🟢' : (level > 30 ? '🟡' : '🔴');
                        batteryCard.querySelector('.value').innerHTML = icon + ' ' + level + '%' + charging;
                        analysisData.deviceInfo.battery = level + '%' + (battery.charging ? ' (Charging)' : '');
                    }
                });
            }

            // Section separator - Network & Location
            grid.innerHTML += '<div class="info-section-header">🌐 Network & Location</div>';

            // Add visitor info placeholder cards
            grid.innerHTML += '<div class="info-card" id="ip-card"><div class="label">🔗 Your IP Address</div><div class="value"><span class="loading-dots">Fetching...</span></div></div>';
            grid.innerHTML += '<div class="info-card" id="location-card"><div class="label">📍 Your Location</div><div class="value"><span class="loading-dots">Requesting...</span></div></div>';
            grid.innerHTML += '<div class="info-card" id="isp-card"><div class="label">🏢 ISP / Network</div><div class="value"><span class="loading-dots">Fetching...</span></div></div>';
            grid.innerHTML += '<div class="info-card" id="timezone-card"><div class="label">🕐 Timezone</div><div class="value"><span class="loading-dots">Fetching...</span></div></div>';
        };
        img.src = URL.createObjectURL(currentFile);
    }

    // Get device info from User-Agent
    function getDeviceInfo() {
        var ua = navigator.userAgent;
        var info = { device: 'Unknown', os: 'Unknown', browser: 'Unknown', userAgent: ua };

        // Detect OS
        if (/Android\s([\d.]+)/.test(ua)) {
            info.os = 'Android ' + RegExp.$1;
        } else if (/iPhone OS ([\d_]+)/.test(ua)) {
            info.os = 'iOS ' + RegExp.$1.replace(/_/g, '.');
        } else if (/iPad.*OS ([\d_]+)/.test(ua)) {
            info.os = 'iPadOS ' + RegExp.$1.replace(/_/g, '.');
        } else if (/Windows NT ([\d.]+)/.test(ua)) {
            var winVer = { '10.0': '10/11', '6.3': '8.1', '6.2': '8', '6.1': '7' };
            info.os = 'Windows ' + (winVer[RegExp.$1] || RegExp.$1);
        } else if (/Mac OS X ([\d_]+)/.test(ua)) {
            info.os = 'macOS ' + RegExp.$1.replace(/_/g, '.');
        } else if (/Linux/.test(ua)) {
            info.os = 'Linux';
        } else if (/CrOS/.test(ua)) {
            info.os = 'Chrome OS';
        }

        // Detect Device Model
        if (/Android/.test(ua)) {
            var modelMatch = ua.match(/;\s*([^;)]+)\s*Build\//);
            if (modelMatch) {
                info.device = modelMatch[1].trim();
            } else {
                info.device = 'Android Device';
            }
        } else if (/iPhone/.test(ua)) {
            info.device = 'iPhone';
        } else if (/iPad/.test(ua)) {
            info.device = 'iPad';
        } else if (/Macintosh/.test(ua)) {
            info.device = 'Mac';
        } else if (/Windows/.test(ua)) {
            info.device = 'Windows PC';
        } else {
            info.device = 'Unknown Device';
        }

        // Detect Browser
        if (/EdgA?\/([\d.]+)/.test(ua)) {
            info.browser = 'Microsoft Edge ' + RegExp.$1;
        } else if (/OPR\/([\d.]+)/.test(ua)) {
            info.browser = 'Opera ' + RegExp.$1;
        } else if (/SamsungBrowser\/([\d.]+)/.test(ua)) {
            info.browser = 'Samsung Internet ' + RegExp.$1;
        } else if (/UCBrowser\/([\d.]+)/.test(ua)) {
            info.browser = 'UC Browser ' + RegExp.$1;
        } else if (/Firefox\/([\d.]+)/.test(ua)) {
            info.browser = 'Firefox ' + RegExp.$1;
        } else if (/Chrome\/([\d.]+)/.test(ua)) {
            info.browser = 'Chrome ' + RegExp.$1;
        } else if (/Safari\/([\d.]+)/.test(ua) && /Version\/([\d.]+)/.test(ua)) {
            info.browser = 'Safari ' + RegExp.$1;
        } else {
            info.browser = 'Unknown Browser';
        }

        return info;
    }

    // Get network connection info
    function getConnectionInfo() {
        if (navigator.connection) {
            var conn = navigator.connection;
            var info = conn.effectiveType ? conn.effectiveType.toUpperCase() : '';
            if (conn.downlink) info += ' (' + conn.downlink + ' Mbps)';
            if (conn.type) info = conn.type + ' - ' + info;
            return info || 'Connected';
        }
        return navigator.onLine ? 'Online' : 'Offline';
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

    // --- Platform Detection ---
    function detectPlatform() {
        var container = document.getElementById('platform-content');
        var bytes = new Uint8Array(currentArrayBuffer);
        var allStrings = extractAllStrings(bytes, 3);
        var joinedStrings = allStrings.map(function (s) { return s.value; }).join(' ');
        var fileName = analysisData.fileName || '';
        var fileSize = analysisData.fileSize || 0;
        var fileType = analysisData.fileType || '';

        var img = new Image();
        img.onload = function () {
            var w = img.naturalWidth;
            var h = img.naturalHeight;
            var detections = [];

            // --- Instagram Detection ---
            var instaEvidence = [];
            if (joinedStrings.match(/instagram/i)) instaEvidence.push('String "Instagram" found in binary');
            if (fileName.match(/^\d+_\d+_\d+_\d+_\d+_n\./i)) instaEvidence.push('Instagram filename pattern (fbid format)');
            if (fileName.match(/^(IMG|VID)_\d{8}_\d{6}/)) instaEvidence.push('Mobile camera naming (common Instagram source)');
            if (w === 1080 && h === 1080) instaEvidence.push('Square 1080×1080 (Instagram post size)');
            if (w === 1080 && h === 1350) instaEvidence.push('Portrait 1080×1350 (Instagram portrait)');
            if (w === 1080 && h === 608) instaEvidence.push('Landscape 1080×608 (Instagram landscape)');
            if (w === 1080 && h === 1920) instaEvidence.push('Story 1080×1920 (Instagram/FB story)');
            if (joinedStrings.match(/Insta(gram)?/i) && !joinedStrings.match(/instagram\.com/i)) instaEvidence.push('Embedded Instagram metadata');
            if (instaEvidence.length > 0) {
                detections.push({
                    platform: 'Instagram', cssClass: 'instagram', icon: 'IG',
                    confidence: instaEvidence.length >= 2 ? 'high' : 'medium',
                    evidence: instaEvidence,
                    details: buildPlatformDetails(w, h, fileSize, fileType, joinedStrings, 'Instagram')
                });
            }

            // --- Facebook Detection ---
            var fbEvidence = [];
            if (joinedStrings.match(/facebook/i)) fbEvidence.push('String "Facebook" found in binary');
            if (fileName.match(/^\d+_\d+_\d+_n\./)) fbEvidence.push('Facebook CDN filename pattern');
            if (fileName.match(/^FB_IMG_/i)) fbEvidence.push('Facebook image download naming');
            if (joinedStrings.match(/FBMD/i)) fbEvidence.push('Facebook metadata marker (FBMD)');
            if (joinedStrings.match(/FBAN/i)) fbEvidence.push('Facebook app marker (FBAN)');
            if (joinedStrings.match(/fbcdn/i)) fbEvidence.push('Facebook CDN reference');
            var fbSizes = [[720,720],[960,960],[2048,2048],[851,315]];
            fbSizes.forEach(function (s) {
                if (w === s[0] && h === s[1]) fbEvidence.push('Facebook standard size ' + w + '×' + h);
            });
            if (fbEvidence.length > 0) {
                detections.push({
                    platform: 'Facebook', cssClass: 'facebook', icon: 'FB',
                    confidence: fbEvidence.length >= 2 ? 'high' : 'medium',
                    evidence: fbEvidence,
                    details: buildPlatformDetails(w, h, fileSize, fileType, joinedStrings, 'Facebook')
                });
            }

            // --- Twitter/X Detection ---
            var twEvidence = [];
            if (joinedStrings.match(/twitter/i)) twEvidence.push('String "Twitter" found in binary');
            if (fileName.match(/^(E|F|G)[A-Za-z0-9_-]{13}\./)) twEvidence.push('Twitter media ID pattern');
            if (fileName.match(/media\/F/)) twEvidence.push('Twitter media URL pattern');
            if (joinedStrings.match(/tweetdeck|tweetbot/i)) twEvidence.push('Twitter client marker');
            var twSizes = [[1200,675],[1200,1200],[1500,500],[800,418],[400,400]];
            twSizes.forEach(function (s) {
                if (w === s[0] && h === s[1]) twEvidence.push('Twitter standard size ' + w + '×' + h);
            });
            if (twEvidence.length > 0) {
                detections.push({
                    platform: 'Twitter / X', cssClass: 'twitter', icon: 'X',
                    confidence: twEvidence.length >= 2 ? 'high' : 'medium',
                    evidence: twEvidence,
                    details: buildPlatformDetails(w, h, fileSize, fileType, joinedStrings, 'Twitter')
                });
            }

            // --- WhatsApp Detection ---
            var waEvidence = [];
            if (joinedStrings.match(/whatsapp/i)) waEvidence.push('String "WhatsApp" found in binary');
            if (fileName.match(/^IMG-\d{8}-WA\d{4}/)) waEvidence.push('WhatsApp image naming (IMG-date-WAnnnn)');
            if (fileName.match(/^VID-\d{8}-WA\d{4}/)) waEvidence.push('WhatsApp video naming');
            if (fileType === 'image/jpeg' && fileSize < 100000 && w <= 1600) waEvidence.push('WhatsApp-style JPEG compression (small file)');
            if (w === 1600 && h === 1200) waEvidence.push('WhatsApp standard resize 1600×1200');
            if (joinedStrings.match(/WHATSAPP/i)) waEvidence.push('WhatsApp embedded metadata');
            if (waEvidence.length > 0) {
                detections.push({
                    platform: 'WhatsApp', cssClass: 'whatsapp', icon: 'WA',
                    confidence: waEvidence.length >= 2 ? 'high' : 'medium',
                    evidence: waEvidence,
                    details: buildPlatformDetails(w, h, fileSize, fileType, joinedStrings, 'WhatsApp')
                });
            }

            // --- Telegram Detection ---
            var tgEvidence = [];
            if (joinedStrings.match(/telegram/i)) tgEvidence.push('String "Telegram" found in binary');
            if (fileName.match(/^photo_\d{4}-\d{2}-\d{2}/)) tgEvidence.push('Telegram photo naming pattern');
            if (fileName.match(/^file_\d+/)) tgEvidence.push('Telegram file naming pattern');
            if (w === 1280 && h === 1280) tgEvidence.push('Telegram max resize 1280×1280');
            if (tgEvidence.length > 0) {
                detections.push({
                    platform: 'Telegram', cssClass: 'telegram', icon: 'TG',
                    confidence: tgEvidence.length >= 2 ? 'high' : 'medium',
                    evidence: tgEvidence,
                    details: buildPlatformDetails(w, h, fileSize, fileType, joinedStrings, 'Telegram')
                });
            }

            // --- Snapchat Detection ---
            var snapEvidence = [];
            if (joinedStrings.match(/snapchat/i)) snapEvidence.push('String "Snapchat" found in binary');
            if (w === 1080 && h === 1920) snapEvidence.push('Snap size 1080×1920 (also used by IG Stories)');
            if (fileName.match(/^Snapchat/i)) snapEvidence.push('Snapchat filename prefix');
            if (joinedStrings.match(/snap/i) && joinedStrings.match(/Snap Inc/i)) snapEvidence.push('Snap Inc. metadata');
            if (snapEvidence.length > 0) {
                detections.push({
                    platform: 'Snapchat', cssClass: 'snapchat', icon: 'SC',
                    confidence: snapEvidence.length >= 2 ? 'high' : 'medium',
                    evidence: snapEvidence,
                    details: buildPlatformDetails(w, h, fileSize, fileType, joinedStrings, 'Snapchat')
                });
            }

            // --- Pinterest Detection ---
            var pinEvidence = [];
            if (joinedStrings.match(/pinterest/i)) pinEvidence.push('String "Pinterest" found in binary');
            if (fileName.match(/^\d{18,}\./)) pinEvidence.push('Pinterest long numeric ID pattern');
            if (w === 736 || w === 564 || w === 474) pinEvidence.push('Pinterest standard width: ' + w + 'px');
            if (pinEvidence.length > 0) {
                detections.push({
                    platform: 'Pinterest', cssClass: 'pinterest', icon: 'P',
                    confidence: pinEvidence.length >= 2 ? 'high' : 'medium',
                    evidence: pinEvidence,
                    details: buildPlatformDetails(w, h, fileSize, fileType, joinedStrings, 'Pinterest')
                });
            }

            // --- TikTok Detection ---
            var ttEvidence = [];
            if (joinedStrings.match(/tiktok/i)) ttEvidence.push('String "TikTok" found in binary');
            if (joinedStrings.match(/musical\.?ly/i)) ttEvidence.push('Musical.ly (old TikTok) marker');
            if (w === 1080 && h === 1920) ttEvidence.push('TikTok video size 1080×1920');
            if (fileName.match(/^tiktok/i)) ttEvidence.push('TikTok filename prefix');
            if (ttEvidence.length > 0) {
                detections.push({
                    platform: 'TikTok', cssClass: 'tiktok', icon: 'TT',
                    confidence: ttEvidence.length >= 2 ? 'high' : 'medium',
                    evidence: ttEvidence,
                    details: buildPlatformDetails(w, h, fileSize, fileType, joinedStrings, 'TikTok')
                });
            }

            // --- Reddit Detection ---
            var redditEvidence = [];
            if (joinedStrings.match(/reddit/i)) redditEvidence.push('String "Reddit" found in binary');
            if (fileName.match(/^[a-z0-9]{10,13}\./)) redditEvidence.push('Reddit-style short hash filename');
            if (joinedStrings.match(/redd\.it/i)) redditEvidence.push('Reddit CDN reference (redd.it)');
            if (redditEvidence.length > 0) {
                detections.push({
                    platform: 'Reddit', cssClass: 'reddit', icon: 'R',
                    confidence: redditEvidence.length >= 2 ? 'high' : 'medium',
                    evidence: redditEvidence,
                    details: buildPlatformDetails(w, h, fileSize, fileType, joinedStrings, 'Reddit')
                });
            }

            // --- YouTube Detection ---
            var ytEvidence = [];
            if (joinedStrings.match(/youtube/i)) ytEvidence.push('String "YouTube" found in binary');
            var ytSizes = [[1280,720],[1920,1080],[480,360],[640,480],[320,180]];
            ytSizes.forEach(function (s) {
                if (w === s[0] && h === s[1]) ytEvidence.push('YouTube thumbnail size ' + w + '×' + h);
            });
            if (fileName.match(/^(maxresdefault|hqdefault|mqdefault|sddefault)/)) ytEvidence.push('YouTube thumbnail filename');
            if (ytEvidence.length > 0) {
                detections.push({
                    platform: 'YouTube', cssClass: 'youtube', icon: 'YT',
                    confidence: ytEvidence.length >= 2 ? 'high' : 'medium',
                    evidence: ytEvidence,
                    details: buildPlatformDetails(w, h, fileSize, fileType, joinedStrings, 'YouTube')
                });
            }

            // --- Camera / Original Photo Detection ---
            var camEvidence = [];
            if (analysisData.exif && Object.keys(analysisData.exif).length > 5) camEvidence.push('Rich EXIF data present (' + Object.keys(analysisData.exif).length + ' tags)');
            if (analysisData.exif && analysisData.exif.Make) camEvidence.push('Camera: ' + analysisData.exif.Make + ' ' + (analysisData.exif.Model || ''));
            if (analysisData.exif && analysisData.exif.Software) {
                camEvidence.push('Software: ' + analysisData.exif.Software);
            }
            if (analysisData.gps) camEvidence.push('GPS coordinates present');
            if (fileSize > 1000000 && fileType === 'image/jpeg') camEvidence.push('Large JPEG (' + formatBytes(fileSize) + ') suggests original photo');
            if (camEvidence.length > 0) {
                detections.push({
                    platform: 'Camera / Original Photo', cssClass: 'camera', icon: '📷',
                    confidence: camEvidence.length >= 3 ? 'high' : camEvidence.length >= 2 ? 'medium' : 'low',
                    evidence: camEvidence,
                    details: buildPlatformDetails(w, h, fileSize, fileType, joinedStrings, 'Camera')
                });
            }

            // --- Screenshot Detection ---
            var ssEvidence = [];
            if (fileName.match(/^Screenshot/i)) ssEvidence.push('Filename starts with "Screenshot"');
            if (fileName.match(/^Screen\s?Shot/i)) ssEvidence.push('macOS screenshot naming');
            if (fileName.match(/^Screenshot_\d{4}-\d{2}-\d{2}/)) ssEvidence.push('Android screenshot pattern (Screenshot_date)');
            if (fileName.match(/^Screenshot_\d{4}-\d{2}-\d{2}-\d{2}-\d{2}-\d{2}-\d+_/)) ssEvidence.push('Android screenshot with timestamp');
            // Detect app package name from Android screenshot filename
            var appMatch = fileName.match(/Screenshot_[\d-]+_(com\.[a-zA-Z0-9_.]+)/);
            if (appMatch) {
                var pkg = appMatch[1];
                ssEvidence.push('Source app: ' + pkg);
                var appNames = {
                    'com.instagram.android': 'Instagram App',
                    'com.facebook.katana': 'Facebook App',
                    'com.facebook.orca': 'Facebook Messenger',
                    'com.facebook.lite': 'Facebook Lite',
                    'com.twitter.android': 'Twitter/X App',
                    'com.whatsapp': 'WhatsApp',
                    'com.snapchat.android': 'Snapchat',
                    'org.telegram.messenger': 'Telegram',
                    'com.zhiliaoapp.musically': 'TikTok',
                    'com.pinterest': 'Pinterest',
                    'com.google.android.youtube': 'YouTube',
                    'com.linkedin.android': 'LinkedIn',
                    'com.reddit.frontpage': 'Reddit',
                    'com.microsoft.emmx': 'Microsoft Edge',
                    'com.microsoft.emmx.beta': 'Microsoft Edge Beta',
                    'com.android.chrome': 'Google Chrome',
                    'com.brave.browser': 'Brave Browser',
                    'org.mozilla.firefox': 'Firefox',
                    'com.opera.browser': 'Opera Browser',
                    'com.UCMobile.intl': 'UC Browser',
                    'com.samsung.android.app.sbrowser': 'Samsung Internet',
                    'com.google.android.apps.photos': 'Google Photos',
                    'com.google.android.gm': 'Gmail',
                    'com.google.android.apps.maps': 'Google Maps'
                };
                if (appNames[pkg]) ssEvidence.push('App identified: ' + appNames[pkg]);
                else if (pkg.match(/\.beta$/)) ssEvidence.push('App identified: Beta version of ' + pkg.replace('.beta', ''));
            }
            if (fileName.match(/^Capture/i)) ssEvidence.push('Windows screenshot ("Capture" prefix)');
            if (fileType === 'image/png' && !analysisData.exif) ssEvidence.push('PNG without EXIF (typical for screenshots)');
            if (fileType === 'image/png' && analysisData.exif && Object.keys(analysisData.exif).length <= 3) ssEvidence.push('PNG with minimal EXIF (screenshot-like)');
            // Common Android screenshot resolutions
            var androidScreens = [[1080,2400],[1080,2340],[1080,2412],[1080,1920],[1440,3200],[1440,3120],[720,1600],[720,1280],[1080,2460],[2400,1080],[2340,1080]];
            androidScreens.forEach(function (s) {
                if (w === s[0] && h === s[1]) ssEvidence.push('Android screen resolution ' + w + '×' + h);
            });
            // Common iPhone screenshot resolutions
            var iphoneScreens = [[1170,2532],[1179,2556],[1284,2778],[1290,2796],[750,1334],[1125,2436],[828,1792],[1242,2688],[1080,1920]];
            iphoneScreens.forEach(function (s) {
                if (w === s[0] && h === s[1]) ssEvidence.push('iPhone screen resolution ' + w + '×' + h);
            });
            if (ssEvidence.length > 0) {
                detections.push({
                    platform: 'Screenshot', cssClass: 'screenshot', icon: '📸',
                    confidence: ssEvidence.length >= 3 ? 'high' : ssEvidence.length >= 2 ? 'medium' : 'low',
                    evidence: ssEvidence,
                    details: buildPlatformDetails(w, h, fileSize, fileType, joinedStrings, 'Screenshot')
                });
            }

            // --- Photoshop Detection ---
            var psEvidence = [];
            if (joinedStrings.match(/photoshop/i)) psEvidence.push('String "Photoshop" found in binary');
            if (joinedStrings.match(/Adobe/i)) psEvidence.push('Adobe software marker');
            if (joinedStrings.match(/8BIM/)) psEvidence.push('Photoshop 8BIM marker in binary');
            if (joinedStrings.match(/Lightroom/i)) psEvidence.push('Adobe Lightroom marker');
            if (joinedStrings.match(/GIMP/i)) psEvidence.push('GIMP editing marker');
            if (psEvidence.length > 0) {
                detections.push({
                    platform: 'Edited (Photoshop/Adobe/GIMP)', cssClass: 'photoshop', icon: 'PS',
                    confidence: psEvidence.length >= 2 ? 'high' : 'medium',
                    evidence: psEvidence,
                    details: buildPlatformDetails(w, h, fileSize, fileType, joinedStrings, 'Photoshop')
                });
            }

            // Sort by confidence
            var confOrder = { high: 0, medium: 1, low: 2 };
            detections.sort(function (a, b) {
                return (confOrder[a.confidence] || 2) - (confOrder[b.confidence] || 2);
            });

            // Build forwarding chain
            var chain = buildForwardingChain(detections, w, h, fileSize, fileType, joinedStrings, fileName);

            analysisData.platformDetections = detections;
            analysisData.forwardingChain = chain;
            renderPlatformResults(container, detections, w, h, chain);
        };
        img.src = URL.createObjectURL(currentFile);
    }

    function extractAllStrings(bytes, minLen) {
        var strings = [];
        var current = '';
        var startOffset = 0;
        for (var i = 0; i < bytes.length; i++) {
            var ch = bytes[i];
            if (ch >= 32 && ch <= 126) {
                if (current.length === 0) startOffset = i;
                current += String.fromCharCode(ch);
            } else {
                if (current.length >= minLen) strings.push({ offset: startOffset, value: current });
                current = '';
            }
        }
        if (current.length >= minLen) strings.push({ offset: startOffset, value: current });
        return strings;
    }

    function buildPlatformDetails(w, h, fileSize, fileType, joinedStrings, platform) {
        var details = [];
        details.push({ label: 'Image Size', value: w + ' × ' + h + ' px' });
        details.push({ label: 'File Size', value: formatBytes(fileSize) });
        details.push({ label: 'Format', value: fileType });

        // Extract software info from EXIF
        if (analysisData.exif) {
            if (analysisData.exif.Software) details.push({ label: 'Software', value: String(analysisData.exif.Software) });
            if (analysisData.exif.Make) details.push({ label: 'Device', value: analysisData.exif.Make + ' ' + (analysisData.exif.Model || '') });
            if (analysisData.exif.DateTimeOriginal) details.push({ label: 'Date Taken', value: String(analysisData.exif.DateTimeOriginal) });
            if (analysisData.exif.DateTime) details.push({ label: 'Modified Date', value: String(analysisData.exif.DateTime) });
            if (analysisData.exif.Artist) details.push({ label: 'Artist/Author', value: String(analysisData.exif.Artist) });
            if (analysisData.exif.Copyright) details.push({ label: 'Copyright', value: String(analysisData.exif.Copyright) });
        }

        // Extract usernames/handles from strings
        var handles = [];
        var handleRegex = /@[a-zA-Z0-9_.]{2,30}/g;
        var match;
        while ((match = handleRegex.exec(joinedStrings)) !== null) {
            if (handles.indexOf(match[0]) === -1) handles.push(match[0]);
        }
        if (handles.length > 0) {
            details.push({ label: 'Usernames Found', value: handles.join(', ') });
        }

        // Extract URLs
        var urls = [];
        var urlRegex = /https?:\/\/[a-zA-Z0-9.\-\/_%?=&#]+/g;
        while ((match = urlRegex.exec(joinedStrings)) !== null) {
            if (urls.length < 5 && urls.indexOf(match[0]) === -1) urls.push(match[0]);
        }
        if (urls.length > 0) {
            details.push({ label: 'URLs Found', value: urls.join(' | ') });
        }

        // GPS if available
        if (analysisData.gps) {
            details.push({ label: 'GPS Location', value: analysisData.gps.lat.toFixed(6) + ', ' + analysisData.gps.lon.toFixed(6) });
        }

        return details;
    }

    function buildForwardingChain(detections, w, h, fileSize, fileType, joinedStrings, fileName) {
        if (detections.length <= 1) return null;

        var platformNames = detections.map(function (d) { return d.platform; });
        var chain = [];
        var hasOriginal = false;
        var hasEditor = false;
        var hasMessenger = false;
        var hasSocialMedia = false;

        // Categorize detected platforms
        var originals = ['Camera / Original Photo'];
        var editors = ['Edited (Photoshop/Adobe/GIMP)'];
        var screenshots = ['Screenshot'];
        var messengers = ['WhatsApp', 'Telegram', 'Snapchat'];
        var socialMedia = ['Instagram', 'Facebook', 'Twitter / X', 'Pinterest', 'TikTok', 'Reddit', 'YouTube', 'LinkedIn'];

        detections.forEach(function (d) {
            if (originals.indexOf(d.platform) !== -1) hasOriginal = true;
            if (editors.indexOf(d.platform) !== -1) hasEditor = true;
            if (messengers.indexOf(d.platform) !== -1) hasMessenger = true;
            if (socialMedia.indexOf(d.platform) !== -1) hasSocialMedia = true;
        });

        // Build the chain in logical order
        // 1. Original source (camera)
        detections.forEach(function (d) {
            if (originals.indexOf(d.platform) !== -1) {
                chain.push({ platform: d.platform, icon: d.icon, cssClass: d.cssClass, role: 'Origin', desc: 'Image was originally captured here' });
            }
        });

        // 2. Editor (if edited)
        detections.forEach(function (d) {
            if (editors.indexOf(d.platform) !== -1) {
                chain.push({ platform: d.platform, icon: d.icon, cssClass: d.cssClass, role: 'Edited', desc: 'Image was edited/processed' });
            }
        });

        // 2.5 Screenshot (captured from another platform)
        detections.forEach(function (d) {
            if (screenshots.indexOf(d.platform) !== -1) {
                chain.push({ platform: d.platform, icon: d.icon, cssClass: d.cssClass, role: 'Captured', desc: 'Screenshot was taken from this device/app' });
            }
        });

        // 3. Social media (first upload)
        detections.forEach(function (d) {
            if (socialMedia.indexOf(d.platform) !== -1) {
                chain.push({ platform: d.platform, icon: d.icon, cssClass: d.cssClass, role: 'Uploaded', desc: 'Shared on social media' });
            }
        });

        // 4. Messengers (forwarded)
        detections.forEach(function (d) {
            if (messengers.indexOf(d.platform) !== -1) {
                chain.push({ platform: d.platform, icon: d.icon, cssClass: d.cssClass, role: 'Forwarded', desc: 'Forwarded via messenger' });
            }
        });

        // If no original/editor detected, add unknown origin
        if (!hasOriginal && !hasEditor && chain.length > 0) {
            chain.unshift({ platform: 'Unknown Origin', icon: '?', cssClass: 'unknown', role: 'Origin', desc: 'Original source could not be determined' });
        }

        // Determine compression analysis
        var compressionNote = '';
        if (hasMessenger && fileType === 'image/jpeg') {
            if (fileSize < 100000) {
                compressionNote = 'Heavy compression detected — likely forwarded multiple times through messengers. Each forward reduces quality.';
            } else if (fileSize < 300000) {
                compressionNote = 'Moderate compression — image was likely forwarded 1-2 times through a messenger platform.';
            }
        }
        if (hasSocialMedia && hasMessenger) {
            compressionNote += ' Multiple platform traces suggest this image has been shared across social media AND messaging apps.';
        }

        if (chain.length < 2) return null;

        return {
            steps: chain,
            note: compressionNote.trim(),
            multiForward: detections.length >= 3,
            platformCount: detections.length
        };
    }

    function renderPlatformResults(container, detections, w, h, chain) {
        if (detections.length === 0) {
            container.innerHTML = '<div class="no-data"><div class="icon">🔍</div>No specific platform signatures detected.<br><small>This image may be original or from an unrecognized source. Use the Search tab to find it online.</small></div>';
            return;
        }

        var html = '';

        // Forwarding Chain (if multiple platforms detected)
        if (chain && chain.steps.length >= 2) {
            html += '<div class="forwarding-chain-section">';
            html += '<div class="chain-title">Forwarding Chain (Image Journey)</div>';
            if (chain.multiForward) {
                html += '<div class="chain-alert">Multi-forward detected! This image passed through ' + chain.platformCount + ' platforms.</div>';
            }
            html += '<div class="chain-visual">';
            chain.steps.forEach(function (step, idx) {
                html += '<div class="chain-step">';
                html += '<div class="chain-node ' + step.cssClass + '">' + step.icon + '</div>';
                html += '<div class="chain-info">';
                html += '<div class="chain-platform">' + escapeHtml(step.platform) + '</div>';
                html += '<div class="chain-role">' + escapeHtml(step.role) + '</div>';
                html += '<div class="chain-desc">' + escapeHtml(step.desc) + '</div>';
                html += '</div></div>';
                if (idx < chain.steps.length - 1) {
                    html += '<div class="chain-arrow">→</div>';
                }
            });
            html += '</div>';
            if (chain.note) {
                html += '<div class="chain-note">' + escapeHtml(chain.note) + '</div>';
            }
            html += '</div>';
        }

        // Summary bar
        html += '<div class="platform-summary-bar">';
        detections.forEach(function (d) {
            html += '<div class="summary-chip"><span class="dot ' + d.confidence + '"></span>' + escapeHtml(d.platform) + '</div>';
        });
        html += '</div>';

        html += '<div class="platform-results">';
        detections.forEach(function (d) {
            html += '<div class="platform-detected ' + d.confidence + '-confidence">';

            // Header
            html += '<div class="platform-detected-header">';
            html += '<div class="platform-logo ' + d.cssClass + '">' + d.icon + '</div>';
            html += '<div class="platform-name-section">';
            html += '<div class="platform-name">' + escapeHtml(d.platform) + '</div>';
            html += '<span class="platform-confidence ' + d.confidence + '">' + d.confidence.toUpperCase() + ' CONFIDENCE</span>';
            html += '</div></div>';

            // Details
            if (d.details.length > 0) {
                html += '<div class="platform-details">';
                d.details.forEach(function (det) {
                    html += '<div class="platform-detail-item">';
                    html += '<span class="label">' + escapeHtml(det.label) + '</span>';
                    html += '<span class="value">' + escapeHtml(det.value) + '</span>';
                    html += '</div>';
                });
                html += '</div>';
            }

            // Evidence
            html += '<div class="platform-evidence">';
            html += '<div class="platform-evidence-title">Detection Evidence</div>';
            d.evidence.forEach(function (e) {
                html += '<span class="evidence-tag">' + escapeHtml(e) + '</span>';
            });
            html += '</div>';

            html += '</div>';
        });
        html += '</div>';

        container.innerHTML = html;
    }

    // --- Reverse Search ---
    function buildReverseSearch() {
        var container = document.getElementById('search-content');

        // Convert image to base64 data URL for search engines
        var reader = new FileReader();
        reader.onload = function (e) {
            var dataUrl = e.target.result;
            var base64 = dataUrl.split(',')[1];

            var html = '';

            // Note
            html += '<div class="search-note">';
            html += '<strong>Bina API ke Reverse Search:</strong> Niche diye gaye buttons par click karke directly image upload hogi search engine mein. ';
            html += 'Google Lens aur Yandex sabse achha kaam karte hain — ye image se matching profiles, posts aur accounts dhundh sakte hain.';
            html += '</div>';

            // Search Engines section
            html += '<div class="search-section-title">Reverse Image Search Engines</div>';
            html += '<div class="search-grid">';

            html += buildSearchCard('G', 'Google Lens', 'google',
                'Sabse powerful reverse search. Image upload karo aur Google dhundhega ki ye image kahan kahan hai — social media, websites, sab jagah.',
                'search-google');

            html += buildSearchCard('Y', 'Yandex Images', 'yandex',
                'Google se bhi better for faces! Yandex faces aur people ko bhut achhe se dhundh sakta hai. Best for finding social media profiles.',
                'search-yandex');

            html += buildSearchCard('B', 'Bing Visual Search', 'bing',
                'Microsoft ka visual search. Products aur similar images dhundhne ke liye achha hai.',
                'search-bing');

            html += buildSearchCard('T', 'TinEye', 'tineye',
                'Exact match dhundhta hai — kahan kahan ye image use hui hai web par. Oldest match bhi dikha sakta hai.',
                'search-tineye');

            html += '</div>';

            // Social Media section
            html += '<div class="search-section-title">Social Media Search (via Google)</div>';
            html += '<div class="search-note">';
            html += 'Ye buttons Google reverse image search use karte hain specific social media sites par filter karke. ';
            html += 'Sabse achha result ke liye pehle Google Lens ya Yandex try karo.';
            html += '</div>';
            html += '<div class="search-grid">';

            html += buildSearchCard('IG', 'Instagram', 'instagram',
                'Instagram par ye image dhundho. Posts, profiles, aur stories mein search hoga.',
                'search-instagram');

            html += buildSearchCard('FB', 'Facebook', 'facebook',
                'Facebook par ye image dhundho. Profile photos, posts aur pages mein search hoga.',
                'search-facebook');

            html += buildSearchCard('X', 'Twitter / X', 'twitter',
                'Twitter/X par ye image dhundho. Tweets aur profile pictures mein search hoga.',
                'search-twitter');

            html += buildSearchCard('P', 'Pinterest', 'pinterest',
                'Pinterest par matching pins dhundho. Creative content ka original source milega.',
                'search-pinterest');

            html += buildSearchCard('R', 'Reddit', 'reddit',
                'Reddit par ye image dhundho. Posts aur threads mein search hoga.',
                'search-reddit');

            html += buildSearchCard('in', 'LinkedIn', 'linkedin',
                'LinkedIn par ye image dhundho. Professional profiles aur posts mein search hoga.',
                'search-linkedin');

            html += buildSearchCard('TT', 'TikTok', 'tiktok',
                'TikTok par ye image dhundho via Google. Video thumbnails aur profiles mein search hoga.',
                'search-tiktok');

            html += '</div>';

            // Security section
            html += '<div class="search-section-title">Security & Forensics</div>';
            html += '<div class="search-grid">';

            html += buildSearchCard('VT', 'VirusTotal', 'vt',
                'Check karo ki ye file malicious hai ya nahi. SHA-256 hash se lookup hoga.',
                'search-virustotal');

            html += '</div>';

            container.innerHTML = html;
            attachSearchListeners(dataUrl, base64);
        };
        reader.readAsDataURL(currentFile);
    }

    function buildSearchCard(icon, name, btnClass, desc, btnId) {
        var html = '<div class="search-card">';
        html += '<div class="search-card-header">';
        html += '<div class="search-card-icon">' + icon + '</div>';
        html += '<div class="search-card-name">' + name + '</div>';
        html += '</div>';
        html += '<div class="search-card-desc">' + desc + '</div>';
        html += '<button class="search-card-btn ' + btnClass + '" id="' + btnId + '">Search on ' + name + ' &#8599;</button>';
        html += '</div>';
        return html;
    }

    function attachSearchListeners(dataUrl, base64) {
        // Google Lens - direct form POST upload
        document.getElementById('search-google').addEventListener('click', function () {
            uploadToGoogleLens();
        });

        // Yandex - direct form POST upload
        document.getElementById('search-yandex').addEventListener('click', function () {
            uploadToYandex();
        });

        // Bing Visual Search
        document.getElementById('search-bing').addEventListener('click', function () {
            uploadToBing();
        });

        // TinEye - direct form POST upload
        document.getElementById('search-tineye').addEventListener('click', function () {
            uploadToTinEye();
        });

        // Social Media - Google site-restricted reverse image search
        var socialPlatforms = [
            { id: 'search-instagram', site: 'site:instagram.com', name: 'Instagram' },
            { id: 'search-facebook', site: 'site:facebook.com', name: 'Facebook' },
            { id: 'search-twitter', site: 'site:twitter.com OR site:x.com', name: 'Twitter/X' },
            { id: 'search-pinterest', site: 'site:pinterest.com', name: 'Pinterest' },
            { id: 'search-reddit', site: 'site:reddit.com', name: 'Reddit' },
            { id: 'search-linkedin', site: 'site:linkedin.com', name: 'LinkedIn' },
            { id: 'search-tiktok', site: 'site:tiktok.com', name: 'TikTok' }
        ];

        socialPlatforms.forEach(function (p) {
            var el = document.getElementById(p.id);
            if (el) {
                el.addEventListener('click', function () {
                    uploadToGoogleWithSite(p.site, p.name);
                });
            }
        });

        // VirusTotal
        document.getElementById('search-virustotal').addEventListener('click', function () {
            if (analysisData.hashes && analysisData.hashes.sha256) {
                window.open('https://www.virustotal.com/gui/search/' + analysisData.hashes.sha256, '_blank');
            } else {
                showToast('SHA-256 hash not computed yet. Please wait.');
            }
        });
    }

    function uploadToGoogleLens() {
        // Use Google Lens upload via form POST
        var form = document.createElement('form');
        form.method = 'POST';
        form.enctype = 'multipart/form-data';
        form.action = 'https://lens.google.com/v3/upload';
        form.target = '_blank';

        var fileField = document.createElement('input');
        fileField.type = 'file';
        fileField.name = 'encoded_image';
        fileField.style.display = 'none';

        // Create a DataTransfer to set the file
        var dt = new DataTransfer();
        dt.items.add(currentFile);
        fileField.files = dt.files;

        form.appendChild(fileField);
        document.body.appendChild(form);
        form.submit();
        document.body.removeChild(form);
        showToast('Image uploaded to Google Lens! Results will appear in new tab.');
    }

    function uploadToGoogleWithSite(site, name) {
        // Google Lens upload + site restriction hint
        var form = document.createElement('form');
        form.method = 'POST';
        form.enctype = 'multipart/form-data';
        form.action = 'https://lens.google.com/v3/upload?ep=gisbubb&hl=en&re=df&vpw=1200&vph=800&q=' + encodeURIComponent(site);
        form.target = '_blank';

        var fileField = document.createElement('input');
        fileField.type = 'file';
        fileField.name = 'encoded_image';
        fileField.style.display = 'none';

        var dt = new DataTransfer();
        dt.items.add(currentFile);
        fileField.files = dt.files;

        form.appendChild(fileField);
        document.body.appendChild(form);
        form.submit();
        document.body.removeChild(form);
        showToast(name + ' search via Google Lens! Check the results tab.');
    }

    function uploadToYandex() {
        var form = document.createElement('form');
        form.method = 'POST';
        form.enctype = 'multipart/form-data';
        form.action = 'https://yandex.com/images/search?rpt=imageview&format=json&request=%7B%22blocks%22%3A%5B%7B%22block%22%3A%22b-page_type_search-by-image__link%22%7D%5D%7D';
        form.target = '_blank';

        var fileField = document.createElement('input');
        fileField.type = 'file';
        fileField.name = 'upfile';
        fileField.style.display = 'none';

        var dt = new DataTransfer();
        dt.items.add(currentFile);
        fileField.files = dt.files;

        form.appendChild(fileField);
        document.body.appendChild(form);
        form.submit();
        document.body.removeChild(form);
        showToast('Image uploaded to Yandex! Results will show in new tab.');
    }

    function uploadToBing() {
        // Bing Visual Search
        var form = document.createElement('form');
        form.method = 'POST';
        form.enctype = 'multipart/form-data';
        form.action = 'https://www.bing.com/images/search?view=detailv2&iss=sbiupload&FORM=SBIHMP';
        form.target = '_blank';

        var fileField = document.createElement('input');
        fileField.type = 'file';
        fileField.name = 'imageBin';
        fileField.style.display = 'none';

        var dt = new DataTransfer();
        dt.items.add(currentFile);
        fileField.files = dt.files;

        form.appendChild(fileField);
        document.body.appendChild(form);
        form.submit();
        document.body.removeChild(form);
        showToast('Image uploaded to Bing Visual Search!');
    }

    function uploadToTinEye() {
        var form = document.createElement('form');
        form.method = 'POST';
        form.enctype = 'multipart/form-data';
        form.action = 'https://tineye.com/search';
        form.target = '_blank';

        var fileField = document.createElement('input');
        fileField.type = 'file';
        fileField.name = 'image';
        fileField.style.display = 'none';

        var dt = new DataTransfer();
        dt.items.add(currentFile);
        fileField.files = dt.files;

        form.appendChild(fileField);
        document.body.appendChild(form);
        form.submit();
        document.body.removeChild(form);
        showToast('Image uploaded to TinEye! Exact matches will show in new tab.');
    }

    // --- Visitor Info (IP + Location) ---
    function fetchVisitorInfo() {
        // Fetch IP and geo info from free API (no key required)
        fetch('https://ipapi.co/json/')
            .then(function (r) { return r.json(); })
            .then(function (data) {
                analysisData.visitorInfo = data;

                var ipCard = document.getElementById('ip-card');
                if (ipCard) {
                    ipCard.querySelector('.value').innerHTML = '<span class="highlight">' + escapeHtml(data.ip || 'Unknown') + '</span>';
                }

                var ispCard = document.getElementById('isp-card');
                if (ispCard) {
                    ispCard.querySelector('.value').textContent = (data.org || 'Unknown');
                }

                var tzCard = document.getElementById('timezone-card');
                if (tzCard) {
                    tzCard.querySelector('.value').textContent = (data.timezone || 'Unknown');
                }

                // Use API location as fallback
                var locCard = document.getElementById('location-card');
                if (locCard && !analysisData.browserLocation) {
                    var loc = '';
                    if (data.city) loc += data.city;
                    if (data.region) loc += (loc ? ', ' : '') + data.region;
                    if (data.country_name) loc += (loc ? ', ' : '') + data.country_name;
                    locCard.querySelector('.value').innerHTML = escapeHtml(loc || 'Unknown') + ' <small>(via IP)</small>';
                    analysisData.ipLocation = loc;
                }
            })
            .catch(function () {
                // Fallback to secondary API
                fetch('https://api.ipify.org?format=json')
                    .then(function (r) { return r.json(); })
                    .then(function (data) {
                        var ipCard = document.getElementById('ip-card');
                        if (ipCard) {
                            ipCard.querySelector('.value').innerHTML = '<span class="highlight">' + escapeHtml(data.ip || 'Unknown') + '</span>';
                        }
                        analysisData.visitorInfo = { ip: data.ip };
                    })
                    .catch(function () {
                        var ipCard = document.getElementById('ip-card');
                        if (ipCard) {
                            ipCard.querySelector('.value').textContent = 'Could not fetch IP';
                        }
                    });
            });

        // Browser Geolocation API for precise location
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                function (pos) {
                    var lat = pos.coords.latitude;
                    var lon = pos.coords.longitude;
                    var acc = pos.coords.accuracy;
                    analysisData.browserLocation = { lat: lat, lon: lon, accuracy: acc };

                    var locCard = document.getElementById('location-card');
                    if (locCard) {
                        locCard.querySelector('.value').innerHTML =
                            '<a href="https://www.google.com/maps?q=' + lat + ',' + lon + '" target="_blank" style="color:var(--accent);text-decoration:none">' +
                            lat.toFixed(6) + ', ' + lon.toFixed(6) +
                            '</a> <small>(\u00b1' + Math.round(acc) + 'm)</small>';
                    }
                },
                function (err) {
                    var locCard = document.getElementById('location-card');
                    if (locCard && !analysisData.ipLocation) {
                        if (err.code === 1) {
                            locCard.querySelector('.value').innerHTML = '<small>Location permission denied</small>';
                        } else {
                            locCard.querySelector('.value').innerHTML = '<small>Location unavailable</small>';
                        }
                    }
                },
                { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
            );
        } else {
            var locCard = document.getElementById('location-card');
            if (locCard && !analysisData.ipLocation) {
                locCard.querySelector('.value').innerHTML = '<small>Geolocation not supported</small>';
            }
        }
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

        if (analysisData.deviceInfo) {
            lines.push('── DEVICE & PERSONAL INFO ──');
            lines.push('Time:        ' + new Date().toLocaleString());
            lines.push('Device:      ' + (analysisData.deviceInfo.device || 'Unknown'));
            lines.push('OS:          ' + (analysisData.deviceInfo.os || 'Unknown'));
            lines.push('Browser:     ' + (analysisData.deviceInfo.browser || 'Unknown'));
            lines.push('Screen:      ' + screen.width + ' × ' + screen.height + ' px');
            lines.push('Viewport:    ' + window.innerWidth + ' × ' + window.innerHeight + ' px');
            lines.push('Language:    ' + (navigator.language || 'Unknown'));
            lines.push('CPU Cores:   ' + (navigator.hardwareConcurrency || 'Unknown'));
            lines.push('RAM:         ' + (navigator.deviceMemory ? navigator.deviceMemory + ' GB' : 'Unknown'));
            lines.push('Pixel Ratio: ' + (window.devicePixelRatio || 'Unknown') + 'x');
            lines.push('Touch:       ' + (('ontouchstart' in window || navigator.maxTouchPoints > 0) ? 'Yes' : 'No'));
            if (analysisData.deviceInfo.battery) lines.push('Battery:     ' + analysisData.deviceInfo.battery);
            lines.push('User-Agent:  ' + navigator.userAgent);
            lines.push('');
        }

        if (analysisData.visitorInfo || analysisData.browserLocation) {
            lines.push('── NETWORK & LOCATION ──');
            if (analysisData.visitorInfo && analysisData.visitorInfo.ip) lines.push('IP Address: ' + analysisData.visitorInfo.ip);
            if (analysisData.visitorInfo && analysisData.visitorInfo.org) lines.push('ISP: ' + analysisData.visitorInfo.org);
            if (analysisData.visitorInfo && analysisData.visitorInfo.timezone) lines.push('Timezone: ' + analysisData.visitorInfo.timezone);
            if (analysisData.browserLocation) {
                lines.push('GPS Location: ' + analysisData.browserLocation.lat.toFixed(6) + ', ' + analysisData.browserLocation.lon.toFixed(6));
                lines.push('Accuracy: ±' + Math.round(analysisData.browserLocation.accuracy) + 'm');
            } else if (analysisData.ipLocation) {
                lines.push('Location (via IP): ' + analysisData.ipLocation);
            }
            lines.push('');
        }

        if (analysisData.forwardingChain && analysisData.forwardingChain.steps.length >= 2) {
            lines.push('── FORWARDING CHAIN ──');
            var chainStr = analysisData.forwardingChain.steps.map(function (s) { return s.platform + ' (' + s.role + ')'; }).join(' → ');
            lines.push('  ' + chainStr);
            if (analysisData.forwardingChain.note) {
                lines.push('  Note: ' + analysisData.forwardingChain.note);
            }
            lines.push('');
        }

        if (analysisData.platformDetections && analysisData.platformDetections.length > 0) {
            lines.push('── PLATFORM DETECTION ──');
            analysisData.platformDetections.forEach(function (d) {
                lines.push('  ' + d.platform + ' [' + d.confidence.toUpperCase() + ']');
                d.evidence.forEach(function (e) {
                    lines.push('    - ' + e);
                });
                d.details.forEach(function (det) {
                    lines.push('    ' + det.label + ': ' + det.value);
                });
                lines.push('');
            });
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
