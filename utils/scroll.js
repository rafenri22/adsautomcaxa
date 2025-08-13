const { log } = require('./helpers');

// 🧠 Bezier curve helper for smooth mouse paths
function bezierCurve(p0, p1, p2, t) {
	const x = Math.pow(1 - t, 2) * p0.x + 2 * (1 - t) * t * p1.x + Math.pow(t, 2) * p2.x;
	const y = Math.pow(1 - t, 2) * p0.y + 2 * (1 - t) * t * p1.y + Math.pow(t, 2) * p2.y;
	return { x, y };
}

// 🖱️ Simulate smooth mouse movement using Bezier curve
async function moveMouseSmooth(page, from, to, steps = 25) {
	const mid = {
		x: (from.x + to.x) / 2 + (Math.random() * 100 - 50),
		y: (from.y + to.y) / 2 + (Math.random() * 100 - 50)
	};
	for (let i = 0; i <= steps; i++) {
		const t = i / steps;
		const point = bezierCurve(from, mid, to, t);
		await page.mouse.move(point.x, point.y);
		await page.waitForTimeout(5 + Math.random() * 10);
	}
	// Micro twitch at end
	if (Math.random() < 0.3) {
		for (let i = 0; i < 3; i++) {
			await page.mouse.move(to.x + Math.random() * 3 - 1.5, to.y + Math.random() * 3 - 1.5);
			await page.waitForTimeout(20 + Math.random() * 30);
		}
	}
}

