module.exports = async function injectFingerprint(page, fp) {
	await page.addInitScript((fp) => {
		// Remove automation indicators
		Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
		
		// Delete automation-related properties
		delete navigator.__proto__.webdriver;
		
		// Navigator properties
		Object.defineProperty(navigator, 'platform', { get: () => fp.platform });
		Object.defineProperty(navigator, 'language', { get: () => fp.browserLanguages[0] });
		Object.defineProperty(navigator, 'languages', { get: () => fp.browserLanguages });
		Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => fp.hardwareConcurrency });
		Object.defineProperty(navigator, 'deviceMemory', { get: () => fp.deviceMemory });
		Object.defineProperty(navigator, 'maxTouchPoints', { get: () => fp.maxTouchPoints });
		Object.defineProperty(navigator, 'userAgent', { get: () => fp.userAgent });
		Object.defineProperty(navigator, 'appVersion', { get: () => fp.appVersion });
		Object.defineProperty(navigator, 'vendor', { get: () => fp.vendor });
		Object.defineProperty(navigator, 'cookieEnabled', { get: () => fp.cookieEnabled });
		Object.defineProperty(navigator, 'onLine', { get: () => fp.onLine });
		
		// Do Not Track
		if (fp.doNotTrack) {
			Object.defineProperty(navigator, 'doNotTrack', { get: () => fp.doNotTrack });
		}

		// Screen & window dimensions
		Object.defineProperty(window, 'devicePixelRatio', { get: () => fp.devicePixelRatio });
		const s = fp.screen;
		Object.defineProperty(screen, 'width', { get: () => s.width });
		Object.defineProperty(screen, 'height', { get: () => s.height });
		Object.defineProperty(screen, 'availWidth', { get: () => s.availWidth });
		Object.defineProperty(screen, 'availHeight', { get: () => s.availHeight });
		Object.defineProperty(screen, 'colorDepth', { get: () => s.colorDepth });
		Object.defineProperty(screen, 'pixelDepth', { get: () => s.pixelDepth });
		
		// Inner dimensions should match screen size for desktop
		Object.defineProperty(window, 'innerWidth', { get: () => s.width });
		Object.defineProperty(window, 'innerHeight', { get: () => s.height });
		Object.defineProperty(window, 'outerWidth', { get: () => s.width });
		Object.defineProperty(window, 'outerHeight', { get: () => s.height });

		// Timezone and Intl
		const originalResolvedOptions = Intl.DateTimeFormat.prototype.resolvedOptions;
		Intl.DateTimeFormat.prototype.resolvedOptions = function () {
			const options = originalResolvedOptions.call(this);
			options.timeZone = fp.timezone;
			return options;
		};
		
		// Date timezone
		const originalGetTimezoneOffset = Date.prototype.getTimezoneOffset;
		Date.prototype.getTimezoneOffset = function () {
			// Calculate offset based on timezone (simplified)
			const timezoneOffsets = {
				'America/New_York': 300,
				'America/Los_Angeles': 480,
				'America/Chicago': 360,
				'America/Denver': 420,
				'Europe/London': 0,
				'Europe/Paris': -60,
				'Europe/Berlin': -60,
				'Asia/Tokyo': -540,
				'Asia/Shanghai': -480,
			};
			return timezoneOffsets[fp.timezone] || 0;
		};

		// Geolocation
		const originalGetCurrentPosition = navigator.geolocation.getCurrentPosition;
		const originalWatchPosition = navigator.geolocation.watchPosition;
		
		navigator.geolocation.getCurrentPosition = function (success, error, options) {
			setTimeout(() => {
				success({
					coords: {
						latitude: fp.geolocation.latitude,
						longitude: fp.geolocation.longitude,
						accuracy: fp.geolocation.accuracy,
						altitude: null,
						altitudeAccuracy: null,
						heading: null,
						speed: null
					},
					timestamp: Date.now()
				});
			}, 100 + Math.random() * 500);
		};

		// Touch events
		Object.defineProperty(window, 'ontouchstart', { get: () => fp.maxTouchPoints > 0 ? function(){} : undefined });

		// Permissions API
		if (navigator.permissions && navigator.permissions.query) {
			const originalQuery = navigator.permissions.query;
			navigator.permissions.query = function (params) {
				if (params.name === 'geolocation') {
					return Promise.resolve({ state: 'granted' });
				}
				if (params.name === 'notifications') {
					return Promise.resolve({ state: Notification.permission });
				}
				return originalQuery.call(this, params);
			};
		}

		// Plugins & mimeTypes
		Object.defineProperty(navigator, 'plugins', {
			get: () => {
				const pluginArray = Array.from(fp.plugins, (plugin, index) => ({
					...plugin,
					length: 1,
					item: () => plugin,
					namedItem: () => plugin,
					[index]: plugin
				}));
				pluginArray.item = (index) => pluginArray[index];
				pluginArray.namedItem = (name) => pluginArray.find(p => p.name === name);
				return pluginArray;
			}
		});
		
		Object.defineProperty(navigator, 'mimeTypes', {
			get: () => {
				const mimeArray = Array.from(fp.mimeTypes, (mime, index) => ({
					...mime,
					enabledPlugin: fp.plugins.find(p => p.description.includes(mime.description.split(' ')[0])) || fp.plugins[0],
					[index]: mime
				}));
				mimeArray.item = (index) => mimeArray[index];
				mimeArray.namedItem = (name) => mimeArray.find(m => m.type === name);
				return mimeArray;
			}
		});

		// Enhanced Canvas fingerprinting protection
		const originalToDataURL = HTMLCanvasElement.prototype.toDataURL;
		const originalGetImageData = CanvasRenderingContext2D.prototype.getImageData;
		
		HTMLCanvasElement.prototype.toDataURL = function (type, quality) {
			const context = this.getContext('2d');
			const imageData = context.getImageData(0, 0, this.width, this.height);
			
			// Add subtle noise to canvas
			for (let i = 0; i < imageData.data.length; i += 4) {
				const noise = (parseInt(fp.canvasNoise.slice(i % 32, (i % 32) + 2), 16) - 128) * 0.01;
				imageData.data[i] = Math.max(0, Math.min(255, imageData.data[i] + noise));
				imageData.data[i + 1] = Math.max(0, Math.min(255, imageData.data[i + 1] + noise));
				imageData.data[i + 2] = Math.max(0, Math.min(255, imageData.data[i + 2] + noise));
			}
			
			context.putImageData(imageData, 0, 0);
			return originalToDataURL.call(this, type, quality);
		};

		// WebGL fingerprinting
		const originalGetParameter = WebGLRenderingContext.prototype.getParameter;
		WebGLRenderingContext.prototype.getParameter = function (param) {
			if (param === 37445) return fp.webglVendor; // UNMASKED_VENDOR_WEBGL
			if (param === 37446) return fp.webglRenderer; // UNMASKED_RENDERER_WEBGL
			if (param === 34921) return 'ANGLE (Intel, Intel(R) UHD Graphics Direct3D11 vs_5_0 ps_5_0)'; // SHADING_LANGUAGE_VERSION
			if (param === 7938) return 'WebGL 1.0 (OpenGL ES 2.0 Chromium)'; // VERSION
			return originalGetParameter.call(this, param);
		};
		
		// WebGL2 support
		if (WebGL2RenderingContext) {
			const originalGetParameter2 = WebGL2RenderingContext.prototype.getParameter;
			WebGL2RenderingContext.prototype.getParameter = function (param) {
				if (param === 37445) return fp.webglVendor;
				if (param === 37446) return fp.webglRenderer;
				return originalGetParameter2.call(this, param);
			};
		}

		// AudioContext fingerprinting
		if (window.AudioContext || window.webkitAudioContext) {
			const AudioCtx = window.AudioContext || window.webkitAudioContext;
			const originalCreateOscillator = AudioCtx.prototype.createOscillator;
			
			AudioCtx.prototype.createOscillator = function () {
				const oscillator = originalCreateOscillator.call(this);
				const originalStart = oscillator.start;
				
				oscillator.start = function (when) {
					const noise = parseFloat(fp.audioFingerprint) * 1e-7;
					this.frequency.value += noise;
					return originalStart.call(this, when);
				};
				
				return oscillator;
			};
			
			Object.defineProperty(AudioCtx.prototype, 'sampleRate', {
				get: () => 44100 + Math.floor(parseFloat(fp.audioFingerprint) * 100)
			});
		}

		// Enhanced Math.random replacement
		const originalRandom = Math.random;
		let seedCounter = parseInt(fp.canvasNoise.slice(0, 8), 16);
		
		Math.random = function () {
			seedCounter = (seedCounter * 9301 + 49297) % 233280;
			return (seedCounter / 233280) * 0.999999 + 0.000001;
		};

		// Connection API
		if (navigator.connection || navigator.mozConnection || navigator.webkitConnection) {
			const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection || {};
			
			Object.defineProperty(connection, 'effectiveType', { get: () => fp.connection.effectiveType });
			Object.defineProperty(connection, 'downlink', { get: () => fp.connection.downlink });
			Object.defineProperty(connection, 'rtt', { get: () => fp.connection.rtt });
			Object.defineProperty(connection, 'type', { get: () => fp.connection.type });
			
			Object.defineProperty(navigator, 'connection', { get: () => connection });
		}

		// Battery API
		if (navigator.getBattery) {
			const originalGetBattery = navigator.getBattery;
			navigator.getBattery = function () {
				return Promise.resolve({
					charging: fp.battery.charging,
					level: fp.battery.level,
					chargingTime: fp.battery.chargingTime,
					dischargingTime: fp.battery.dischargingTime,
					addEventListener: function () {},
					removeEventListener: function () {}
				});
			};
		}

		// MediaDevices
		if (navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) {
			const originalEnumerateDevices = navigator.mediaDevices.enumerateDevices;
			navigator.mediaDevices.enumerateDevices = function () {
				return Promise.resolve([
					{
						kind: 'audioinput',
						label: 'Default - Microphone (Built-in)',
						deviceId: 'default',
						groupId: 'group1'
					},
					{
						kind: 'audiooutput',
						label: 'Default - Speaker (Built-in)',
						deviceId: 'default',
						groupId: 'group1'
					},
					{
						kind: 'videoinput',
						label: 'HD WebCam (Built-in)',
						deviceId: 'video1',
						groupId: 'group2'
					}
				]);
			};
		}

		// Performance memory
		if (performance.memory) {
			Object.defineProperty(performance.memory, 'jsHeapSizeLimit', {
				get: () => fp.deviceMemory * 1024 * 1024 * 1024 // Convert GB to bytes
			});
			Object.defineProperty(performance.memory, 'totalJSHeapSize', {
				get: () => Math.floor(Math.random() * fp.deviceMemory * 512 * 1024 * 1024)
			});
			Object.defineProperty(performance.memory, 'usedJSHeapSize', {
				get: () => Math.floor(Math.random() * performance.memory.totalJSHeapSize * 0.7)
			});
		}

		// Font detection spoofing
		const originalOffsetWidth = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetWidth');
		const originalOffsetHeight = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetHeight');
		
		// Speech synthesis (if available)
		if (speechSynthesis && speechSynthesis.getVoices) {
			const originalGetVoices = speechSynthesis.getVoices;
			speechSynthesis.getVoices = function () {
				return [
					{ name: 'Google US English', lang: 'en-US', default: true, localService: false, voiceURI: 'Google US English' },
					{ name: 'Google UK English Female', lang: 'en-GB', default: false, localService: false, voiceURI: 'Google UK English Female' }
				];
			};
		}

		// WebRTC IP leak protection
		if (window.RTCPeerConnection) {
			const originalRTCPeerConnection = window.RTCPeerConnection;
			window.RTCPeerConnection = function (config, constraints) {
				if (config && config.iceServers) {
					config.iceServers = config.iceServers.filter(server => 
						!server.urls || !server.urls.toString().includes('stun:')
					);
				}
				return new originalRTCPeerConnection(config, constraints);
			};
		}

		// Remove chrome automation extension
		if (window.chrome && window.chrome.runtime) {
			Object.defineProperty(window.chrome.runtime, 'onConnect', { value: undefined });
			Object.defineProperty(window.chrome.runtime, 'onMessage', { value: undefined });
		}

		// Override notification permissions
		if (window.Notification) {
			Object.defineProperty(Notification, 'permission', { get: () => 'default' });
		}

		console.log('🔧 Enhanced fingerprint injected successfully');
		
	}, fp);
};