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

// Enhanced ad clicking function with aggressive detection and clicking
async function clickAdsAggressively(page, profileIndex, duration = 15) {
	if (!page || page.isClosed()) return;
	
	log(`🎯 Starting aggressive ad detection and clicking for ${duration}s`, profileIndex);
	
	try {
		const endTime = Date.now() + (duration * 1000);
		let clickCount = 0;
		let adClickCount = 0;
		
		while (Date.now() < endTime && !page.isClosed()) {
			try {
				// Comprehensive ad selectors including the specific ones mentioned
				const adSelectors = [
					// General ad selectors
					'.ads', '.ad', '.advertisement', '.google-ad', '.adsense',
					'[class*="ad-"]', '[id*="ad-"]', '[class*="ads-"]', '[id*="ads-"]',
					'ins.adsbygoogle', '.adsbygoogle',
					'[class*="banner"]', '[id*="banner"]', '.sponsor', '.sponsored',
					'[data-ad]', '[data-ads]', '.ad-container', '.ads-container',
					
					// Specific ad network selectors
					'[src*="profitableratecpm.com"]',
					'[src*="highperformanceformat.com"]',
					'[data-key*="dac5bd782390c09ca3783e4361641fe1"]',
					'[data-key*="bed062db9e271d1ad41b99f36e2c623c"]',
					
					// Common ad iframe selectors
					'iframe[src*="doubleclick"]', 
					'iframe[src*="googlesyndication"]',
					'iframe[src*="googletagmanager"]',
					'iframe[src*="profitableratecpm"]',
					'iframe[src*="highperformanceformat"]',
					
					// Banner size specific
					'[width="320"][height="50"]',
					'[style*="width: 320px"][style*="height: 50px"]',
					'.banner-320x50', '#banner-320x50',
					
					// Social bar and popunder elements
					'[class*="social-bar"]', '[id*="social-bar"]',
					'[class*="popunder"]', '[id*="popunder"]'
				];
				
				// Search for clickable ad elements
				const clickableAds = await page.evaluate((selectors) => {
					const elements = [];
					
					selectors.forEach(selector => {
						try {
							const found = document.querySelectorAll(selector);
							found.forEach(el => {
								const rect = el.getBoundingClientRect();
								const style = window.getComputedStyle(el);
								const isClickable = el.tagName === 'A' || el.onclick || el.style.cursor === 'pointer' || 
												  el.getAttribute('onclick') || el.getAttribute('href');
								
								if (rect.width > 20 && rect.height > 20 && 
									style.display !== 'none' && 
									style.visibility !== 'hidden' &&
									style.opacity !== '0' &&
									rect.top >= -100 && rect.top <= window.innerHeight + 100) {
									elements.push({
										selector: selector,
										x: rect.left + rect.width / 2,
										y: rect.top + rect.height / 2,
										width: rect.width,
										height: rect.height,
										isClickable: isClickable,
										tagName: el.tagName,
										href: el.href || null,
										onclick: el.onclick ? true : false
									});
								}
							});
						} catch (e) {
							// Continue with next selector
						}
					});
					return elements;
				}, adSelectors);
				
				// Also search for any links that might be ad links
				const adLinks = await page.evaluate(() => {
					const links = Array.from(document.querySelectorAll('a[href*="profitableratecpm"], a[href*="highperformanceformat"], a[href*="cpm"], a[href*="ads"], a[href*="click"]'));
					return links.map(link => {
						const rect = link.getBoundingClientRect();
						if (rect.width > 10 && rect.height > 10 && rect.top >= 0 && rect.top <= window.innerHeight) {
							return {
								x: rect.left + rect.width / 2,
								y: rect.top + rect.height / 2,
								width: rect.width,
								height: rect.height,
								href: link.href,
								text: link.textContent.trim().substring(0, 50)
							};
						}
						return null;
					}).filter(Boolean);
				});
				
				const allPotentialAds = [...clickableAds, ...adLinks];
				
				if (allPotentialAds.length > 0) {
					log(`🎯 Found ${allPotentialAds.length} potential ad elements`, profileIndex);
					
					// Click on ads with high priority
					for (const ad of allPotentialAds.slice(0, 3)) {
						if (!page || page.isClosed()) break;
						
						try {
							// Scroll to ad if needed
							await page.evaluate((x, y) => {
								if (y < 0 || y > window.innerHeight) {
									window.scrollTo({
										top: window.scrollY + y - window.innerHeight / 2,
										behavior: 'smooth'
									});
								}
							}, ad.x, ad.y);
							
							await page.waitForTimeout(1000 + Math.random() * 1500);
							
							// Add some randomization to click position
							const clickX = ad.x + (Math.random() * 10 - 5);
							const clickY = ad.y + (Math.random() * 10 - 5);
							
							// Move mouse to position smoothly
							await page.mouse.move(clickX, clickY, { steps: 8 + Math.random() * 12 });
							await page.waitForTimeout(500 + Math.random() * 1000);
							
							log(`🖱️ Clicking ad at (${Math.round(clickX)}, ${Math.round(clickY)}) - ${ad.href || ad.selector}`, profileIndex);
							
							// Handle potential popups/new tabs before clicking
							const currentPages = await page.context().pages();
							
							// Click the ad
							await page.mouse.click(clickX, clickY);
							adClickCount++;
							clickCount++;
							
							// Wait a bit to see if new tab/popup opened
							await page.waitForTimeout(2000);
							
							// Check for new pages/popups
							const newPages = await page.context().pages();
							if (newPages.length > currentPages.length) {
								log(`🆕 New tab/popup opened from ad click`, profileIndex);
								// Close any new tabs after a short delay (to register the click)
								for (let i = currentPages.length; i < newPages.length; i++) {
									const newPage = newPages[i];
									await page.waitForTimeout(3000 + Math.random() * 2000);
									try {
										await newPage.close();
										log(`❌ Closed popup/new tab`, profileIndex);
									} catch (e) {
										log(`⚠️ Could not close popup: ${e.message}`, profileIndex);
									}
								}
							}
							
							// Wait before next ad click
							await page.waitForTimeout(3000 + Math.random() * 5000);
							
						} catch (clickError) {
							log(`⚠️ Error clicking ad: ${clickError.message}`, profileIndex);
						}
					}
				}
				
				// Also look for and click regular content occasionally for natural behavior
				if (Math.random() < 0.3) {
					const regularElements = await page.evaluate(() => {
						const elements = [];
						const selectors = ['p', 'h1', 'h2', 'h3', 'span', 'div[role="button"]', 'button'];
						
						selectors.forEach(selector => {
							const found = document.querySelectorAll(selector);
							found.forEach(el => {
								const rect = el.getBoundingClientRect();
								if (rect.width > 50 && rect.height > 20 && 
									rect.top >= 0 && rect.top <= window.innerHeight) {
									elements.push({
										x: rect.left + rect.width / 2,
										y: rect.top + rect.height / 2,
									});
								}
							});
						});
						return elements.slice(0, 5);
					});
					
					if (regularElements.length > 0) {
						const element = regularElements[Math.floor(Math.random() * regularElements.length)];
						const clickX = element.x + (Math.random() * 20 - 10);
						const clickY = element.y + (Math.random() * 20 - 10);
						
						await page.mouse.move(clickX, clickY, { steps: 5 });
						await page.waitForTimeout(200 + Math.random() * 500);
						
						if (Math.random() < 0.4) {
							await page.mouse.click(clickX, clickY);
							clickCount++;
							log(`🎯 Clicked regular content at (${Math.round(clickX)}, ${Math.round(clickY)})`, profileIndex);
						}
					}
				}
				
				// Random pause between detection cycles
				await page.waitForTimeout(4000 + Math.random() * 6000);
				
			} catch (detectionError) {
				log(`⚠️ Error in ad detection cycle: ${detectionError.message}`, profileIndex);
				await page.waitForTimeout(2000);
			}
		}
		
		log(`✅ Ad clicking completed - ${adClickCount} ads clicked, ${clickCount} total clicks`, profileIndex);
		
	} catch (error) {
		log(`❌ Ad clicking simulation failed: ${error.message}`, profileIndex);
	}
}

