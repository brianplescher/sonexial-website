/**
 * SONEXIAL LABS - ENHANCED JAVASCRIPT
 * Handles theme, audio, forms, modals, FAQ, and user interactions
 */

// ============================================
// THEME TOGGLER
// ============================================
function initThemeToggle() {
    const btn = document.getElementById('toggleDark');
    const html = document.documentElement;
    const currentTheme = localStorage.getItem('theme') || 'light';
    
    // Set initial theme
    html.setAttribute('data-theme', currentTheme);
    
    // Toggle theme on button click
    btn.addEventListener('click', () => {
        const current = html.getAttribute('data-theme');
        const next = current === 'dark' ? 'light' : 'dark';
        html.setAttribute('data-theme', next);
        localStorage.setItem('theme', next);
        
        // Track theme change
        if (typeof gtag !== 'undefined') {
            gtag('event', 'theme_toggle', {
                'theme': next
            });
        }
    });
}

// ============================================
// AUDIO WIDGET
// ============================================
function initAudioWidget() {
    const audio = document.getElementById('ambient-audio');
    const playBtn = document.getElementById('play-btn');
    const iconPlay = document.getElementById('icon-play');
    const iconPause = document.getElementById('icon-pause');
    
    // Set audio volume lower by default
    audio.volume = 0.6;

    playBtn.addEventListener('click', () => {
        if (audio.paused) {
            audio.play()
                .then(() => {
                    iconPlay.style.display = 'none';
                    iconPause.style.display = 'block';
                    playBtn.style.backgroundColor = 'var(--accent-hover)';
                    
                    // Track audio play
                    if (typeof gtag !== 'undefined') {
                        gtag('event', 'audio_play', {
                            'event_category': 'engagement'
                        });
                    }
                })
                .catch(error => {
                    console.log("Audio play failed. User interaction required.", error);
                });
        } else {
            audio.pause();
            iconPlay.style.display = 'block';
            iconPause.style.display = 'none';
            playBtn.style.backgroundColor = 'var(--accent)';
        }
    });
}

// ============================================
// FORM VALIDATION & SUBMISSION
// ============================================
function initFormValidation() {
    const forms = document.querySelectorAll('form');
    
    forms.forEach(form => {
        // Real-time email validation
        const emailInputs = form.querySelectorAll('input[type="email"]');
        emailInputs.forEach(input => {
            input.addEventListener('blur', () => {
                validateEmailInput(input);
            });
            
            input.addEventListener('input', () => {
                if (input.classList.contains('invalid')) {
                    validateEmailInput(input);
                }
            });
        });
        
        // Form submission
        form.addEventListener('submit', (e) => {
            let isValid = true;
            
            // Validate all email inputs
            emailInputs.forEach(input => {
                if (!validateEmailInput(input)) {
                    isValid = false;
                }
            });
            
            if (!isValid) {
                e.preventDefault();
                return;
            }
            
            // Add loading state
            form.classList.add('loading');
            
            // Track form submission
            if (typeof gtag !== 'undefined') {
                gtag('event', 'form_submit', {
                    'form_name': form.getAttribute('name') || 'unknown'
                });
            }
            
            // For Netlify forms, let it submit naturally
            // For other forms, you might want to handle with AJAX
        });
    });
}

function validateEmailInput(input) {
    const email = input.value.trim();
    const isValid = validateEmail(email);
    
    if (email === '') {
        input.classList.remove('valid', 'invalid');
        return true;
    }
    
    if (isValid) {
        input.classList.remove('invalid');
        input.classList.add('valid');
        return true;
    } else {
        input.classList.remove('valid');
        input.classList.add('invalid');
        return false;
    }
}

function validateEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
}

// ============================================
// SUCCESS MODAL
// ============================================
function showSuccessModal(message = "Your message has been sent. We'll get back to you soon!") {
    const modal = document.getElementById('success-modal');
    const messageEl = document.getElementById('success-message');
    
    messageEl.textContent = message;
    modal.style.display = 'flex';
    
    // Track modal view
    if (typeof gtag !== 'undefined') {
        gtag('event', 'success_modal_view', {
            'event_category': 'engagement'
        });
    }
}

function initSuccessModal() {
    const modal = document.getElementById('success-modal');
    const closeBtn = document.getElementById('close-success');
    
    closeBtn.addEventListener('click', () => {
        modal.style.display = 'none';
    });
    
    // Close on outside click
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.style.display = 'none';
        }
    });
    
    // Close on Escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modal.style.display === 'flex') {
            modal.style.display = 'none';
        }
    });
}

// ============================================
// SMOOTH SCROLL ENHANCEMENT
// ============================================
function initSmoothScroll() {
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            const href = this.getAttribute('href');
            
            // Skip if it's just "#"
            if (href === '#') return;
            
            const target = document.querySelector(href);
            if (target) {
                e.preventDefault();
                target.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
                
                // Track navigation
                if (typeof gtag !== 'undefined') {
                    gtag('event', 'navigation_click', {
                        'link_text': this.textContent,
                        'link_url': href
                    });
                }
            }
        });
    });
}

// ============================================
// SCROLL TO TOP BUTTON
// ============================================
function initScrollToTop() {
    const scrollBtn = document.getElementById('scroll-to-top');
    
    // Show/hide button based on scroll position
    window.addEventListener('scroll', () => {
        if (window.pageYOffset > 300) {
            scrollBtn.classList.add('visible');
        } else {
            scrollBtn.classList.remove('visible');
        }
    });
    
    // Scroll to top on click
    scrollBtn.addEventListener('click', () => {
        window.scrollTo({
            top: 0,
            behavior: 'smooth'
        });
        
        // Track scroll to top
        if (typeof gtag !== 'undefined') {
            gtag('event', 'scroll_to_top', {
                'event_category': 'engagement'
            });
        }
    });
}

