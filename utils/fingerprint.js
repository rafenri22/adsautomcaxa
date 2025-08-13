const axios = require('axios');
const crypto = require('crypto');
const generateUserAgent = require('./userAgents.js');

function shuffleArray(arr) {
	const a = arr.slice();
	for (let i = a.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[a[i], a[j]] = [a[j], a[i]];
	}
	return a;
}

// Generate more realistic geolocation based on timezone
function generateGeolocationForTimezone(timezone) {
	const locations = {
		'America/New_York': [40.7128, -74.0060], // NYC
		'America/Los_Angeles': [34.0522, -118.2437], // LA
		'America/Chicago': [41.8781, -87.6298], // Chicago
		'America/Denver': [39.7392, -104.9903], // Denver
		'Europe/London': [51.5074, -0.1278], // London
		'Europe/Paris': [48.8566, 2.3522], // Paris
		'Europe/Berlin': [52.5200, 13.4050], // Berlin
		'Europe/Rome': [41.9028, 12.4964], // Rome
		'Asia/Tokyo': [35.6762, 139.6503], // Tokyo
		'Asia/Shanghai': [31.2304, 121.4737], // Shanghai
		'Asia/Singapore': [1.3521, 103.8198], // Singapore
		'Australia/Sydney': [-33.8688, 151.2093], // Sydney
		'UTC': [40.7128, -74.0060] // Default to NYC for UTC
	};
	
	const coords = locations[timezone] || locations['UTC'];
	// Add small random variation to exact coordinates
	return {
		latitude: coords[0] + (Math.random() * 0.1 - 0.05),
		longitude: coords[1] + (Math.random() * 0.1 - 0.05),
		accuracy: 10 + Math.random() * 90 // Random accuracy between 10-100 meters
	};
}

