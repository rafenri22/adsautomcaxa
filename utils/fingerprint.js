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

async function generateFingerprint(proxyURL = '', browserName, deviceCategory) {
	const screenProfiles = [
		{ width: 1920, height: 1080 },
		{ width: 1366, height: 768 },
		{ width: 1536, height: 864 },
		{ width: 1600, height: 900 },
		{ width: 1440, height: 900 },
		{ width: 1280, height: 720 }
	];
	
	const languageProfiles = [
		['en-US', 'en'],
		['en-GB', 'en'],
		['fr-FR', 'fr'],
		['de-DE', 'de'],
		['es-ES', 'es'],
		['it-IT', 'it']
	];
	
	const fontPool = [
		'Arial',
		'Verdana',
		'Tahoma',
		'Trebuchet MS',
		'Georgia',
		'Times New Roman',
		'Courier New',
		'Comic Sans MS',
		'Impact',
		'Palatino'
	];
	
	const webGLList = [
		{ vendor: 'Intel Inc.', renderer: 'Intel Iris OpenGL Engine' },
		{ vendor: 'NVIDIA Corporation', renderer: 'NVIDIA GeForce RTX 3060/PCIe/SSE2' },
		{ vendor: 'AMD', renderer: 'AMD Radeon Pro 560 OpenGL Engine' },
		{ vendor: 'Intel Inc.', renderer: 'Intel HD Graphics 620' },
		{ vendor: 'NVIDIA Corporation', renderer: 'NVIDIA GeForce GTX 1060/PCIe/SSE2' }
	];

	let timezone = 'UTC';
	
	// Try to get timezone from proxy, but don't fail if it doesn't work
	if (proxyURL && proxyURL.trim()) {
		try {
			// Extract IP from proxy URL if possible
			const urlMatch = proxyURL.match(/(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})/);
			if (urlMatch) {
				const ip = urlMatch[1];
				const geo = await axios.get(`http://ip-api.com/json/${ip}`, { 
					timeout: 3000,
					validateStatus: () => true // Accept any status code
				});
				if (geo.data && geo.data.timezone) {
					timezone = geo.data.timezone;
				}
			}
		} catch (e) {
			console.warn('⚠️ Timezone lookup failed, using UTC:', e.message);
		}
	}

	const screen = screenProfiles[Math.floor(Math.random() * screenProfiles.length)];
	const languages = languageProfiles[Math.floor(Math.random() * languageProfiles.length)];
	const dpr = [1, 1.25, 1.5, 2][Math.floor(Math.random() * 4)];
	const webgl = webGLList[Math.floor(Math.random() * webGLList.length)];

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
		// Fallback user agent
		uaMeta = {
			ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
			appVersion: '5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
			platform: 'Win32',
			vendor: 'Google Inc.',
			os: 'Windows',
			browser: 'Chrome'
		};
	}

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
			pixelDepth: 24 
		},
		devicePixelRatio: dpr,
		timezone,
		fonts: shuffleArray(fontPool).slice(0, 5),
		deviceMemory: [4, 8, 16][Math.floor(Math.random() * 3)],
		hardwareConcurrency: [4, 8, 12, 16][Math.floor(Math.random() * 4)],
		plugins: [
			{
				name: 'Chrome PDF Plugin',
				description: 'Portable Document Format',
				filename: 'internal-pdf-viewer'
			},
			{ 
				name: 'Native Client', 
				description: 'Native Client', 
				filename: 'internal-nacl' 
			}
		],
		mimeTypes: [
			{ 
				type: 'application/pdf', 
				description: 'PDF Viewer', 
				suffixes: 'pdf' 
			},
			{ 
				type: 'application/x-nacl', 
				description: 'Native Client', 
				suffixes: 'pnacl' 
			}
		],
		webglVendor: webgl.vendor,
		webglRenderer: webgl.renderer,
		canvasNoise: crypto.randomBytes(16).toString('hex'),
		audioFingerprint: Math.random().toFixed(16),
		connection: {
			effectiveType: ['4g', '3g', 'fast-3g'][Math.floor(Math.random() * 3)],
			downlink: +(Math.random() * 10 + 1).toFixed(1),
			rtt: Math.floor(Math.random() * 100 + 20),
			type: ['wifi', 'cellular'][Math.floor(Math.random() * 2)]
		},
		maxTouchPoints: 0, // desktop
		isMobile: false,
		hasTouch: false
	};
}

module.exports = generateFingerprint;