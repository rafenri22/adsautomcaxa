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

// Enhanced direct link viewer functionality
async function visitDirectLink(page, profileIndex, directURL, duration = 15) {
	if (!page || page.isClosed()) return;
	
	log(`🎯 Starting DIRECT LINK visit: ${directURL}`, profileIndex);
	
	try {
		// Navigate to direct link with realistic behavior
		log(`🌐 Loading direct link...`, profileIndex);
		
		await page.goto(directURL, {
			waitUntil: 'domcontentloaded',
			timeout: 30000
		});
		
		// Wait for complete page load
		await page.waitForLoadState('networkidle', { timeout: 25000 });
		
		log(`✅ Direct link loaded successfully`, profileIndex);
		
		// Simulate realistic user behavior on the direct link
		const endTime = Date.now() + (duration * 1000);
		
		while (Date.now() < endTime && !page.isClosed()) {
			try {
				// Random mouse movements
				const x = Math.random() * 1200 + 100;
				const y = Math.random() * 800 + 100;
				await page.mouse.move(x, y);
				await page.waitForTimeout(500 + Math.random() * 1000);
				
				// Simulate scrolling
				if (Math.random() < 0.6) {
					const scrollDirection = Math.random() < 0.7 ? 'down' : 'up';
					const scrollAmount = Math.random() * 300 + 100;
					
					await page.evaluate(({ direction, amount }) => {
						const currentY = window.scrollY;
						const targetY = direction === 'down' 
							? currentY + amount 
							: Math.max(0, currentY - amount);
						
						window.scrollTo({
							top: targetY,
							behavior: 'smooth'
						});
					}, { direction: scrollDirection, amount: scrollAmount });
					
					await page.waitForTimeout(1000 + Math.random() * 2000);
				}
				
				// Click on elements occasionally (but avoid ads to prevent infinite redirects)
				if (Math.random() < 0.3) {
					const clickableElements = await page.evaluate(() => {
						const elements = Array.from(document.querySelectorAll('button, a:not([href*="ads"]):not([href*="click"]), input[type="button"]'));
						return elements.map(el => {
							const rect = el.getBoundingClientRect();
							if (rect.width > 20 && rect.height > 20 && rect.top >= 0 && rect.top <= window.innerHeight) {
								return {
									x: rect.left + rect.width / 2,
									y: rect.top + rect.height / 2,
									tagName: el.tagName,
									text: el.textContent ? el.textContent.trim().substring(0, 30) : ''
								};
							}
							return null;
						}).filter(Boolean);
					});
					
					if (clickableElements.length > 0) {
						const element = clickableElements[Math.floor(Math.random() * clickableElements.length)];
						await page.mouse.click(element.x, element.y);
						log(`👆 Clicked on ${element.tagName}: ${element.text}`, profileIndex);
						await page.waitForTimeout(2000 + Math.random() * 3000);
					}
				}
				
				// Reading behavior - pause and focus on content
				if (Math.random() < 0.4) {
					await page.evaluate(() => {
						const headings = document.querySelectorAll('h1, h2, h3, p');
						if (headings.length > 0) {
							const heading = headings[Math.floor(Math.random() * headings.length)];
							heading.scrollIntoView({ behavior: 'smooth', block: 'center' });
						}
					});
					
					const readingTime = 2000 + Math.random() * 5000;
					log(`📖 Reading content for ${Math.round(readingTime/1000)}s`, profileIndex);
					await page.waitForTimeout(readingTime);
				}
				
				// Wait between actions
				await page.waitForTimeout(1000 + Math.random() * 2000);
				
			} catch (actionError) {
				log(`⚠️ Error during direct link interaction: ${actionError.message}`, profileIndex);
				await page.waitForTimeout(2000);
			}
		}
		
		log(`🎉 Direct link visit completed - ${duration}s session`, profileIndex);
		
	} catch (error) {
		log(`❌ Direct link visit failed: ${error.message}`, profileIndex);
	}
}