// Function to wait for complete page load including ads
async function waitForCompletePageLoad(page, profileIndex, timeout = 45) {
	if (!page || page.isClosed()) return false;
	
	log(`⏳ Waiting for complete page load (${timeout}s timeout)...`, profileIndex);
	
	try {
		// Wait for network to be idle first
		await page.waitForLoadState('domcontentloaded', { timeout: timeout * 1000 });
		log(`📄 DOM content loaded`, profileIndex);
		
		// Wait a bit more for dynamic content
		await page.waitForTimeout(3000);
		
		// Wait for network to be mostly idle
		await page.waitForLoadState('networkidle', { timeout: (timeout - 10) * 1000 });
		log(`📡 Network activity settled`, profileIndex);
		
		// Additional wait for ads and dynamic content to load
		await page.waitForTimeout(5000);
		
		// Try to execute JavaScript to ensure the page is interactive
		await page.evaluate(() => {
			return new Promise((resolve) => {
				// Check if ads are loading
				const checkAdsLoaded = () => {
					const adElements = document.querySelectorAll('.ad, .ads, .advertisement, iframe[src*="ads"], script[src*="ads"]');
					console.log(`Found ${adElements.length} ad elements`);
					resolve(true);
				};
				
				if (document.readyState === 'complete') {
					setTimeout(checkAdsLoaded, 2000);
				} else {
					window.addEventListener('load', () => {
						setTimeout(checkAdsLoaded, 2000);
					});
				}
			});
		});
		
		log(`✅ Page fully loaded with ads and dynamic content`, profileIndex);
		return true;
		
	} catch (loadError) {
		log(`⚠️ Page load timeout: ${loadError.message}`, profileIndex);
		return true; // Continue anyway
	}
}

