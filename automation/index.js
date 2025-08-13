// automation/index.js
const { chromium, firefox, webkit } = require('playwright');
const generateFingerprint = require('../utils/fingerprint');
const simulateHumanScroll = require('../utils/scroll');
const {
	log,
	getBrowserByName,
	getRandomBrowser,
	getRandomWaitTimes,
	updateProfileStatus,
	getProfileStatus,
	clearProfileLogs,
	updateGlobalCycleInfo
} = require('../utils/helpers');
const injectFingerprint = require('../utils/injectFingerprint');

const activeWindows = new Map();
let totalWindows = 0;
let completedWindows = 0;
let failedWindows = 0;
let successWindows = 0;
let isAutomationInProgress = false;
let currentCycle = 0;
let profilesPerCycle = 0;

// Stop functionality variables
let shouldStop = false;
let activeBrowsers = [];

// Function to stop automation
function stopAutomation() {
	shouldStop = true;
	log('🛑 Stop automation requested...');
}

// Function to reset stop state
function resetStopState() {
	shouldStop = false;
	activeBrowsers = [];
}

// Function to get cycle-specific profile index
function getCycleSpecificIndex(globalIndex, cycle, profilesPerCycle) {
	return ((globalIndex - 1) % profilesPerCycle) + 1;
}

// Function to simulate random clicks on the page
async function simulateRandomClicks(page, profileIndex, duration = 10) {
	if (!page || page.isClosed()) return;
	
	log(`🖱️ Starting random click simulation for ${duration}s`, profileIndex);
	
	try {
		// Wait for page to be fully interactive
		await page.waitForLoadState('networkidle', { timeout: 30000 });
		
		const endTime = Date.now() + (duration * 1000);
		let clickCount = 0;
		
		while (Date.now() < endTime && !page.isClosed()) {
			try {
				// Get clickable elements (avoid ads for now to prevent redirects)
				const clickableElements = await page.evaluate(() => {
					const elements = [];
					const selectors = [
						'p', 'div', 'span', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
						'article', 'section', 'main', 'aside', 'header', 'footer'
					];
					
					selectors.forEach(selector => {
						const found = document.querySelectorAll(selector);
						found.forEach(el => {
							const rect = el.getBoundingClientRect();
							const style = window.getComputedStyle(el);
							if (rect.width > 50 && rect.height > 20 && 
								style.display !== 'none' && 
								style.visibility !== 'hidden' &&
								rect.top >= 0 && rect.top <= window.innerHeight) {
								elements.push({
									x: rect.left + rect.width / 2,
									y: rect.top + rect.height / 2,
									width: rect.width,
									height: rect.height
								});
							}
						});
					});
					return elements;
				});
				
				if (clickableElements.length > 0) {
					const randomElement = clickableElements[Math.floor(Math.random() * clickableElements.length)];
					
					// Add some randomization to click position
					const x = randomElement.x + (Math.random() * 20 - 10);
					const y = randomElement.y + (Math.random() * 20 - 10);
					
					// Move mouse to position smoothly
					await page.mouse.move(x, y, { steps: 5 + Math.random() * 10 });
					await page.waitForTimeout(200 + Math.random() * 500);
					
					// Random chance to actually click
					if (Math.random() < 0.3) {
						await page.mouse.click(x, y);
						clickCount++;
						log(`🎯 Clicked at (${Math.round(x)}, ${Math.round(y)}) - Click #${clickCount}`, profileIndex);
						
						// Wait a bit after clicking
						await page.waitForTimeout(1000 + Math.random() * 2000);
					} else {
						log(`👆 Hovered at (${Math.round(x)}, ${Math.round(y)})`, profileIndex);
						await page.waitForTimeout(500 + Math.random() * 1000);
					}
				}
				
				// Random pause between actions
				await page.waitForTimeout(2000 + Math.random() * 3000);
				
			} catch (clickError) {
				log(`⚠️ Click simulation error: ${clickError.message}`, profileIndex);
				await page.waitForTimeout(1000);
			}
		}
		
		log(`✅ Click simulation completed - ${clickCount} clicks made`, profileIndex);
		
	} catch (error) {
		log(`❌ Random click simulation failed: ${error.message}`, profileIndex);
	}
}