// Enhanced ad detection and clicking with focus on specific ad networks
async function detectAndClickProfitableRateAds(page, profileIndex, duration = 20) {
	if (!page || page.isClosed()) return;
	
	log(`🎯 Starting LEGIT ad detection for ProfitableRate & HighPerformance ads (${duration}s)`, profileIndex);
	
	try {
		const endTime = Date.now() + (duration * 1000);
		let adClickCount = 0;
		let realAdClickCount = 0;
		
		while (Date.now() < endTime && !page.isClosed()) {
			try {
				// Wait for ads to fully load
				await page.waitForTimeout(2000);
				
				// Comprehensive detection for ProfitableRateCPM and HighPerformanceFormat ads
				const adElements = await page.evaluate(() => {
					const foundAds = [];
					
					// 1. Direct script-generated ad links and elements
					const directLinks = document.querySelectorAll('a[href*="profitableratecpm.com"], a[href*="highperformanceformat.com"]');
					directLinks.forEach(link => {
						const rect = link.getBoundingClientRect();
						if (rect.width > 10 && rect.height > 10 && rect.top >= -50 && rect.top <= window.innerHeight + 50) {
							foundAds.push({
								type: 'direct_link',
								element: 'a',
								x: rect.left + rect.width / 2,
								y: rect.top + rect.height / 2,
								width: rect.width,
								height: rect.height,
								href: link.href,
								text: link.textContent ? link.textContent.trim().substring(0, 30) : '',
								priority: 10 // Highest priority
							});
						}
					});
					
					// 2. Look for iframe ads from these networks
					const iframes = document.querySelectorAll('iframe[src*="profitableratecpm.com"], iframe[src*="highperformanceformat.com"], iframe[src*="pl27406930"], iframe[src*="pl27406938"]');
					iframes.forEach(iframe => {
						const rect = iframe.getBoundingClientRect();
						if (rect.width > 50 && rect.height > 30) {
							foundAds.push({
								type: 'iframe_ad',
								element: 'iframe',
								x: rect.left + rect.width / 2,
								y: rect.top + rect.height / 2,
								width: rect.width,
								height: rect.height,
								src: iframe.src,
								priority: 9
							});
						}
					});
					
					// 3. Look for banner ads with specific data-key attributes
					const bannerAds = document.querySelectorAll('[data-key="dac5bd782390c09ca3783e4361641fe1"], [data-key="bed062db9e271d1ad41b99f36e2c623c"]');
					bannerAds.forEach(banner => {
						const rect = banner.getBoundingClientRect();
						if (rect.width > 0 && rect.height > 0) {
							foundAds.push({
								type: 'banner_ad',
								element: banner.tagName.toLowerCase(),
								x: rect.left + rect.width / 2,
								y: rect.top + rect.height / 2,
								width: rect.width,
								height: rect.height,
								dataKey: banner.getAttribute('data-key'),
								priority: 9
							});
						}
					});
					
					// 4. Look for 320x50 banner dimensions specifically
					const banners320x50 = document.querySelectorAll('div[style*="width: 320px"], div[style*="height: 50px"], iframe[width="320"][height="50"]');
					banners320x50.forEach(banner => {
						const rect = banner.getBoundingClientRect();
						if ((rect.width === 320 && rect.height === 50) || (rect.width >= 300 && rect.width <= 340 && rect.height >= 40 && rect.height <= 60)) {
							// Check if it's likely an ad
							const parent = banner.parentElement;
							const hasAdClass = banner.className.toLowerCase().includes('ad') || 
											 parent?.className.toLowerCase().includes('ad') ||
											 banner.id.toLowerCase().includes('ad') ||
											 parent?.id.toLowerCase().includes('ad');
							
							if (hasAdClass || banner.tagName === 'IFRAME') {
								foundAds.push({
									type: '320x50_banner',
									element: banner.tagName.toLowerCase(),
									x: rect.left + rect.width / 2,
									y: rect.top + rect.height / 2,
									width: rect.width,
									height: rect.height,
									className: banner.className,
									priority: 8
								});
							}
						}
					});
					
					// 5. Look for popunder and social bar containers
					const popunderElements = document.querySelectorAll('[id*="social-bar"], [class*="social-bar"], [id*="popunder"], [class*="popunder"], div[style*="position: fixed"], div[style*="z-index"]');
					popunderElements.forEach(element => {
						if (element.children.length > 0) {
							// Look for clickable children
							const clickableChildren = element.querySelectorAll('a, button, div[onclick], [style*="cursor: pointer"]');
							clickableChildren.forEach(child => {
								const rect = child.getBoundingClientRect();
								if (rect.width > 20 && rect.height > 20) {
									foundAds.push({
										type: 'popunder_element',
										element: child.tagName.toLowerCase(),
										x: rect.left + rect.width / 2,
										y: rect.top + rect.height / 2,
										width: rect.width,
										height: rect.height,
										href: child.href || null,
										priority: 7
									});
								}
							});
						}
					});
					
					// 6. Look for ads generated by script injection (check for specific script sources)
					const scriptAds = [];
					const scripts = document.querySelectorAll('script[src*="profitableratecpm.com"], script[src*="highperformanceformat.com"]');
					if (scripts.length > 0) {
						// Look for elements that might have been injected by these scripts
						const possibleInjectedAds = document.querySelectorAll('div[id]:not([id=""]), a[target="_blank"]:not([href*="javascript"]), iframe:not([src=""])');
						possibleInjectedAds.forEach(element => {
							const rect = element.getBoundingClientRect();
							if (rect.width > 50 && rect.height > 20 && rect.top >= -100 && rect.top <= window.innerHeight + 100) {
								const style = window.getComputedStyle(element);
								if (style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0') {
									foundAds.push({
										type: 'script_injected',
										element: element.tagName.toLowerCase(),
										x: rect.left + rect.width / 2,
										y: rect.top + rect.height / 2,
										width: rect.width,
										height: rect.height,
										href: element.href || element.src || null,
										priority: 6
									});
								}
							}
						});
					}
					
					// Sort by priority (higher priority first)
					return foundAds.sort((a, b) => b.priority - a.priority);
				});
				
				if (adElements.length > 0) {
					log(`🎯 Found ${adElements.length} potential ad elements`, profileIndex);
					
					// Focus on highest priority ads first
					for (const ad of adElements.slice(0, 2)) {
						if (!page || page.isClosed()) break;
						if (Date.now() >= endTime) break;
						
						try {
							// Scroll to ad for visibility - FIX: Pass single object parameter
							await page.evaluate((adData) => {
								const { x, y } = adData;
								if (y < 50 || y > window.innerHeight - 50) {
									window.scrollTo({
										top: window.scrollY + y - window.innerHeight / 2,
										behavior: 'smooth'
									});
								}
							}, { x: ad.x, y: ad.y });
							
							await page.waitForTimeout(1500 + Math.random() * 2000);
							
							// More realistic mouse movement to ad
							const viewportSize = page.viewportSize();
							const startX = Math.random() * viewportSize.width;
							const startY = Math.random() * viewportSize.height;
							
							// Move to ad with human-like path
							await page.mouse.move(startX, startY);
							await page.waitForTimeout(100 + Math.random() * 300);
							
							const steps = 8 + Math.random() * 8;
							for (let i = 1; i <= steps; i++) {
								const progress = i / steps;
								const currentX = startX + (ad.x - startX) * progress + (Math.random() * 10 - 5);
								const currentY = startY + (ad.y - startY) * progress + (Math.random() * 10 - 5);
								await page.mouse.move(currentX, currentY);
								await page.waitForTimeout(20 + Math.random() * 50);
							}
							
							// Hover before clicking (more human-like)
							await page.waitForTimeout(300 + Math.random() * 700);
							
							log(`🖱️ CLICKING ${ad.type} ad at (${Math.round(ad.x)}, ${Math.round(ad.y)})`, profileIndex);
							if (ad.href) log(`   ↳ Target: ${ad.href}`, profileIndex);
							if (ad.dataKey) log(`   ↳ Data-key: ${ad.dataKey}`, profileIndex);
							
							// Record current page count for popup detection
							const currentPages = await page.context().pages();
							
							// Click with slight randomization
							const clickX = ad.x + (Math.random() * 6 - 3);
							const clickY = ad.y + (Math.random() * 6 - 3);
							
							// Perform the click
							await page.mouse.click(clickX, clickY, { delay: 50 + Math.random() * 100 });
							adClickCount++;
							realAdClickCount++;
							
							log(`✅ CLICKED ad successfully!`, profileIndex);
							
							// Wait for potential page changes or popups
							await page.waitForTimeout(3000 + Math.random() * 2000);
							
							// Check for new tabs/popups
							const newPages = await page.context().pages();
							if (newPages.length > currentPages.length) {
								log(`🆕 Ad click opened ${newPages.length - currentPages.length} new tab(s) - TRAFFIC REGISTERED!`, profileIndex);
								
								// Keep popup open longer to register traffic, then close
								for (let pageIndex = currentPages.length; pageIndex < newPages.length; pageIndex++) {
									const newPage = newPages[pageIndex];
									try {
										// Wait longer before closing to ensure traffic is registered
										await page.waitForTimeout(8000 + Math.random() * 4000);
										await newPage.close();
										log(`❌ Closed popup after traffic registration`, profileIndex);
									} catch (e) {
										log(`⚠️ Could not close popup: ${e.message}`, profileIndex);
									}
								}
							}
							
							// Wait before next click to avoid rate limiting
							await page.waitForTimeout(8000 + Math.random() * 7000);
							
						} catch (clickError) {
							log(`⚠️ Error clicking ${ad.type} ad: ${clickError.message}`, profileIndex);
						}
					}
				}
				
				// Also perform some natural browsing to make it look legit
				if (Math.random() < 0.4) {
					const naturalElements = await page.evaluate(() => {
						const elements = [];
						const selectors = ['h1', 'h2', 'h3', 'p', 'article', 'section'];
						
						selectors.forEach(selector => {
							const found = document.querySelectorAll(selector);
							found.forEach(el => {
								const rect = el.getBoundingClientRect();
								if (rect.width > 100 && rect.height > 30 && 
									rect.top >= 0 && rect.top <= window.innerHeight) {
									elements.push({
										x: rect.left + rect.width / 2,
										y: rect.top + rect.height / 2,
									});
								}
							});
						});
						return elements.slice(0, 3);
					});
					
					if (naturalElements.length > 0) {
						const element = naturalElements[Math.floor(Math.random() * naturalElements.length)];
						await page.mouse.move(element.x + (Math.random() * 50 - 25), element.y + (Math.random() * 50 - 25));
						await page.waitForTimeout(500 + Math.random() * 1500);
						
						if (Math.random() < 0.3) {
							await page.mouse.click(element.x, element.y);
							log(`📖 Clicked content for natural browsing pattern`, profileIndex);
						}
					}
				}
				
				// Wait before next ad detection cycle
				await page.waitForTimeout(5000 + Math.random() * 5000);
				
			} catch (detectionError) {
				log(`⚠️ Error in ad detection cycle: ${detectionError.message}`, profileIndex);
				await page.waitForTimeout(3000);
			}
		}
		
		log(`🎉 LEGIT ad clicking completed - ${realAdClickCount} real ads clicked, ${adClickCount} total interactions`, profileIndex);
		
	} catch (error) {
		log(`❌ Legit ad clicking failed: ${error.message}`, profileIndex);
	}
}

