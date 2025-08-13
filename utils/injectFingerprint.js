module.exports = async function injectFingerprint(page, fp) {
	await page.addInitScript((fp) => {
		/* Navigator props */
		Object.defineProperty(navigator, 'platform', { get: () => fp.platform });
		Object.defineProperty(navigator, 'language', { get: () => fp.browserLanguages[0] });
		Object.defineProperty(navigator, 'languages', { get: () => fp.browserLanguages });
		Object.defineProperty(navigator, 'hardwareConcurrency', {
			get: () => fp.hardwareConcurrency
		});
		Object.defineProperty(navigator, 'deviceMemory', { get: () => fp.deviceMemory });
		Object.defineProperty(navigator, 'maxTouchPoints', { get: () => fp.maxTouchPoints });
		Object.defineProperty(navigator, 'userAgent', { get: () => fp.userAgent });
		Object.defineProperty(navigator, 'webdriver', { get: () => false });
		Object.defineProperty(navigator, 'doNotTrack', { get: () => '1' });

		/* Screen & window dimensions */
		Object.defineProperty(window, 'devicePixelRatio', { get: () => fp.devicePixelRatio });
		const s = fp.screen;
		Object.defineProperty(screen, 'width', { get: () => s.width });
		Object.defineProperty(screen, 'height', { get: () => s.height });
		Object.defineProperty(screen, 'colorDepth', { get: () => s.colorDepth });
		Object.defineProperty(screen, 'pixelDepth', { get: () => s.pixelDepth });
		Object.defineProperty(window, 'innerWidth', { get: () => s.width });
		Object.defineProperty(window, 'innerHeight', { get: () => s.height });

		/* Timezone */
		Intl.DateTimeFormat.prototype.resolvedOptions = function () {
			return { timeZone: fp.timezone, locale: fp.browserLanguages[0] };
		};

		/* Touch */
		Object.defineProperty(window, 'ontouchstart', { get: () => fp.maxTouchPoints > 0 });

		/* Permissions API */
		const origQuery = window.navigator.permissions.query;
		window.navigator.permissions.query = (params) =>
			params.name === 'notifications'
				? Promise.resolve({ state: Notification.permission })
				: origQuery(params);

		/* Plugins & mimeTypes */
		Object.defineProperty(navigator, 'plugins', {
			get: () =>
				fp.plugins.map((p) => ({
					name: p.name,
					description: p.description,
					filename: p.filename
				}))
		});
		Object.defineProperty(navigator, 'mimeTypes', {
			get: () =>
				fp.mimeTypes.map((mt) => ({
					type: mt.type,
					description: mt.description,
					suffixes: mt.suffixes,
					enabledPlugin: { description: mt.description }
				}))
		});

		/* Canvas spoof */
		const toDataURLOriginal = HTMLCanvasElement.prototype.toDataURL;
		HTMLCanvasElement.prototype.toDataURL = function () {
			const ctx = this.getContext('2d');
			ctx.fillStyle = 'rgb(50,50,50)';
			ctx.fillRect(0, 0, this.width, this.height);
			return toDataURLOriginal.apply(this, arguments);
		};

		/* WebGL spoof */
		const origGetParam = WebGLRenderingContext.prototype.getParameter;
		WebGLRenderingContext.prototype.getParameter = function (param) {
			if (param === 37445) return fp.webglVendor;
			if (param === 37446) return fp.webglRenderer;
			return origGetParam.call(this, param);
		};

		/* AudioContext spoof */
		const AC = window.AudioContext || window.webkitAudioContext;
		if (AC) {
			const orig = AC.prototype.getChannelData;
			AC.prototype.getChannelData = function () {
				const d = orig.apply(this, arguments);
				const shift = Math.random() * 1e-7;
				for (let i = 0; i < d.length; i += 100) d[i] += shift;
				return d;
			};
			Object.defineProperty(AC.prototype, 'sampleRate', {
				get: () => 44100 + Math.floor(Math.random() * 5)
			});
		}

		/* Math.random tweak */
		const origRand = Math.random;
		Math.random = () => parseFloat((origRand() + 1e-7).toFixed(10));

		/* Connection spoof */
		const conn = navigator.connection || {};
		Object.defineProperty(conn, 'effectiveType', { get: () => fp.connection.effectiveType });
		Object.defineProperty(conn, 'downlink', { get: () => fp.connection.downlink });
		Object.defineProperty(conn, 'rtt', { get: () => fp.connection.rtt });
		Object.defineProperty(conn, 'type', { get: () => fp.connection.type });
		Object.defineProperty(navigator, 'connection', { get: () => conn });

		/* Battery API override */
		Object.defineProperty(navigator, 'getBattery', {
			value: () =>
				Promise.resolve({
					charging: true,
					level: 0.87,
					chargingTime: 0,
					dischargingTime: Infinity
				})
		});

		/* MediaDevices spoof */
		Object.defineProperty(navigator, 'mediaDevices', {
			get: () => ({
				enumerateDevices: () =>
					Promise.resolve([
						{
							kind: 'audioinput',
							label: 'Microphone (Built-in)',
							deviceId: 'default',
							groupId: '1'
						},
						{
							kind: 'videoinput',
							label: 'Camera (Built-in)',
							deviceId: 'default',
							groupId: '1'
						}
					])
			})
		});

		/* WebRTC iframe protection */
		if (window.RTCPeerConnection) {
			const orig = window.RTCPeerConnection;
			window.RTCPeerConnection = function (...args) {
				const pc = new orig(...args);
				const origGetStats = pc.getStats.bind(pc);
				pc.getStats = function () {
					return origGetStats().then((stats) => {
						return stats; // optionally strip local IPs
					});
				};
				return pc;
			};
		}
	}, fp);
};