// Function to wait for complete page load including ads
async function waitForCompletePageLoad(page, profileIndex, timeout = 45) {
	if (!page || page.isClosed()) return false;
	
	log(`⏳ Waiting for complete page load (${timeout}s timeout)...`, profileIndex);
	
	try {
		// Wait for network to be idle
		await page.waitForLoadState('networkidle', { timeout: timeout * 1000 });
		log(`✅ Network idle achieved`, profileIndex);
		
		// Additional wait for dynamic content and ads
		await page.waitForTimeout(3000);
		
		// Check if common ad containers are present and try to load them
		await page.evaluate(() => {
			return new Promise((resolve) => {
				// Common ad container selectors
				const adSelectors = [
					'.ads', '.ad', '.advertisement', '.google-ad',
					'[class*="ad-"]', '[id*="ad-"]', '[class*="ads-"]', '[id*="ads-"]',
					'iframe[src*="doubleclick"]', 'iframe[src*="googlesyndication"]',
					'ins.adsbygoogle', '.adsbygoogle'
				];
				
				let loadedAds = 0;
				let totalAds = 0;
				
				adSelectors.forEach(selector => {
					const elements = document.querySelectorAll(selector);
					totalAds += elements.length;
					
					elements.forEach(el => {
						if (el.offsetHeight > 0 && el.offsetWidth > 0) {
							loadedAds++;
						}
					});
				});
				
				console.log(`Found ${totalAds} ad elements, ${loadedAds} visible`);
				
				// Wait a bit more for ads to load
				setTimeout(resolve, 2000);
			});
		});
		
		// Check page readiness
		const isReady = await page.evaluate(() => {
			return document.readyState === 'complete' && 
				   window.jQuery ? window.jQuery.active === 0 : true;
		});
		
		if (isReady) {
			log(`✅ Page fully loaded with all resources`, profileIndex);
			return true;
		} else {
			log(`⚠️ Page may not be fully loaded`, profileIndex);
			return true; // Continue anyway
		}
		
	} catch (loadError) {
		log(`⚠️ Page load timeout or error: ${loadError.message}`, profileIndex);
		return true; // Continue even if timeout
	}
}

