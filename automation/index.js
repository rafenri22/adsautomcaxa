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

		// Generate fingerprint
		let fingerprint;
		try {
			fingerprint = await generateFingerprint(proxyURL, browserChoice.name, 'desktop');
			log(`🔐 Generated fingerprint for Profile ${cycleSpecificIndex}`, windowIndex);
		} catch (fingerprintError) {
			log(`⚠️ Fingerprint generation failed, using defaults: ${fingerprintError.message}`, windowIndex);
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

		// Launch browser with error handling
		try {
			log(`🌐 Launching ${browserChoice.name} browser for Profile ${cycleSpecificIndex}`, windowIndex);
			browserInstance = await browserChoice.launcher.launch({
				headless: false,
				args: [
					'--no-sandbox',
					'--disable-setuid-sandbox',
					'--disable-dev-shm-usage',
					'--disable-accelerated-2d-canvas',
					'--no-first-run',
					'--no-zygote',
					'--single-process',
					'--disable-gpu'
				]
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

		// Create browser context
		try {
			context = await browserInstance.newContext({
				userAgent: fingerprint.userAgent,
				viewport: fingerprint.screen,
				locale: fingerprint.browserLanguages[0],
				timezoneId: fingerprint.timezone,
				deviceScaleFactor: fingerprint.deviceScaleFactor || 1,
				isMobile: fingerprint.isMobile || false,
				hasTouch: fingerprint.hasTouch || false
			});
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
			log(`📃 New page created for Profile ${cycleSpecificIndex}`, windowIndex);
		} catch (pageError) {
			log(`❌ Page creation failed for Profile ${cycleSpecificIndex}: ${pageError.message}`, windowIndex);
			updateProfileStatus(windowIndex, 'failed');
			failedWindows++;
			return;
		}

		// Inject fingerprint scripts
		try {
			await injectFingerprint(page, fingerprint);
			log(`🔧 Fingerprint injected for Profile ${cycleSpecificIndex}`, windowIndex);
		} catch (injectError) {
			log(`⚠️ Fingerprint injection failed for Profile ${cycleSpecificIndex}: ${injectError.message}`, windowIndex);
		}

		// Navigate to the page with proper error handling
		try {
			// Check if stop was requested before starting navigation
			if (shouldStop) {
				log(`⏹️ Stopping Profile ${cycleSpecificIndex} - automation stopped`, windowIndex);
				updateProfileStatus(windowIndex, 'failed');
				failedWindows++;
				return;
			}

			log(`🌐 Loading website for Profile ${cycleSpecificIndex}: ${combinedURL}`, windowIndex);

			// Navigate with timeout
			await page.goto(combinedURL, {
				waitUntil: 'domcontentloaded',
				timeout: timeout * 1000
			});

			log(`✅ Page loaded successfully for Profile ${cycleSpecificIndex}`, windowIndex);
		} catch (navError) {
			let errorMessage = navError.message;
			if (errorMessage.includes('Timeout')) {
				errorMessage = `❌ Page load timeout (${timeout}s) - closing profile`;
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

		// Perform scrolling and user simulation
		let usableScrollTime = waitTime;
		if (usableScrollTime > 10) {
			log(`⏳ Waiting 5s before starting scroll simulation...`, windowIndex);
			await page.waitForTimeout(5000);
			usableScrollTime -= 5;
		}

		// Only attempt scrolling if page is still available and not stopped
		if (page && !page.isClosed() && !shouldStop && !isCompleted) {
			try {
				await simulateHumanScroll(page, usableScrollTime, windowIndex, strictTimeoutId);
				await page.waitForTimeout(1000);
			} catch (scrollError) {
				log(`⚠️ Scroll simulation error: ${scrollError.message}`, windowIndex);
			}
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

		log('🚀 Starting automation with config:', null);
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