async function generateFingerprint(proxyURL = '', browserName, deviceCategory) {
	const screenProfiles = [
		{ width: 1920, height: 1080 },
		{ width: 1366, height: 768 },
		{ width: 1536, height: 864 },
		{ width: 1600, height: 900 },
		{ width: 1440, height: 900 },
		{ width: 1280, height: 720 },
		{ width: 2560, height: 1440 }, // 2K
		{ width: 3840, height: 2160 }  // 4K
	];
	
	const languageProfiles = [
		['en-US', 'en'],
		['en-GB', 'en'],
		['fr-FR', 'fr', 'en'],
		['de-DE', 'de', 'en'],
		['es-ES', 'es', 'en'],
		['it-IT', 'it', 'en'],
		['pt-BR', 'pt', 'en'],
		['nl-NL', 'nl', 'en'],
		['ru-RU', 'ru', 'en'],
		['ja-JP', 'ja', 'en'],
		['ko-KR', 'ko', 'en'],
		['zh-CN', 'zh', 'en']
	];
	
	const fontPool = [
		'Arial', 'Helvetica', 'Times New Roman', 'Times', 'Courier New', 'Courier',
		'Verdana', 'Georgia', 'Palatino', 'Garamond', 'Bookman', 'Comic Sans MS',
		'Trebuchet MS', 'Arial Black', 'Impact', 'Lucida Sans Unicode', 
		'Tahoma', 'Lucida Console', 'Monaco', 'Bradley Hand ITC',
		'Brush Script MT', 'Luminari', 'Chalkduster'
	];
	
	const webGLList = [
		{ vendor: 'Intel Inc.', renderer: 'Intel Iris Pro OpenGL Engine' },
		{ vendor: 'NVIDIA Corporation', renderer: 'NVIDIA GeForce RTX 3070/PCIe/SSE2' },
		{ vendor: 'NVIDIA Corporation', renderer: 'NVIDIA GeForce RTX 3060/PCIe/SSE2' },
		{ vendor: 'NVIDIA Corporation', renderer: 'NVIDIA GeForce GTX 1660/PCIe/SSE2' },
		{ vendor: 'AMD', renderer: 'AMD Radeon Pro 5500 XT OpenGL Engine' },
		{ vendor: 'AMD', renderer: 'AMD Radeon RX 580 Series' },
		{ vendor: 'Intel Inc.', renderer: 'Intel HD Graphics 620' },
		{ vendor: 'Intel Inc.', renderer: 'Intel UHD Graphics 630' },
		{ vendor: 'Apple', renderer: 'Apple M1 Pro' },
		{ vendor: 'Apple', renderer: 'Apple M1 Max' }
	];

	const timezones = [
		'America/New_York', 'America/Los_Angeles', 'America/Chicago', 'America/Denver',
		'Europe/London', 'Europe/Paris', 'Europe/Berlin', 'Europe/Rome', 'Europe/Madrid',
		'Asia/Tokyo', 'Asia/Shanghai', 'Asia/Singapore', 'Asia/Kolkata',
		'Australia/Sydney', 'Australia/Melbourne', 'Pacific/Auckland'
	];

	let timezone = timezones[Math.floor(Math.random() * timezones.length)];
	let countryCode = 'US'; // Default
	
	// Try to get timezone and country from proxy, but don't fail if it doesn't work
	if (proxyURL && proxyURL.trim()) {
		try {
			// Extract IP from proxy URL if possible
			const urlMatch = proxyURL.match(/(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})/);
			if (urlMatch) {
				const ip = urlMatch[1];
				const geo = await axios.get(`http://ip-api.com/json/${ip}?fields=timezone,countryCode,country,regionName,city,lat,lon`, { 
					timeout: 3000,
					validateStatus: () => true
				});
				if (geo.data && geo.data.timezone) {
					timezone = geo.data.timezone;
					countryCode = geo.data.countryCode || 'US';
					console.log(`🌍 Location from IP ${ip}: ${geo.data.city}, ${geo.data.regionName}, ${geo.data.country}`);
				}
			}
		} catch (e) {
			console.warn('⚠️ Timezone lookup failed, using random:', e.message);
		}
	}

	const screen = screenProfiles[Math.floor(Math.random() * screenProfiles.length)];
	const languages = languageProfiles[Math.floor(Math.random() * languageProfiles.length)];
	const dpr = [1, 1.25, 1.5, 2][Math.floor(Math.random() * 4)];
	const webgl = webGLList[Math.floor(Math.random() * webGLList.length)];
	const geolocation = generateGeolocationForTimezone(timezone);

	let uaMeta;
	try {
		uaMeta = await generateUserAgent({
			browserName: browserName || 'Chrome',
			deviceCategory: deviceCategory || 'desktop',
			platform: 'Win32',
			language: languages[0]
		});
	} catch (uaError) {
		console.warn('⚠️ User agent generation failed, using fallback:', uaError.message);
		// Enhanced fallback user agent
		const fallbackAgents = [
			'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
			'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
			'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
			'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:120.0) Gecko/20100101 Firefox/120.0',
			'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15'
		];
		
		const selectedUA = fallbackAgents[Math.floor(Math.random() * fallbackAgents.length)];
		
		uaMeta = {
			ua: selectedUA,
			appVersion: selectedUA.split('Mozilla/')[1],
			platform: selectedUA.includes('Windows') ? 'Win32' : selectedUA.includes('Macintosh') ? 'MacIntel' : 'Linux x86_64',
			vendor: selectedUA.includes('Chrome') ? 'Google Inc.' : selectedUA.includes('Firefox') ? '' : 'Apple Computer, Inc.',
			os: selectedUA.includes('Windows') ? 'Windows' : selectedUA.includes('Mac') ? 'Mac' : 'Linux',
			browser: selectedUA.includes('Chrome') ? 'Chrome' : selectedUA.includes('Firefox') ? 'Firefox' : 'Safari'
		};
	}

	// Enhanced plugin simulation
	const plugins = [
		{ name: 'Chrome PDF Plugin', description: 'Portable Document Format', filename: 'internal-pdf-viewer' },
		{ name: 'Chrome PDF Viewer', description: 'PDF Viewer', filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai' },
		{ name: 'Native Client', description: 'Native Client Executable', filename: 'internal-nacl-plugin' }
	];

	// Add Flash plugin occasionally for realism (even though deprecated)
	if (Math.random() < 0.3) {
		plugins.push({
			name: 'Shockwave Flash',
			description: 'Shockwave Flash 32.0 r0',
			filename: 'pepflashplayer.dll'
		});
	}

	// Enhanced MIME types
	const mimeTypes = [
		{ type: 'application/pdf', description: 'PDF Viewer', suffixes: 'pdf' },
		{ type: 'application/x-google-chrome-pdf', description: 'Chrome PDF Viewer', suffixes: 'pdf' },
		{ type: 'application/x-nacl', description: 'Native Client Executable', suffixes: 'nexe' },
		{ type: 'application/x-pnacl', description: 'Portable Native Client Executable', suffixes: 'pexe' }
	];

	return {
		userAgent: uaMeta.ua,
		appVersion: uaMeta.appVersion,
		platform: uaMeta.platform,
		vendor: uaMeta.vendor,
		os: uaMeta.os,
		browser: uaMeta.browser,
		browserLanguages: languages,
		screen: { 
			width: screen.width, 
			height: screen.height, 
			colorDepth: 24, 
			pixelDepth: 24,
			availWidth: screen.width,
			availHeight: screen.height - 40 // Account for taskbar
		},
		devicePixelRatio: dpr,
		timezone,
		geolocation,
		countryCode,
		fonts: shuffleArray(fontPool).slice(0, 8 + Math.floor(Math.random() * 5)), // 8-12 fonts
		deviceMemory: [4, 8, 16, 32][Math.floor(Math.random() * 4)],
		hardwareConcurrency: [2, 4, 6, 8, 12, 16][Math.floor(Math.random() * 6)],
		plugins,
		mimeTypes,
		webglVendor: webgl.vendor,
		webglRenderer: webgl.renderer,
		canvasNoise: crypto.randomBytes(16).toString('hex'),
		audioFingerprint: Math.random().toFixed(16),
		connection: {
			effectiveType: ['4g', 'fast-3g', '3g'][Math.floor(Math.random() * 3)],
			downlink: +(Math.random() * 15 + 5).toFixed(1), // 5-20 Mbps
			rtt: Math.floor(Math.random() * 50 + 10), // 10-60ms
			type: ['wifi', 'ethernet', 'cellular'][Math.floor(Math.random() * 3)]
		},
		battery: {
			charging: Math.random() < 0.7,
			level: +(Math.random() * 0.7 + 0.2).toFixed(2), // 20%-90%
			chargingTime: Math.random() < 0.5 ? Math.floor(Math.random() * 7200) : Infinity,
			dischargingTime: Math.floor(Math.random() * 28800 + 3600) // 1-8 hours
		},
		maxTouchPoints: 0,
		isMobile: false,
		hasTouch: false,
		doNotTrack: Math.random() < 0.3 ? '1' : null, // 30% enable DNT
		cookieEnabled: true,
		onLine: true
	};
}

module.exports = generateFingerprint;