// Function to process a single window
async function processWindow(
	windowIndex,
	browser,
	combinedURL,
	proxyURL,
	waitTime,
	cycle,
	timeout = 30
) {
	let browserInstance = null;
	let context = null;
	let page = null;
	let isCompleted = false;
	const cycleSpecificIndex = getCycleSpecificIndex(windowIndex, cycle, profilesPerCycle);

	try {
		// Check if stop was requested before starting
		if (shouldStop) {
			log(`⏹️ Skipping Profile ${cycleSpecificIndex} - automation stopped`, windowIndex);
			updateProfileStatus(windowIndex, 'failed');
			failedWindows++;
			return;
		}

		log(`🚀 Opening Profile ${cycleSpecificIndex} (Cycle ${cycle})`, windowIndex);
		updateProfileStatus(windowIndex, 'waiting');

		// Select browser for this specific window
		const browserChoice = browser !== 'random' ? getBrowserByName(browser) : getRandomBrowser();
		if (!browserChoice) {
			log(`❌ Invalid browser selection for Profile ${cycleSpecificIndex}`, windowIndex);
			updateProfileStatus(windowIndex, 'failed');
			failedWindows++;
			return;
		}

		log(`🌐 Using browser: ${browserChoice.name} for Profile ${cycleSpecificIndex}`, windowIndex);

		// Generate comprehensive fingerprint
		let fingerprint;
		try {
			fingerprint = await generateFingerprint(proxyURL, browserChoice.name, 'desktop');
			log(`🔐 Generated comprehensive fingerprint for Profile ${cycleSpecificIndex}`, windowIndex);
		} catch (fingerprintError) {
			log(`⚠️ Fingerprint generation failed, using enhanced defaults: ${fingerprintError.message}`, windowIndex);
			fingerprint = {
				userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
				screen: { width: 1920, height: 1080 },
				browserLanguages: ['en-US', 'en'],
				timezone: 'UTC',
				deviceScaleFactor: 1,
				isMobile: false,
				hasTouch: false
			};
		}

		// Check if stop was requested before launching browser
		if (shouldStop) {
			log(`⏹️ Skipping Profile ${cycleSpecificIndex} - automation stopped`, windowIndex);
			updateProfileStatus(windowIndex, 'failed');
			failedWindows++;
			return;
		}

		// Launch browser with human-like configuration
		try {
			log(`🌐 Launching ${browserChoice.name} browser for Profile ${cycleSpecificIndex}`, windowIndex);
			
			// Human-like browser arguments - allow ads and full rendering
			const browserArgs = [
				'--no-first-run',
				'--no-default-browser-check',
				'--disable-blink-features=AutomationControlled',
				'--disable-features=VizDisplayCompositor',
				'--disable-background-networking',
				'--disable-background-timer-throttling',
				'--disable-backgrounding-occluded-windows',
				'--disable-renderer-backgrounding',
				'--disable-field-trial-config',
				'--disable-hang-monitor',
				'--disable-ipc-flooding-protection',
				'--disable-popup-blocking', // Allow popups (important for some ads)
				'--disable-prompt-on-repost',
				'--disable-sync',
				'--metrics-recording-only',
				'--no-report-upload',
				'--safebrowsing-disable-auto-update',
				'--enable-automation',
				'--password-store=basic',
				'--use-mock-keychain',
				// Enable hardware acceleration and GPU for better rendering
				'--enable-gpu',
				'--enable-accelerated-2d-canvas',
				'--enable-accelerated-jpeg-decoding',
				'--enable-accelerated-mjpeg-decode',
				'--enable-accelerated-video-decode',
				// Allow all content including ads
				'--disable-web-security', // Allow cross-origin requests
				'--disable-features=TranslateUI',
				'--disable-extensions',
				'--allow-running-insecure-content',
				// Performance optimizations
				'--max_old_space_size=4096',
				// Allow geolocation and notifications
				'--use-fake-ui-for-media-stream',
				'--use-fake-device-for-media-stream',
				// Make it look more human
				'--disable-dev-shm-usage',
				'--disable-software-rasterizer',
			];

			browserInstance = await browserChoice.launcher.launch({
				headless: false,
				args: browserArgs,
				ignoreDefaultArgs: ['--enable-automation'], // Remove automation flags
				executablePath: undefined, // Use default
				slowMo: 50 + Math.random() * 100 // Add slight delay to actions
			});
			
			log(`✅ Browser launched successfully for Profile ${cycleSpecificIndex}`, windowIndex);
		} catch (launchError) {
			log(`❌ Browser launch failed for Profile ${cycleSpecificIndex}: ${launchError.message}`, windowIndex);
			updateProfileStatus(windowIndex, 'failed');
			failedWindows++;
			return;
		}

		// Check if stop was requested after browser launch
		if (shouldStop) {
			log(`⏹️ Stopping Profile ${cycleSpecificIndex} - automation stopped`, windowIndex);
			try {
				await browserInstance.close();
			} catch (e) {
				log(`⚠️ Error closing browser: ${e.message}`, windowIndex);
			}
			updateProfileStatus(windowIndex, 'failed');
			failedWindows++;
			return;
		}

		// Add to active browsers for stop functionality
		activeBrowsers.push(browserInstance);

		// Create browser context with comprehensive settings
		try {
			const contextOptions = {
				userAgent: fingerprint.userAgent,
				viewport: fingerprint.screen,
				locale: fingerprint.browserLanguages[0],
				timezoneId: fingerprint.timezone,
				deviceScaleFactor: fingerprint.deviceScaleFactor || 1,
				isMobile: fingerprint.isMobile || false,
				hasTouch: fingerprint.hasTouch || false,
				// Enable all permissions to look human
				permissions: ['geolocation', 'notifications'],
				geolocation: fingerprint.geolocation || { latitude: 40.7128, longitude: -74.0060 }, // NYC default
				// Accept all cookies
				acceptDownloads: true,
				// Enable JavaScript
				javaScriptEnabled: true,
				// Extra HTTP headers
				extraHTTPHeaders: {
					'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
					'Accept-Language': fingerprint.browserLanguages.join(',') + ';q=0.9',
					'Accept-Encoding': 'gzip, deflate, br',
					'Cache-Control': 'max-age=0',
					'Sec-Fetch-Dest': 'document',
					'Sec-Fetch-Mode': 'navigate',
					'Sec-Fetch-Site': 'none',
					'Sec-Fetch-User': '?1',
					'Upgrade-Insecure-Requests': '1',
				}
			};
			
			context = await browserInstance.newContext(contextOptions);
			log(`📄 Browser context created for Profile ${cycleSpecificIndex}`, windowIndex);
		} catch (contextError) {
			log(`❌ Context creation failed for Profile ${cycleSpecificIndex}: ${contextError.message}`, windowIndex);
			updateProfileStatus(windowIndex, 'failed');
			failedWindows++;
			return;
		}

		// Check if stop was requested after context creation
		if (shouldStop) {
			log(`⏹️ Stopping Profile ${cycleSpecificIndex} - automation stopped`, windowIndex);
			updateProfileStatus(windowIndex, 'failed');
			failedWindows++;
			return;
		}

		// Create new page
		try {
			page = await context.newPage();
			
			// Set additional page properties
			await page.setViewportSize(fingerprint.screen);
			
			log(`📃 New page created for Profile ${cycleSpecificIndex}`, windowIndex);
		} catch (pageError) {
			log(`❌ Page creation failed for Profile ${cycleSpecificIndex}: ${pageError.message}`, windowIndex);
			updateProfileStatus(windowIndex, 'failed');
			failedWindows++;
			return;
		}

		// Inject comprehensive fingerprint scripts
		try {
			await injectFingerprint(page, fingerprint);
			log(`🔧 Comprehensive fingerprint injected for Profile ${cycleSpecificIndex}`, windowIndex);
		} catch (injectError) {
			log(`⚠️ Fingerprint injection failed for Profile ${cycleSpecificIndex}: ${injectError.message}`, windowIndex);
		}

		// Navigate to the page with comprehensive error handling
		try {
			// Check if stop was requested before starting navigation
			if (shouldStop) {
				log(`⏹️ Stopping Profile ${cycleSpecificIndex} - automation stopped`, windowIndex);
				updateProfileStatus(windowIndex, 'failed');
				failedWindows++;
				return;
			}

			log(`🌐 Loading website for Profile ${cycleSpecificIndex}: ${combinedURL}`, windowIndex);

			// Navigate with extended timeout for full loading
			await page.goto(combinedURL, {
				waitUntil: 'domcontentloaded',
				timeout: (timeout + 15) * 1000 // Extended timeout
			});

			log(`✅ Initial page load completed for Profile ${cycleSpecificIndex}`, windowIndex);

			// Wait for complete page load including all resources and ads
			const loadSuccess = await waitForCompletePageLoad(page, windowIndex, 30);
			
			if (loadSuccess) {
				log(`🎉 Website fully loaded for Profile ${cycleSpecificIndex}`, windowIndex);
			} else {
				log(`⚠️ Website loaded with warnings for Profile ${cycleSpecificIndex}`, windowIndex);
			}

		} catch (navError) {
			let errorMessage = navError.message;
			if (errorMessage.includes('Timeout')) {
				errorMessage = `❌ Page load timeout (${timeout + 15}s) - closing profile`;
			} else if (errorMessage.includes('net::ERR_')) {
				errorMessage = `❌ Network error: Unable to connect`;
			} else if (errorMessage.includes('ERR_NAME_NOT_RESOLVED')) {
				errorMessage = `❌ DNS error: Website address could not be resolved`;
			} else {
				errorMessage = `❌ Navigation failed: ${navError.message}`;
			}

			log(errorMessage, windowIndex);
			updateProfileStatus(windowIndex, 'failed');
			failedWindows++;
			return;
		}

		// Check if stop was requested after page load
		if (shouldStop) {
			log(`⏹️ Stopping Profile ${cycleSpecificIndex} - automation stopped`, windowIndex);
			updateProfileStatus(windowIndex, 'failed');
			failedWindows++;
			return;
		}

		log(`🕒 Starting ${waitTime}s session for Profile ${cycleSpecificIndex}`, windowIndex);
		updateProfileStatus(windowIndex, 'running');

		// Track this window after successful page load
		activeWindows.set(windowIndex, {
			browserInstance,
			startTime: Date.now(),
			waitTime,
			cycle
		});

		// Set up strict timeout to close the profile when wait time expires
		const strictTimeoutId = setTimeout(async () => {
			if (page && !page.isClosed() && !isCompleted) {
				isCompleted = true;
				log(`⏰ Session timeout (${waitTime}s) - closing Profile ${cycleSpecificIndex}`, windowIndex);
				updateProfileStatus(windowIndex, 'success');
				successWindows++;

				try {
					if (page && !page.isClosed()) {
						await page.close();
					}
					if (context) {
						await context.close();
					}
					if (browserInstance) {
						await browserInstance.close();
						const index = activeBrowsers.indexOf(browserInstance);
						if (index > -1) {
							activeBrowsers.splice(index, 1);
						}
					}

					activeWindows.delete(windowIndex);
					completedWindows++;

					log(`✅ Profile ${cycleSpecificIndex} completed by timeout (${completedWindows}/${totalWindows})`, windowIndex);
				} catch (timeoutCloseError) {
					log(`⚠️ Error during timeout cleanup: ${timeoutCloseError.message}`, windowIndex);
				}
			}
		}, waitTime * 1000);

		// Calculate time distribution
		let remainingTime = waitTime;
		let clickTime = Math.min(10, remainingTime * 0.3); // 30% for clicking, max 10s
		let scrollTime = remainingTime - clickTime - 5; // Leave 5s buffer
		
		if (remainingTime > 15) {
			log(`⏳ Waiting 5s before starting interactions...`, windowIndex);
			await page.waitForTimeout(5000);
			remainingTime -= 5;
		}

		// Phase 1: Random clicking and interaction
		if (clickTime > 0 && page && !page.isClosed() && !shouldStop && !isCompleted) {
			log(`🎯 Phase 1: Random clicking for ${clickTime}s`, windowIndex);
			try {
				await simulateRandomClicks(page, windowIndex, clickTime);
			} catch (clickError) {
				log(`⚠️ Click simulation error: ${clickError.message}`, windowIndex);
			}
		}

		// Phase 2: Scroll simulation
		if (scrollTime > 0 && page && !page.isClosed() && !shouldStop && !isCompleted) {
			log(`📜 Phase 2: Scroll simulation for ${scrollTime}s`, windowIndex);
			try {
				await simulateHumanScroll(page, scrollTime, windowIndex, strictTimeoutId);
			} catch (scrollError) {
				log(`⚠️ Scroll simulation error: ${scrollError.message}`, windowIndex);
			}
		}

		// Final wait
		if (page && !page.isClosed() && !shouldStop && !isCompleted) {
			await page.waitForTimeout(1000);
		}

		// Clear the timeout if we complete before time expires
		clearTimeout(strictTimeoutId);

		// Only log completion if we haven't been closed by timeout and not already completed
		if (page && !page.isClosed() && !isCompleted) {
			isCompleted = true;
			log(`✅ Profile ${cycleSpecificIndex} (Cycle ${cycle}) completed (${completedWindows + 1}/${totalWindows})`, windowIndex);
			updateProfileStatus(windowIndex, 'success');
			successWindows++;
		}

	} catch (err) {
		if (!isCompleted) {
			log(`❌ Error in Profile ${cycleSpecificIndex}: ${err.message}`, windowIndex);
			updateProfileStatus(windowIndex, 'failed');
			failedWindows++;
		}

		if (typeof strictTimeoutId !== 'undefined') {
			clearTimeout(strictTimeoutId);
		}
	} finally {
		if (typeof strictTimeoutId !== 'undefined') {
			clearTimeout(strictTimeoutId);
		}

		// Clean up resources
		try {
			if (page && !page.isClosed()) {
				await page.close();
			}
		} catch (closePageErr) {
			log(`⚠️ Failed to close page for Profile ${cycleSpecificIndex}: ${closePageErr.message}`, windowIndex);
		}

		try {
			if (context) {
				await context.close();
			}
		} catch (closeContextErr) {
			log(`⚠️ Failed to close context: ${closeContextErr.message}`, windowIndex);
		}

		try {
			if (browserInstance) {
				await browserInstance.close();
				const index = activeBrowsers.indexOf(browserInstance);
				if (index > -1) {
					activeBrowsers.splice(index, 1);
				}
			}
		} catch (closeBrowserErr) {
			log(`⚠️ Failed to close browser: ${closeBrowserErr.message}`, windowIndex);
		}

		// Remove from active windows
		activeWindows.delete(windowIndex);

		// Only increment completedWindows if not already completed by timeout
		if (!isCompleted) {
			completedWindows++;
		}
	}
}