// Function to wait for complete page load including ads
async function waitForCompletePageLoad(page, profileIndex, timeout = 45) {
	if (!page || page.isClosed()) return false;
	
	log(`⏳ Waiting for complete page load with ads (${timeout}s timeout)...`, profileIndex);
	
	try {
		// Wait for basic page load
		await page.waitForLoadState('domcontentloaded', { timeout: timeout * 1000 });
		log(`📄 DOM content loaded`, profileIndex);
		
		// Wait for network to settle
		await page.waitForLoadState('networkidle', { timeout: (timeout - 10) * 1000 });
		log(`📡 Network idle`, profileIndex);
		
		// Additional wait for ad scripts to execute
		await page.waitForTimeout(8000);
		
		// Check if ad scripts have loaded
		await page.evaluate(() => {
			return new Promise((resolve) => {
				let checkCount = 0;
				const checkAds = () => {
					checkCount++;
					const adScripts = document.querySelectorAll('script[src*="profitableratecpm"], script[src*="highperformanceformat"]');
					const adElements = document.querySelectorAll('[data-key], iframe[src*="ads"], a[href*="profitableratecpm"]');
					
					console.log(`Ad check ${checkCount}: ${adScripts.length} scripts, ${adElements.length} elements`);
					
					if (checkCount >= 5 || adElements.length > 0) {
						resolve(true);
					} else {
						setTimeout(checkAds, 2000);
					}
				};
				checkAds();
			});
		});
		
		log(`✅ Page fully loaded with ad elements ready`, profileIndex);
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
	targetURL,
	proxyURL,
	waitTime,
	cycle,
	timeout = 30,
	isDirectLinkOnly = false
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

		log(`🚀 Opening Profile ${cycleSpecificIndex} (Cycle ${cycle})${isDirectLinkOnly ? ' - DIRECT LINK ONLY' : ''}`, windowIndex);
		updateProfileStatus(windowIndex, 'waiting');

		// Select browser (only Chrome or Edge)
		const browserChoice = browser !== 'random' ? getBrowserByName(browser) : getRandomBrowser();
		if (!browserChoice || !['chromium', 'webkit'].includes(browserChoice.name)) {
			// Force Chrome if invalid browser
			browserChoice = { name: 'chromium', launcher: chromium };
		}

		log(`🌐 Using browser: ${browserChoice.name} for Profile ${cycleSpecificIndex}`, windowIndex);

		// Generate comprehensive fingerprint with mobile support
		let fingerprint;
		try {
			const deviceCategory = Math.random() < 0.3 ? 'mobile' : 'desktop'; // 30% mobile
			fingerprint = await generateFingerprint(proxyURL, browserChoice.name, deviceCategory);
			log(`🔐 Generated ${deviceCategory} fingerprint for Profile ${cycleSpecificIndex}`, windowIndex);
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

		// Launch browser with optimized settings for ad loading
		try {
			log(`🌐 Launching ${fingerprint.isMobile ? 'mobile' : 'desktop'} browser for Profile ${cycleSpecificIndex}`, windowIndex);
			
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
				'--disable-web-security',
				'--disable-features=TranslateUI',
				'--allow-running-insecure-content',
				'--disable-site-isolation-trials',
				'--enable-javascript',
				'--enable-plugins',
				'--allow-outdated-plugins',
				'--enable-gpu',
				'--enable-accelerated-2d-canvas',
				'--max_old_space_size=4096',
				'--disable-dev-shm-usage'
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

		activeBrowsers.push(browserInstance);

		// Create browser context with device-specific settings
		try {
			const contextOptions = {
				userAgent: fingerprint.userAgent,
				viewport: fingerprint.screen,
				locale: fingerprint.browserLanguages[0],
				timezoneId: fingerprint.timezone,
				deviceScaleFactor: fingerprint.deviceScaleFactor || 1,
				isMobile: fingerprint.isMobile || false,
				hasTouch: fingerprint.hasTouch || false,
				permissions: ['geolocation', 'notifications'],
				geolocation: fingerprint.geolocation || { latitude: 40.7128, longitude: -74.0060 },
				acceptDownloads: true,
				javaScriptEnabled: true,
				extraHTTPHeaders: {
					'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
					'Accept-Language': fingerprint.browserLanguages.join(',') + ';q=0.9',
					'Accept-Encoding': 'gzip, deflate, br',
					'Cache-Control': 'no-cache',
					'Pragma': 'no-cache',
					'Sec-Fetch-Dest': 'document',
					'Sec-Fetch-Mode': 'navigate',
					'Sec-Fetch-Site': 'none',
					'Sec-Fetch-User': '?1',
					'Upgrade-Insecure-Requests': '1',
					'DNT': fingerprint.doNotTrack || '0'
				}
			};
			
			context = await browserInstance.newContext(contextOptions);
			log(`📄 ${fingerprint.isMobile ? 'Mobile' : 'Desktop'} context created for Profile ${cycleSpecificIndex}`, windowIndex);
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

		// Navigate to the page
		try {
			if (shouldStop) {
				log(`⏹️ Stopping Profile ${cycleSpecificIndex} - automation stopped`, windowIndex);
				updateProfileStatus(windowIndex, 'failed');
				failedWindows++;
				return;
			}

			log(`🌐 Loading website: ${targetURL}`, windowIndex);

			await page.goto(targetURL, {
				waitUntil: 'domcontentloaded',
				timeout: (timeout + 15) * 1000
			});

			log(`✅ Initial page load completed for Profile ${cycleSpecificIndex}`, windowIndex);

			// Wait for complete page load including ads
			const loadSuccess = await waitForCompletePageLoad(page, windowIndex, 40);
			
			if (loadSuccess) {
				log(`🎉 Website fully loaded with ad scripts for Profile ${cycleSpecificIndex}`, windowIndex);
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

		log(`🕒 Starting ${waitTime}s ${isDirectLinkOnly ? 'DIRECT LINK' : 'LEGIT ad clicking'} session for Profile ${cycleSpecificIndex}`, windowIndex);
		updateProfileStatus(windowIndex, 'running');

		// Track this window after successful page load
		activeWindows.set(windowIndex, {
			browserInstance,
			startTime: Date.now(),
			waitTime,
			cycle
		});

		// Set up strict timeout
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

		// Calculate time distribution based on mode
		let remainingTime = waitTime;
		
		if (isDirectLinkOnly) {
			// Direct link mode - just visit the page and simulate user behavior
			if (remainingTime > 5) {
				log(`⏳ Direct link session for ${remainingTime}s...`, windowIndex);
				await visitDirectLink(page, windowIndex, targetURL, remainingTime - 2);
			}
		} else {
			// Regular mode - more focus on legit ad clicking
			let legitAdTime = Math.min(25, remainingTime * 0.6); // 60% for legit ad clicking
			let scrollTime = remainingTime - legitAdTime - 3; // Leave buffer
			
			if (remainingTime > 10) {
				log(`⏳ Waiting 3s for ads to load...`, windowIndex);
				await page.waitForTimeout(3000);
				remainingTime -= 3;
			}

			// Phase 1: LEGIT ad detection and clicking focused on ProfitableRate & HighPerformance
			if (legitAdTime > 0 && page && !page.isClosed() && !shouldStop && !isCompleted) {
				log(`🎯 Phase 1: LEGIT ad clicking for ${legitAdTime}s`, windowIndex);
				try {
					await detectAndClickProfitableRateAds(page, windowIndex, legitAdTime);
				} catch (adError) {
					log(`⚠️ Legit ad clicking error: ${adError.message}`, windowIndex);
				}
			}

			// Phase 2: Natural browsing simulation
			if (scrollTime > 0 && page && !page.isClosed() && !shouldStop && !isCompleted) {
				log(`📜 Phase 2: Natural browsing simulation for ${scrollTime}s`, windowIndex);
				try {
					await simulateHumanScroll(page, scrollTime, windowIndex, strictTimeoutId);
				} catch (scrollError) {
					log(`⚠️ Browsing simulation error: ${scrollError.message}`, windowIndex);
				}
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
			log(`✅ Profile ${cycleSpecificIndex} (Cycle ${cycle}) completed ${isDirectLinkOnly ? 'DIRECT LINK' : 'LEGIT'} session (${completedWindows + 1}/${totalWindows})`, windowIndex);
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
			maxWaitTime = 55,
			directLinkViews = 0, // New parameter for direct link views
			directLinkURL = '' // New parameter for direct link URL
		} = config;

		const isDirectLinkMode = directLinkViews > 0 && directLinkURL;
		
		log('🚀 Starting LEGIT automation with focused ad clicking:', null);
		log(`   URL: ${url}`, null);
		log(`   Proxy: ${proxyURL}`, null);
		log(`   Browser: ${browser}`, null);
		if (isDirectLinkMode) {
			log(`   🎯 DIRECT LINK MODE: ${directLinkViews} views to ${directLinkURL}`, null);
		} else {
			log(`   Cycles: ${openCount}`, null);
			log(`   Profiles per cycle: ${profilesAtOnce}`, null);
		}
		log(`   Timeout: ${timeout}s`, null);
		log(`   Wait time: ${minWaitTime}-${maxWaitTime}s`, null);

		// Extract target URL from proxy URL if needed
		let targetURL = isDirectLinkMode ? directLinkURL : url;
		if (url.includes('api.scrape.do') && url.includes('url=')) {
			const urlMatch = url.match(/url=([^&]+)/);
			if (urlMatch && !isDirectLinkMode) {
				targetURL = decodeURIComponent(urlMatch[1]);
				log(`🎯 Extracted target URL: ${targetURL}`, null);
			}
		}

		// Clear previous profile logs
		clearProfileLogs();

		let totalCycles, profilesPerCycle;
		
		if (isDirectLinkMode) {
			// Direct link mode: treat each view as a separate "profile"
			totalCycles = 1;
			profilesPerCycle = Math.max(1, Math.min(parseInt(directLinkViews), 50)); // Max 50 concurrent views
			log(`📊 DIRECT LINK MODE: ${profilesPerCycle} concurrent views`, null);
		} else {
			// Regular automation mode
			totalCycles = Math.max(1, Math.min(parseInt(openCount), 20));
			profilesPerCycle = Math.max(1, Math.min(parseInt(profilesAtOnce), 10));
			log(`📊 Regular automation: ${totalCycles} cycles × ${profilesPerCycle} profiles`, null);
		}

		totalWindows = totalCycles * profilesPerCycle;
		completedWindows = 0;
		failedWindows = 0;
		successWindows = 0;
		isAutomationInProgress = true;
		currentCycle = 1;
		updateGlobalCycleInfo(currentCycle, profilesPerCycle);

		// Reset stop state at the beginning
		resetStopState();

		log(`📊 Total profiles to run: ${totalWindows}`, null);

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

			const modeText = isDirectLinkMode ? 'DIRECT LINK views' : 'LEGIT ad clicking';
			log(`🔄 Starting Cycle ${cycle}/${totalCycles} with ${modeText}`);

			// Create promises for all profiles in this cycle
			const waitTimes = getRandomWaitTimes(profilesPerCycle, minWaitTime, maxWaitTime);
			
			log(`⏱️ Wait times for this cycle: ${waitTimes.map(t => `${t}s`).join(', ')}`);

			const promises = Array.from({ length: profilesPerCycle }, (_, i) =>
				processWindow(
					(cycle - 1) * profilesPerCycle + i + 1,
					browser,
					targetURL,
					proxyURL,
					waitTimes[i],
					cycle,
					timeout,
					isDirectLinkMode // Pass the direct link mode flag
				)
			);

			await Promise.allSettled(promises);

			// Check if stop was requested after this cycle
			if (shouldStop) {
				log(`⏹️ Stopping automation after cycle ${cycle}`);
				break;
			}

			const cycleText = isDirectLinkMode ? 'direct link views' : 'LEGIT ad interactions';
			log(`✅ Cycle ${cycle} completed with ${cycleText}`);

			// Small delay between cycles (except for the last cycle)
			if (cycle < totalCycles && !shouldStop) {
				log(`🕔 Waiting 5s before Cycle ${cycle + 1}...`);
				await new Promise((r) => setTimeout(r, 5000));
			}
		}

		if (shouldStop) {
			log(`🛑 Automation stopped by user request`);
		} else {
			const completionText = isDirectLinkMode ? 'direct link views' : 'LEGIT ad clicking';
			log(`🎉 All ${totalCycles} cycles completed with ${completionText}!`);
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