// Function to process a single window
async function processWindow(
	windowIndex,
	browser,
	targetURL, // Direct URL without proxy for better loading
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

		// Launch browser with enhanced configuration for better website loading
		try {
			log(`🌐 Launching ${browserChoice.name} browser for Profile ${cycleSpecificIndex}`, windowIndex);
			
			// Enhanced browser arguments for better website loading
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
				'--disable-popup-blocking',
				'--disable-prompt-on-repost',
				'--disable-sync',
				'--metrics-recording-only',
				'--no-report-upload',
				'--safebrowsing-disable-auto-update',
				'--enable-automation',
				'--password-store=basic',
				'--use-mock-keychain',
				// Enable all content loading
				'--disable-web-security',
				'--disable-features=TranslateUI',
				'--allow-running-insecure-content',
				'--disable-site-isolation-trials',
				'--disable-cross-origin-restrictions',
				// Allow all resources and scripts
				'--enable-javascript',
				'--enable-plugins',
				'--allow-outdated-plugins',
				// GPU and rendering
				'--enable-gpu',
				'--enable-accelerated-2d-canvas',
				'--enable-accelerated-jpeg-decoding',
				'--enable-accelerated-mjpeg-decode',
				'--enable-accelerated-video-decode',
				'--max_old_space_size=4096',
				'--disable-dev-shm-usage',
				'--disable-software-rasterizer'
			];

			browserInstance = await browserChoice.launcher.launch({
				headless: false,
				args: browserArgs,
				ignoreDefaultArgs: ['--enable-automation'],
				executablePath: undefined,
				slowMo: 50 + Math.random() * 100
			});
			
			log(`✅ Browser launched successfully for Profile ${cycleSpecificIndex}`, windowIndex);
		} catch (launchError) {
			log(`❌ Browser launch failed for Profile ${cycleSpecificIndex}: ${launchError.message}`, windowIndex);
			updateProfileStatus(windowIndex, 'failed');
			failedWindows++;
			return;
		}

		// Add to active browsers for stop functionality
		activeBrowsers.push(browserInstance);

		// Create browser context with enhanced settings for better loading
		try {
			const contextOptions = {
				userAgent: fingerprint.userAgent,
				viewport: fingerprint.screen,
				locale: fingerprint.browserLanguages[0],
				timezoneId: fingerprint.timezone,
				deviceScaleFactor: fingerprint.deviceScaleFactor || 1,
				isMobile: fingerprint.isMobile || false,
				hasTouch: fingerprint.hasTouch || false,
				permissions: ['geolocation', 'notifications', 'camera', 'microphone'],
				geolocation: fingerprint.geolocation || { latitude: 40.7128, longitude: -74.0060 },
				acceptDownloads: true,
				javaScriptEnabled: true,
				extraHTTPHeaders: {
					'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
					'Accept-Language': fingerprint.browserLanguages.join(',') + ';q=0.9',
					'Accept-Encoding': 'gzip, deflate, br',
					'Cache-Control': 'no-cache',
					'Pragma': 'no-cache',
					'Sec-Fetch-Dest': 'document',
					'Sec-Fetch-Mode': 'navigate',
					'Sec-Fetch-Site': 'none',
					'Sec-Fetch-User': '?1',
					'Upgrade-Insecure-Requests': '1'
				}
			};
			
			// Use proxy if needed but configure it properly
			if (proxyURL && !proxyURL.includes('api.scrape.do')) {
				// Only use direct proxy, not scraping service
				const proxyMatch = proxyURL.match(/http:\/\/([^:]+):(\d+)/);
				if (proxyMatch) {
					contextOptions.proxy = {
						server: proxyURL,
					};
				}
			}
			
			context = await browserInstance.newContext(contextOptions);
			log(`📄 Browser context created for Profile ${cycleSpecificIndex}`, windowIndex);
		} catch (contextError) {
			log(`❌ Context creation failed for Profile ${cycleSpecificIndex}: ${contextError.message}`, windowIndex);
			updateProfileStatus(windowIndex, 'failed');
			failedWindows++;
			return;
		}

		// Create new page
		try {
			page = await context.newPage();
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

		// Navigate to the page directly (without proxy for better loading)
		try {
			if (shouldStop) {
				log(`⏹️ Stopping Profile ${cycleSpecificIndex} - automation stopped`, windowIndex);
				updateProfileStatus(windowIndex, 'failed');
				failedWindows++;
				return;
			}

			log(`🌐 Loading website directly for better performance: ${targetURL}`, windowIndex);

			// Navigate directly to target URL for full CSS/JS loading
			await page.goto(targetURL, {
				waitUntil: 'domcontentloaded',
				timeout: (timeout + 15) * 1000
			});

			log(`✅ Initial page load completed for Profile ${cycleSpecificIndex}`, windowIndex);

			// Wait for complete page load including all resources and ads
			const loadSuccess = await waitForCompletePageLoad(page, windowIndex, 35);
			
			if (loadSuccess) {
				log(`🎉 Website fully loaded with all resources for Profile ${cycleSpecificIndex}`, windowIndex);
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

		// Calculate time distribution with more focus on ad clicking
		let remainingTime = waitTime;
		let adClickTime = Math.min(15, remainingTime * 0.4); // 40% for ad clicking, max 15s
		let scrollTime = remainingTime - adClickTime - 5; // Leave 5s buffer
		
		if (remainingTime > 15) {
			log(`⏳ Waiting 5s before starting interactions...`, windowIndex);
			await page.waitForTimeout(5000);
			remainingTime -= 5;
		}

		// Phase 1: Aggressive ad clicking
		if (adClickTime > 0 && page && !page.isClosed() && !shouldStop && !isCompleted) {
			log(`🎯 Phase 1: Aggressive ad detection and clicking for ${adClickTime}s`, windowIndex);
			try {
				await clickAdsAggressively(page, windowIndex, adClickTime);
			} catch (adError) {
				log(`⚠️ Ad clicking error: ${adError.message}`, windowIndex);
			}
		}

		// Phase 2: Scroll simulation with continued ad awareness
		if (scrollTime > 0 && page && !page.isClosed() && !shouldStop && !isCompleted) {
			log(`📜 Phase 2: Scroll with ad awareness for ${scrollTime}s`, windowIndex);
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

		log('🚀 Starting enhanced automation with aggressive ad clicking:', null);
		log(`   URL: ${url}`, null);
		log(`   Proxy: ${proxyURL}`, null);
		log(`   Browser: ${browser}`, null);
		log(`   Cycles: ${openCount}`, null);
		log(`   Profiles per cycle: ${profilesAtOnce}`, null);
		log(`   Timeout: ${timeout}s`, null);
		log(`   Wait time: ${minWaitTime}-${maxWaitTime}s`, null);

		// Extract target URL from proxy URL if needed
		let targetURL = url;
		if (url.includes('api.scrape.do') && url.includes('url=')) {
			const urlMatch = url.match(/url=([^&]+)/);
			if (urlMatch) {
				targetURL = decodeURIComponent(urlMatch[1]);
				log(`🎯 Extracted target URL: ${targetURL}`, null);
			}
		}

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

			log(`🔄 Starting Cycle ${cycle}/${totalCycles} with aggressive ad clicking`);

			// Create promises for all profiles in this cycle
			const waitTimes = getRandomWaitTimes(profilesPerCycle, minWaitTime, maxWaitTime);
			
			log(`⏱️ Wait times for this cycle: ${waitTimes.map(t => `${t}s`).join(', ')}`);

			const promises = Array.from({ length: profilesPerCycle }, (_, i) =>
				processWindow(
					(cycle - 1) * profilesPerCycle + i + 1,
					browser,
					targetURL, // Use direct URL
					proxyURL,  // Keep proxy info for fingerprinting
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

			log(`✅ Cycle ${cycle} completed with ad interactions`);

			// Small delay between cycles (except for the last cycle)
			if (cycle < totalCycles && !shouldStop) {
				log(`🕔 Waiting 5s before Cycle ${cycle + 1}...`);
				await new Promise((r) => setTimeout(r, 5000));
			}
		}

		if (shouldStop) {
			log(`🛑 Automation stopped by user request`);
		} else {
			log(`🎉 All ${totalCycles} cycles completed with aggressive ad clicking!`);
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