async function runAutomation(config) {
	try {
		const {
			url,
			proxyURL,
			browser = 'random',
			openCount = 1,
			profilesAtOnce = 1,
			timeout = 30,
			minWaitTime = 45,
			maxWaitTime = 55
		} = config;

		log('🚀 Starting enhanced automation with config:', null);
		log(`   URL: ${url}`, null);
		log(`   Proxy: ${proxyURL}`, null);
		log(`   Browser: ${browser}`, null);
		log(`   Cycles: ${openCount}`, null);
		log(`   Profiles per cycle: ${profilesAtOnce}`, null);
		log(`   Timeout: ${timeout}s`, null);
		log(`   Wait time: ${minWaitTime}-${maxWaitTime}s`, null);

		// Clear previous profile logs
		clearProfileLogs();

		const totalCycles = Math.max(1, Math.min(parseInt(openCount), 20));
		profilesPerCycle = Math.max(1, Math.min(parseInt(profilesAtOnce), 10));

		totalWindows = totalCycles * profilesPerCycle;
		completedWindows = 0;
		failedWindows = 0;
		successWindows = 0;
		isAutomationInProgress = true;
		currentCycle = 1;
		updateGlobalCycleInfo(currentCycle, profilesPerCycle);

		// Reset stop state at the beginning
		resetStopState();

		log(`📊 Total profiles to run: ${totalWindows} (${totalCycles} cycles × ${profilesPerCycle} profiles)`, null);

		// Run automation cycles
		for (let cycle = 1; cycle <= totalCycles; cycle++) {
			currentCycle = cycle;
			updateGlobalCycleInfo(currentCycle, profilesPerCycle);

			// Check if stop was requested before starting this cycle
			if (shouldStop) {
				log(`⏹️ Stopping automation - cycle ${cycle} cancelled`);
				break;
			}

			// Clear logs from previous cycle to start fresh
			clearProfileLogs();

			log(`🔄 Starting Cycle ${cycle}/${totalCycles}`);

			// Create promises for all profiles in this cycle
			const waitTimes = getRandomWaitTimes(profilesPerCycle, minWaitTime, maxWaitTime);
			
			log(`⏱️ Wait times for this cycle: ${waitTimes.map(t => `${t}s`).join(', ')}`);

			const promises = Array.from({ length: profilesPerCycle }, (_, i) =>
				processWindow(
					(cycle - 1) * profilesPerCycle + i + 1,
					browser,
					url,
					proxyURL,
					waitTimes[i],
					cycle,
					timeout
				)
			);

			await Promise.allSettled(promises);

			// Check if stop was requested after this cycle
			if (shouldStop) {
				log(`⏹️ Stopping automation after cycle ${cycle}`);
				break;
			}

			log(`✅ Cycle ${cycle} completed`);

			// Small delay between cycles (except for the last cycle)
			if (cycle < totalCycles && !shouldStop) {
				log(`🕔 Waiting 5s before Cycle ${cycle + 1}...`);
				await new Promise((r) => setTimeout(r, 5000));
			}
		}

		if (shouldStop) {
			log(`🛑 Automation stopped by user request`);
		} else {
			log(`🎉 All ${totalCycles} cycles completed successfully!`);
		}

		// Reset automation state
		activeWindows.clear();
		completedWindows = 0;
		failedWindows = 0;
		successWindows = 0;
		totalWindows = 0;
		isAutomationInProgress = false;

	} catch (error) {
		log(`❌ Critical automation error: ${error.message}`);
		log(`Stack: ${error.stack}`);
		
		// Reset state on error
		activeWindows.clear();
		isAutomationInProgress = false;
		throw error;
	}
}