// ============================================
// EXIT INTENT MODAL
// ============================================
function initExitIntent() {
    const modal = document.getElementById('exit-modal');
    const closeBtn = modal.querySelector('.exit-modal-close');
    const form = document.getElementById('exit-form');
    let hasShown = sessionStorage.getItem('exitModalShown');
    
    // Don't show if already shown in this session
    if (hasShown) return;
    
    // Detect exit intent
    document.addEventListener('mouseleave', (e) => {
        if (e.clientY <= 0 && !hasShown) {
            modal.style.display = 'flex';
            sessionStorage.setItem('exitModalShown', 'true');
            hasShown = true;
            
            // Track exit intent
            if (typeof gtag !== 'undefined') {
                gtag('event', 'exit_intent_shown', {
                    'event_category': 'engagement'
                });
            }
        }
    });
    
    // Close modal
    closeBtn.addEventListener('click', () => {
        modal.style.display = 'none';
    });
    
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.style.display = 'none';
        }
    });
    
    // Handle form submission
    form.addEventListener('submit', (e) => {
        e.preventDefault();
        const email = form.querySelector('input[type="email"]').value;
        
        // Track exit intent conversion
        if (typeof gtag !== 'undefined') {
            gtag('event', 'exit_intent_conversion', {
                'event_category': 'conversion'
            });
        }
        
        modal.style.display = 'none';
        showSuccessModal("Thanks! Check your email for the free checklist.");
        
        // Here you would typically send the email to your backend
        console.log('Exit intent email captured:', email);
    });
}

// ============================================
// FAQ ACCORDION
// ============================================
function initFAQ() {
    const faqQuestions = document.querySelectorAll('.faq-question');
    
    faqQuestions.forEach(question => {
        question.addEventListener('click', () => {
            const isExpanded = question.getAttribute('aria-expanded') === 'true';
            const answer = question.nextElementSibling;
            
            // Close all other FAQs
            faqQuestions.forEach(q => {
                if (q !== question) {
                    q.setAttribute('aria-expanded', 'false');
                    q.nextElementSibling.classList.remove('active');
                }
            });
            
            // Toggle current FAQ
            question.setAttribute('aria-expanded', !isExpanded);
            answer.classList.toggle('active');
            
            // Track FAQ interaction
            if (typeof gtag !== 'undefined' && !isExpanded) {
                gtag('event', 'faq_open', {
                    'event_category': 'engagement',
                    'faq_question': question.textContent.trim()
                });
            }
        });
    });
}

// ============================================
// KEYBOARD NAVIGATION ENHANCEMENT
// ============================================
function initKeyboardNav() {
    // Add visible focus indicators
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Tab') {
            document.body.classList.add('keyboard-nav');
        }
    });
    
    document.addEventListener('mousedown', () => {
        document.body.classList.remove('keyboard-nav');
    });
}

// ============================================
// LAZY LOADING IMAGES
// ============================================
function initLazyLoading() {
    const images = document.querySelectorAll('img[loading="lazy"]');
    
    if ('IntersectionObserver' in window) {
        const imageObserver = new IntersectionObserver((entries, observer) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const img = entry.target;
                    img.src = img.dataset.src || img.src;
                    img.classList.add('loaded');
                    observer.unobserve(img);
                }
            });
        });
        
        images.forEach(img => imageObserver.observe(img));
    }
}

// ============================================
// TRACK OUTBOUND LINKS
// ============================================
function initOutboundTracking() {
    document.querySelectorAll('a[href^="http"]').forEach(link => {
        link.addEventListener('click', (e) => {
            if (typeof gtag !== 'undefined') {
                gtag('event', 'click', {
                    'event_category': 'outbound',
                    'event_label': link.href
                });
            }
        });
    });
}

// ============================================
// TRACK CTA CLICKS
// ============================================
function initCTATracking() {
    document.querySelectorAll('.cta').forEach(button => {
        button.addEventListener('click', () => {
            if (typeof gtag !== 'undefined') {
                gtag('event', 'cta_click', {
                    'event_category': 'conversion',
                    'button_text': button.textContent.trim(),
                    'button_url': button.href || 'button'
                });
            }
        });
    });
}

// ============================================
// PERFORMANCE MONITORING
// ============================================
function trackPerformance() {
    if ('PerformanceObserver' in window) {
        // Track Largest Contentful Paint
        const lcpObserver = new PerformanceObserver((list) => {
            const entries = list.getEntries();
            const lastEntry = entries[entries.length - 1];
            
            if (typeof gtag !== 'undefined') {
                gtag('event', 'LCP', {
                    'event_category': 'Web Vitals',
                    'value': Math.round(lastEntry.startTime),
                    'metric_id': 'v1-lcp'
                });
            }
        });
        
        try {
            lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });
        } catch (e) {
            console.log('LCP observation not supported');
        }
    }
}

// ============================================
// INITIALIZE ON DOM READY
// ============================================
document.addEventListener('DOMContentLoaded', () => {
    initThemeToggle();
    initAudioWidget();
    initFormValidation();
    initSuccessModal();
    initSmoothScroll();
    initScrollToTop();
    initExitIntent();
    initFAQ();
    initKeyboardNav();
    initLazyLoading();
    initOutboundTracking();
    initCTATracking();
    trackPerformance();
    
    console.log('Sonexial Labs - All systems initialized ✓');
});

// ============================================
// HANDLE FORM SUCCESS (for Netlify)
// ============================================
window.addEventListener('load', () => {
    // Check if redirected from form submission
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('success') === 'true') {
        showSuccessModal();
    }
});
