/**
 * SONEXIAL LABS — SCRIPT.JS
 */

// ============================================
// MOBILE NAV
// ============================================
function initMobileNav() {
    const toggle = document.querySelector('.nav-toggle');
    const nav = document.querySelector('.main-nav');
    if (!toggle || !nav) return;

    toggle.addEventListener('click', () => {
        const isOpen = nav.classList.toggle('open');
        toggle.setAttribute('aria-expanded', isOpen);
    });

    // Close nav on link click
    nav.querySelectorAll('a').forEach(link => {
        link.addEventListener('click', () => {
            nav.classList.remove('open');
            toggle.setAttribute('aria-expanded', 'false');
        });
    });
}

// ============================================
// SCROLL TO TOP
// ============================================
function initScrollTop() {
    const btn = document.getElementById('scroll-top');
    if (!btn) return;

    window.addEventListener('scroll', () => {
        btn.classList.toggle('visible', window.scrollY > 400);
    }, { passive: true });

    btn.addEventListener('click', () => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });
}

// ============================================
// FAQ ACCORDION
// ============================================
function initFAQ() {
    document.querySelectorAll('.faq-q').forEach(btn => {
        btn.addEventListener('click', () => {
            const expanded = btn.getAttribute('aria-expanded') === 'true';
            const answer = btn.nextElementSibling;

            // Close all
            document.querySelectorAll('.faq-q').forEach(b => {
                b.setAttribute('aria-expanded', 'false');
                const a = b.nextElementSibling;
                if (a) a.hidden = true;
            });

            // Open this one if it was closed
            if (!expanded) {
                btn.setAttribute('aria-expanded', 'true');
                if (answer) answer.hidden = false;
            }
        });
    });
}

// ============================================
// SUCCESS MODAL
// ============================================
function initModal() {
    const modal = document.getElementById('success-modal');
    const closeBtn = document.getElementById('modal-close');
    if (!modal) return;

    // Close on button
    closeBtn?.addEventListener('click', () => { modal.hidden = true; });

    // Close on backdrop
    modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.hidden = true;
    });

    // Close on Escape
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !modal.hidden) modal.hidden = true;
    });

    // Show on Netlify success redirect
    const params = new URLSearchParams(window.location.search);
    if (params.get('success') === 'true') {
        modal.hidden = false;
    }
}

// ============================================
// FORM VALIDATION
// ============================================
function initForms() {
    document.querySelectorAll('form').forEach(form => {
        const emailInputs = form.querySelectorAll('input[type="email"]');

        emailInputs.forEach(input => {
            input.addEventListener('blur', () => validateEmail(input));
            input.addEventListener('input', () => {
                if (input.classList.contains('invalid')) validateEmail(input);
            });
        });

        form.addEventListener('submit', (e) => {
            let valid = true;
            emailInputs.forEach(input => {
                if (!validateEmail(input)) valid = false;
            });
            if (!valid) e.preventDefault();
        });
    });
}

function validateEmail(input) {
    const val = input.value.trim();
    if (!val) { input.classList.remove('valid', 'invalid'); return true; }
    const ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val);
    input.classList.toggle('valid', ok);
    input.classList.toggle('invalid', !ok);
    return ok;
}

// ============================================
// HEADER SCROLL STATE
// ============================================
function initHeaderScroll() {
    const header = document.getElementById('site-header');
    if (!header) return;

    window.addEventListener('scroll', () => {
        header.classList.toggle('scrolled', window.scrollY > 20);
    }, { passive: true });
}

// ============================================
// ANIMATE ON SCROLL (lightweight)
// ============================================
function initReveal() {
    if (!('IntersectionObserver' in window)) return;

    const items = document.querySelectorAll(
        '.problem-card, .product-card, .step, .faq-item'
    );

    items.forEach(el => {
        el.style.opacity = '0';
        el.style.transform = 'translateY(16px)';
        el.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
    });

    const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry, i) => {
            if (entry.isIntersecting) {
                // Stagger siblings slightly
                const siblings = Array.from(entry.target.parentElement?.children || []);
                const idx = siblings.indexOf(entry.target);
                setTimeout(() => {
                    entry.target.style.opacity = '1';
                    entry.target.style.transform = 'translateY(0)';
                }, idx * 60);
                observer.unobserve(entry.target);
            }
        });
    }, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });

    items.forEach(el => observer.observe(el));
}

// ============================================
// ANALYTICS HELPERS
// ============================================
function track(event, data = {}) {
    if (typeof gtag !== 'undefined') {
        gtag('event', event, data);
    }
}

function initTracking() {
    // CTA clicks
    document.querySelectorAll('.btn-primary, .btn-secondary').forEach(btn => {
        btn.addEventListener('click', () => {
            track('cta_click', { button_text: btn.textContent.trim() });
        });
    });

    // Outbound links
    document.querySelectorAll('a[href^="http"]').forEach(link => {
        link.addEventListener('click', () => {
            track('outbound_click', { url: link.href });
        });
    });
}

// ============================================
// INIT
// ============================================
document.addEventListener('DOMContentLoaded', () => {
    initMobileNav();
    initScrollTop();
    initFAQ();
    initModal();
    initForms();
    initHeaderScroll();
    initReveal();
    initTracking();
});