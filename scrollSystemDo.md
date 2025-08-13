### ✅ **Scroll Behavior Checklist (Advanced Human Simulation)**

#### 🟢 **1. Smooth Scroll with Natural Easing**

-   [x] Scrolls vertically using `ease-in-out` curve (cosine-based).
-   [x] Randomized scroll distances & duration.
-   [x] Scrolls both **up and down** occasionally.
-   [x] Random pause between scrolls (300–1500ms).
-   [x] Gracefully handles exceptions or page close.

---

#### 🟢 **2. Advanced Mouse Movement**

-   [x] Uses **Bezier curves** to simulate curved paths.
-   [x] Includes **micro twitching** at destination.
-   [x] Randomized midpoints & steps.

---

#### 🟢 **3. Text Selection (Non-anchor)**

-   [x] Randomly selects visible text elements.
-   [x] Skips anchor (`<a>`) tags.
-   [x] Random selection length and timing.
-   [x] Selection is cleared **just before window close** to avoid static pattern.

---

#### 🟢 **4. Fake Hover & Click Simulation**

-   [x] Hovers over elements with `.ads` class.
-   [x] Hovers over random elements (occasionally).
-   [x] Simulates partial link hover (not clicking).
-   [x] Mouse moves to link but doesn't click — mimics hesitation.

---

#### 🟢 **5. Simulate Text Copy & Keyboard**

-   [x] Simulates selecting and **partially copying** text using `Ctrl+C`.
-   [x] Simulates `Ctrl+F` or `ArrowDown`/`ArrowUp` use.
-   [x] Randomly triggered in each interaction loop.

---

#### 🟢 **6. Idle Behavior + Tab Switching**

-   [x] 15% chance to simulate **user going idle** (5–10 sec).
-   [x] Includes `page.blur()` and `page.focus()` to mimic **tab switch**.
-   [x] Idle pauses injected safely inside scroll loop.

---

#### 🟢 **7. Logging & Modularity**

-   [x] All key actions are logged (`log()` with `profileIndex`).
-   [x] Logic is modular and non-conflicting with others.

---