// Enhanced ad interaction with aggressive clicking
async function simulateAdInteraction(page, profileIndex) {
	if (!page || page.isClosed()) return;
	log('🎯 Searching for advertisement elements to click...', profileIndex);

	try {
		// Comprehensive ad selectors including the specific ones mentioned
		const adSelectors = [
			// General ad selectors
			'.ads', '.ad', '.advertisement', '.google-ad', '.adsense',
			'[class*="ad-"]', '[id*="ad-"]', '[class*="ads-"]', '[id*="ads-"]',
			'ins.adsbygoogle', '.adsbygoogle',
			'[class*="banner"]', '[id*="banner"]', '.sponsor', '.sponsored',
			'[data-ad]', '[data-ads]', '.ad-container', '.ads-container',
			
			// Specific ad network selectors for profitableratecpm and highperformanceformat
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

		let totalAdClicks = 0;

		for (const selector of adSelectors) {
			if (!page || page.isClosed()) break;
			
			try {
				const adElements = await page.$$(selector);
				
				if (adElements.length > 0) {
					log(`📊 Found ${adElements.length} elements with selector: ${selector}`, profileIndex);
					
					for (let i = 0; i < Math.min(2, adElements.length); i++) {
						if (!page || page.isClosed()) break;
						
						const adElement = adElements[i];
						
						try {
							// Check if element is visible and clickable
							const elementInfo = await adElement.evaluate(el => {
								const rect = el.getBoundingClientRect();
								const style = window.getComputedStyle(el);
								const isClickable = el.tagName === 'A' || el.onclick || 
													el.style.cursor === 'pointer' ||
													el.getAttribute('onclick') || 
													el.getAttribute('href') ||
													el.tagName === 'BUTTON';
								
								return {
									visible: rect.width > 0 && rect.height > 0 && 
											style.display !== 'none' && 
											style.visibility !== 'hidden' &&
											style.opacity !== '0',
									clickable: isClickable,
									rect: rect,
									tagName: el.tagName,
									href: el.href || null,
									text: el.textContent ? el.textContent.trim().substring(0, 50) : ''
								};
							});
							
							if (!elementInfo.visible) {
								log(`👁️ Ad element ${i + 1} is not visible, skipping`, profileIndex);
								continue;
							}
							
							// Scroll element into view
							await adElement.evaluate(el => {
								el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
							});
							
							await page.waitForTimeout(1000 + Math.random() * 1500);
							
							// Get current pages count to detect popups
							const currentPages = await page.context().pages();
							
							// Get element position
							const boundingBox = await adElement.boundingBox();
							if (boundingBox) {
								const centerX = boundingBox.x + boundingBox.width / 2;
								const centerY = boundingBox.y + boundingBox.height / 2;
								
								// Add some randomization to click position
								const clickX = centerX + (Math.random() * 20 - 10);
								const clickY = centerY + (Math.random() * 20 - 10);
								
								// Move mouse smoothly to ad
								const currentPos = await page.evaluate(() => ({ x: 100, y: 100 }));
								await moveMouseSmooth(page, currentPos, { x: clickX, y: clickY }, 15);
								
								log(`🖱️ Clicking ad element ${i + 1} at (${Math.round(clickX)}, ${Math.round(clickY)})`, profileIndex);
								log(`   ↳ Type: ${elementInfo.tagName}, Clickable: ${elementInfo.clickable}`, profileIndex);
								if (elementInfo.href) {
									log(`   ↳ Link: ${elementInfo.href}`, profileIndex);
								}
								
								// Click the ad
								await page.mouse.click(clickX, clickY);
								totalAdClicks++;
								
								// Wait to see if new tab/popup opened
								await page.waitForTimeout(3000);
								
								// Check for new pages/popups
								const newPages = await page.context().pages();
								if (newPages.length > currentPages.length) {
									log(`🆕 Ad click opened ${newPages.length - currentPages.length} new tab(s)/popup(s)`, profileIndex);
									
									// Close any new tabs after a realistic delay
									for (let pageIndex = currentPages.length; pageIndex < newPages.length; pageIndex++) {
										const newPage = newPages[pageIndex];
										try {
											// Wait a bit before closing to register the click
											await page.waitForTimeout(5000 + Math.random() * 3000);
											await newPage.close();
											log(`❌ Closed popup/new tab ${pageIndex - currentPages.length + 1}`, profileIndex);
										} catch (e) {
											log(`⚠️ Could not close popup: ${e.message}`, profileIndex);
										}
									}
								} else {
									log(`📄 Ad click did not open new tabs`, profileIndex);
								}
								
								log(`✅ Successfully clicked ad element ${i + 1}`, profileIndex);
							}
							
							// Wait before next ad click
							await page.waitForTimeout(4000 + Math.random() * 6000);
							
						} catch (elementError) {
							log(`⚠️ Error clicking ad element ${i + 1}: ${elementError.message}`, profileIndex);
						}
					}
				}
			} catch (selectorError) {
				// Silently continue with next selector
				continue;
			}
		}

		// Also search for direct ad links
		try {
			const adLinks = await page.evaluate(() => {
				const links = Array.from(document.querySelectorAll('a')).filter(link => {
					const href = link.href || '';
					const text = link.textContent.toLowerCase();
					const className = link.className.toLowerCase();
					
					// Check for ad-related URLs or text
					return href.includes('profitableratecpm.com') || 
						   href.includes('highperformanceformat.com') ||
						   href.includes('/ads/') || 
						   href.includes('adclick') ||
						   text.includes('advertisement') ||
						   text.includes('sponsor') ||
						   className.includes('ad') ||
						   className.includes('banner');
				});
				
				return links.map(link => {
					const rect = link.getBoundingClientRect();
					if (rect.width > 10 && rect.height > 10 && rect.top >= -50 && rect.top <= window.innerHeight + 50) {
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
			
			if (adLinks.length > 0) {
				log(`🔗 Found ${adLinks.length} ad links to click`, profileIndex);
				
				for (let i = 0; i < Math.min(3, adLinks.length); i++) {
					if (!page || page.isClosed()) break;
					
					const adLink = adLinks[i];
					const currentPages = await page.context().pages();
					
					// Move to link and click
					await moveMouseSmooth(page, 
						{ x: Math.random() * 1000, y: Math.random() * 700 }, 
						{ x: adLink.x, y: adLink.y }, 
						12
					);
					
					await page.waitForTimeout(1000 + Math.random() * 1500);
					
					log(`🔗 Clicking ad link: ${adLink.text} (${adLink.href})`, profileIndex);
					await page.mouse.click(adLink.x, adLink.y);
					totalAdClicks++;
					
					await page.waitForTimeout(3000);
					
					// Handle new tabs/popups
					const newPages = await page.context().pages();
					if (newPages.length > currentPages.length) {
						log(`🆕 Ad link opened new tab(s)`, profileIndex);
						for (let pageIndex = currentPages.length; pageIndex < newPages.length; pageIndex++) {
							try {
								const newPage = newPages[pageIndex];
								await page.waitForTimeout(5000 + Math.random() * 3000);
								await newPage.close();
								log(`❌ Closed ad popup/tab`, profileIndex);
							} catch (e) {
								log(`⚠️ Could not close ad popup: ${e.message}`, profileIndex);
							}
						}
					}
					
					await page.waitForTimeout(3000 + Math.random() * 4000);
				}
			}
		} catch (linkError) {
			log(`⚠️ Error searching ad links: ${linkError.message}`, profileIndex);
		}

		log(`🎉 Ad interaction completed - ${totalAdClicks} ads clicked`, profileIndex);

	} catch (error) {
		log(`❌ Error during ad interaction: ${error.message}`, profileIndex);
	}
}

// Advanced human-like scroll simulation with enhanced ad support
async function simulateHumanScroll(
	page,
	totalDuration = 20,
	profileIndex = null,
	timeoutId = null
) {
	if (!page || page.isClosed()) {
		log('⚠️ Page is closed, skipping scroll simulation', profileIndex);
		return;
	}

	const actions = [];
	let remainingTime = totalDuration;
	const maxScrollDepth = Math.random() * 0.25 + 0.55; // 55% to 80%
	const pageHeight = await page.evaluate(() => document.documentElement.scrollHeight);
	const willVisitAds = true; // Always look for ads
	const adCheckInterval = 2; // Check for ads every 2 actions

	// Plan scroll actions
	while (remainingTime > 3) {
		const direction = Math.random() > 0.25 ? 'down' : 'up'; // Favor downward scrolling
		const pause = 1 + Math.random() * 3; // 1–4s pauses
		const scrollSize = (Math.random() * 0.08 + 0.02) * pageHeight; // 2% to 10% of page
		const duration = 0.5 + Math.random() * 2; // 0.5–2.5s scroll duration

		actions.push({ direction, scrollSize, duration, pause });
		remainingTime -= duration + pause;
	}

	log(`📋 Enhanced scroll plan: ${actions.length} actions over ${totalDuration}s`, profileIndex);
	log(`🎯 Will actively search for ads throughout scrolling`, profileIndex);
	log(`📏 Page height: ${Math.round(pageHeight)}px`, profileIndex);

	for (const [index, action] of actions.entries()) {
		// Check if page is closed or timeout has been triggered
		if (!page || page.isClosed()) {
			log('⚠️ Page closed during scroll simulation, stopping', profileIndex);
			break;
		}

		// Check page responsiveness
		try {
			await page.evaluate(() => window.location.href);
		} catch (e) {
			log('⚠️ Page became unresponsive, likely due to timeout - stopping scroll', profileIndex);
			break;
		}

		log(`🔁 Action ${index + 1}/${actions.length}: Scrolling ${action.direction} for ${action.duration.toFixed(1)}s after ${action.pause.toFixed(1)}s pause`, profileIndex);

		try {
			// Pause before action
			await page.waitForTimeout(action.pause * 1000);

			if (!page || page.isClosed()) break;

			// Enhanced scrolling with mouse wheel simulation
			await page.evaluate(async ({ direction, scrollSize, duration }) => {
				const scrollHeight = document.documentElement.scrollHeight - window.innerHeight;
				let startY = window.scrollY;
				let endY = direction === 'down'
					? Math.min(scrollHeight, startY + scrollSize)
					: Math.max(0, startY - scrollSize);
				
				const steps = Math.floor(60 * duration); // 60fps
				const stepSize = (endY - startY) / steps;
				
				for (let i = 0; i <= steps; i++) {
					let progress = i / steps;
					// Enhanced easing function for more natural feel
					let ease = progress < 0.5 
						? 4 * progress * progress * progress
						: 1 - Math.pow(-2 * progress + 2, 3) / 2;
					
					let y = startY + stepSize * steps * ease;
					window.scrollTo(0, y);
					
					// Simulate wheel events for better compatibility
					if (i % 3 === 0) {
						window.dispatchEvent(new WheelEvent('wheel', {
							deltaY: direction === 'down' ? 100 : -100,
							bubbles: true,
							cancelable: true
						}));
					}
					
					await new Promise(r => setTimeout(r, (duration * 1000) / steps));
				}
			}, action);

			if (!page || page.isClosed()) break;

			// Enhanced human-like behaviors
			await simulateAdvancedBehaviors(page, profileIndex);

			if (!page || page.isClosed()) break;

			// Aggressively look for and click ads
			if (willVisitAds && index % adCheckInterval === 0) {
				await simulateAdInteraction(page, profileIndex);
			}

		} catch (error) {
			log(`⚠️ Error during scroll action: ${error.message}`, profileIndex);
			break;
		}
	}

	// Final ad check before completing
	if (page && !page.isClosed()) {
		log(`🎯 Final ad search before completing scroll`, profileIndex);
		await simulateAdInteraction(page, profileIndex);
	}

	// Final scroll behavior - sometimes return to top
	if (Math.random() < 0.4 && page && !page.isClosed()) {
		const finalPosition = Math.random() < 0.5 ? 0 : await page.evaluate(() => 
			document.documentElement.scrollHeight * (0.2 + Math.random() * 0.3)
		);
		
		await page.evaluate(async (targetY) => {
			const startY = window.scrollY;
			const distance = targetY - startY;
			const duration = 2000; // 2 seconds
			const steps = 120; // 60fps for 2 seconds
			
			for (let i = 0; i <= steps; i++) {
				const progress = i / steps;
				const ease = 0.5 - Math.cos(progress * Math.PI) / 2;
				const y = startY + distance * ease;
				window.scrollTo(0, y);
				await new Promise(r => setTimeout(r, duration / steps));
			}
		}, finalPosition);
		
		log(`↩️ Final scroll to ${finalPosition === 0 ? 'top' : 'middle'} of page`, profileIndex);
		await page.waitForTimeout(1000 + Math.random() * 2000);
	}

	log(`🎉 Enhanced scroll simulation completed with ad interactions`, profileIndex);
}

// Simulate advanced human behaviors
async function simulateAdvancedBehaviors(page, profileIndex) {
	if (!page || page.isClosed()) return;

	try {
		// Random mouse movements (40% chance)
		if (Math.random() < 0.4) {
			const x = Math.floor(Math.random() * 1200) + 100;
			const y = Math.floor(Math.random() * 800) + 100;
			const currentPos = { x: Math.random() * 1000, y: Math.random() * 700 };
			await moveMouseSmooth(page, currentPos, { x, y }, 8 + Math.random() * 12);
			log(`🖱️ Moved mouse to (${x}, ${y})`, profileIndex);
		}

		// Text selection (25% chance)
		if (Math.random() < 0.25) {
			await page.evaluate(() => {
				const textElements = Array.from(document.querySelectorAll('p, h1, h2, h3, h4, h5, h6, span, div')).filter(el => {
					const text = el.textContent.trim();
					const rect = el.getBoundingClientRect();
					return text.length > 50 && rect.height > 0 && rect.width > 0;
				});
				
				if (textElements.length > 0) {
					const element = textElements[Math.floor(Math.random() * textElements.length)];
					const text = element.textContent;
					const startOffset = Math.floor(Math.random() * (text.length - 20));
					const endOffset = startOffset + 15 + Math.floor(Math.random() * 30);
					
					const range = document.createRange();
					range.setStart(element.firstChild || element, startOffset);
					range.setEnd(element.firstChild || element, Math.min(endOffset, text.length));
					
					const selection = window.getSelection();
					selection.removeAllRanges();
					selection.addRange(range);
					
					// Clear selection after some time
					setTimeout(() => selection.removeAllRanges(), 2000 + Math.random() * 4000);
				}
			});
			log(`📝 Selected text`, profileIndex);
		}

		// Link hover (30% chance)
		if (Math.random() < 0.3) {
			await page.evaluate(() => {
				const links = Array.from(document.querySelectorAll('a')).filter(link => {
					const rect = link.getBoundingClientRect();
					return rect.width > 0 && rect.height > 0;
				});
				
				if (links.length > 0) {
					const link = links[Math.floor(Math.random() * links.length)];
					const rect = link.getBoundingClientRect();
					const event = new MouseEvent('mouseover', {
						clientX: rect.left + rect.width / 2,
						clientY: rect.top + rect.height / 2,
						bubbles: true
					});
					link.dispatchEvent(event);
				}
			});
			log(`🔗 Hovered over link`, profileIndex);
		}

		// Keyboard shortcuts (15% chance)
		if (Math.random() < 0.15) {
			const shortcuts = ['Control+F', 'Control+A', 'Control+C', 'F5'];
			const shortcut = shortcuts[Math.floor(Math.random() * shortcuts.length)];
			
			if (shortcut.includes('Control')) {
				const key = shortcut.split('+')[1];
				await page.keyboard.down('Control');
				await page.keyboard.press(`Key${key}`);
				await page.keyboard.up('Control');
			} else {
				await page.keyboard.press(shortcut);
			}
			log(`⌨️ Used keyboard shortcut: ${shortcut}`, profileIndex);
		}

		// Random pauses (30% chance)
		if (Math.random() < 0.3) {
			const pauseTime = 500 + Math.floor(Math.random() * 2000);
			log(`⏸️ Taking ${(pauseTime/1000).toFixed(1)}s pause`, profileIndex);
			await page.waitForTimeout(pauseTime);
		}

		// Simulate reading behavior with longer pauses on certain elements
		if (Math.random() < 0.2) {
			await page.evaluate(() => {
				const headings = Array.from(document.querySelectorAll('h1, h2, h3')).filter(h => {
					const rect = h.getBoundingClientRect();
					return rect.top >= 0 && rect.top <= window.innerHeight;
				});
				
				if (headings.length > 0) {
					const heading = headings[0];
					heading.scrollIntoView({ behavior: 'smooth', block: 'center' });
				}
			});
			const readingTime = 1000 + Math.random() * 3000;
			log(`📖 Reading content for ${(readingTime/1000).toFixed(1)}s`, profileIndex);
			await page.waitForTimeout(readingTime);
		}

	} catch (behaviorError) {
		log(`⚠️ Error in advanced behavior simulation: ${behaviorError.message}`, profileIndex);
	}
}

module.exports = simulateHumanScroll;