// Function to stop all active browsers
async function stopAllBrowsers() {
	log(`🛑 Closing ${activeBrowsers.length} active browsers...`);

	const closePromises = activeBrowsers.map(async (browser, index) => {
		try {
			await Promise.race([
				browser.close(),
				new Promise((resolve) => setTimeout(resolve, 3000))
			]);
			log(`✅ Browser ${index + 1} closed successfully`);
		} catch (e) {
			log(`⚠️ Error closing browser ${index + 1}: ${e.message}`);
			try {
				await browser.kill();
				log(`🔨 Browser ${index + 1} force killed`);
			} catch (killError) {
				log(`❌ Failed to force kill browser ${index + 1}: ${killError.message}`);
			}
		}
	});

	await Promise.race([
		Promise.allSettled(closePromises),
		new Promise((resolve) => setTimeout(resolve, 10000))
	]);

	activeBrowsers = [];
	log(`🛑 All browsers closed. Active browsers: ${activeBrowsers.length}`);
}

function getStatus() {
	const activeWindowDetails = Array.from(activeWindows.entries()).map(([windowIndex, data]) => {
		const elapsed = (Date.now() - data.startTime) / 1000;
		const remaining = Math.max(0, Math.ceil(data.waitTime - elapsed));
		return {
			windowIndex,
			elapsed: Math.round(elapsed),
			remaining,
			waitTime: data.waitTime,
			cycle: data.cycle
		};
	});

	return {
		totalWindows,
		completedWindows,
		failedWindows,
		successWindows,
		activeWindows: activeWindows.size,
		progress: totalWindows > 0 ? Math.round((completedWindows / totalWindows) * 100) : 0,
		activeWindowDetails,
		status: isAutomationInProgress
			? activeWindows.size > 0
				? 'running'
				: 'preparing'
			: completedWindows > 0
			? 'completed'
			: 'idle',
		shouldStop,
		currentCycle,
		profilesPerCycle
	};
}

module.exports = { runAutomation, getStatus, stopAutomation, stopAllBrowsers };