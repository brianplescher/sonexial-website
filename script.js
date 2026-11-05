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
    const atIdx = val.indexOf('@');
    const ok = atIdx > 0 &&
               atIdx === val.lastIndexOf('@') &&
               atIdx < val.length - 2 &&
               val.lastIndexOf('.') > atIdx + 1 &&
               !val.includes(' ');
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
        entries.forEach((entry) => {
            if (entry.isIntersecting) {
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
    document.querySelectorAll('.btn-primary, .btn-secondary').forEach(btn => {
        btn.addEventListener('click', () => {
            track('cta_click', { button_text: btn.textContent.trim() });
        });
    });

    document.querySelectorAll('a[href^="http"]').forEach(link => {
        link.addEventListener('click', () => {
            track('outbound_click', { url: link.href });
        });
    });
}

// ============================================
// SERVICE CTA SELECTION
// ============================================
function initServiceSelection() {
    const select = document.getElementById('interest');
    if (!select) return;

    document.querySelectorAll('[data-service]').forEach(cta => {
        cta.addEventListener('click', () => {
            const service = cta.getAttribute('data-service');
            if (service && select.querySelector(`option[value="${service}"]`)) {
                select.value = service;
            }
        });
    });
}

// ============================================
// 3D SCROLL-MORPHING SIGNAL & CONSTELLATION STAGE
// ============================================
function initSignalOrbitStage() {
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        return;
    }

    const prog = document.createElement('div');
    prog.id = 'sonexial-scroll-progress';
    document.body.appendChild(prog);

    const stageWrap = document.createElement('div');
    stageWrap.id = 'sonexial-stage';
    stageWrap.setAttribute('aria-hidden', 'true');
    const canvas = document.createElement('canvas');
    stageWrap.appendChild(canvas);
    document.body.insertBefore(stageWrap, document.body.firstChild);

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let W = window.innerWidth;
    let H = window.innerHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    function resize() {
        W = window.innerWidth;
        H = window.innerHeight;
        canvas.width = W * dpr;
        canvas.height = H * dpr;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    resize();
    window.addEventListener('resize', resize, { passive: true });

    const COUNT = 520;
    const rand = (s) => (Math.random() * 2 - 1) * s;
    const gauss = () => (Math.random() + Math.random() + Math.random() - 1.5) * 0.85;

    // 7 Fibonacci Constellation Hub Nodes for the "neural" shape
    const HUBS = [];
    const golden = Math.PI * (3 - Math.sqrt(5));
    for (let i = 0; i < 7; i++) {
        const y = 1 - (i / 6) * 2;
        const r = Math.sqrt(Math.max(0, 1 - y * y));
        const th = golden * i;
        HUBS.push([6.2 * Math.cos(th) * r, 6.2 * y, 6.2 * Math.sin(th) * r]);
    }

    function makeWave() {
        const pts = [];
        const side = Math.ceil(Math.sqrt(COUNT));
        for (let i = 0; i < COUNT; i++) {
            const gx = (i % side) / side - 0.5;
            const gz = Math.floor(i / side) / side - 0.5;
            const x = gx * 26;
            const z = gz * 26;
            const y = Math.sin(x * 0.42) * 1.45 + Math.cos(z * 0.36) * 1.2 - 3.2;
            pts.push([x, y, z]);
        }
        return pts;
    }

    function makeNeural() {
        const pts = [];
        for (let i = 0; i < COUNT; i++) {
            if (i % 5 === 0) {
                const ph = Math.acos(2 * Math.random() - 1);
                const th = Math.random() * Math.PI * 2;
                const r = 7.8 + rand(0.45);
                pts.push([
                    r * Math.sin(ph) * Math.cos(th),
                    r * Math.sin(ph) * Math.sin(th),
                    r * Math.cos(ph)
                ]);
            } else {
                const hub = HUBS[i % HUBS.length];
                pts.push([
                    hub[0] + gauss() * 1.35,
                    hub[1] + gauss() * 1.35,
                    hub[2] + gauss() * 1.35
                ]);
            }
        }
        return pts;
    }

    function makeGyro() {
        const pts = [];
        const radii = [7.4, 5.8, 6.6];
        for (let i = 0; i < COUNT; i++) {
            const ang = Math.random() * Math.PI * 2;
            const m = i % 10;
            if (m < 3) {
                pts.push([Math.cos(ang) * radii[0], Math.sin(ang) * radii[0], rand(0.25)]);
            } else if (m < 6) {
                pts.push([Math.cos(ang) * radii[1], rand(0.25), Math.sin(ang) * radii[1]]);
            } else if (m < 9) {
                const cx = Math.cos(ang) * radii[2];
                const sy = Math.sin(ang) * radii[2];
                pts.push([cx * 0.707, sy, cx * 0.707]);
            } else {
                pts.push([gauss() * 1.25, gauss() * 1.25, gauss() * 1.25]);
            }
        }
        return pts;
    }

    function makeCubes() {
        const pts = [];
        const grid = 4;
        const step = 3.5;
        const half = 1.05;
        for (let i = 0; i < COUNT; i++) {
            const cx = ((i % grid) - 1.5) * step;
            const cy = (Math.floor(i / grid) % grid - 1.5) * step;
            const cz = (Math.floor(i / (grid * grid)) % grid - 1.5) * step;
            pts.push([cx + rand(half), cy + rand(half), cz + rand(half)]);
        }
        return pts;
    }

    function makeGalaxy() {
        const pts = [];
        const arms = 3;
        const tiltC = Math.cos(-0.95);
        const tiltS = Math.sin(-0.95);
        for (let i = 0; i < COUNT; i++) {
            if (i % 7 === 0) {
                pts.push([gauss() * 1.5, gauss() * 0.9, gauss() * 1.5]);
            } else {
                const arm = i % arms;
                const p = Math.random();
                const ang = p * 4.2 * Math.PI + (arm * 2 * Math.PI) / arms;
                const rad = 0.7 + p * 8.8;
                const x = Math.cos(ang) * rad + gauss() * 0.45;
                const y0 = gauss() * (1.0 - p * 0.75);
                const z0 = Math.sin(ang) * rad + gauss() * 0.45;
                pts.push([x, y0 * tiltC - z0 * tiltS, y0 * tiltS + z0 * tiltC]);
            }
        }
        return pts;
    }

    const SHAPES = [makeWave(), makeNeural(), makeGyro(), makeCubes(), makeGalaxy()];
    const cur = SHAPES[0].map(p => [p[0], p[1], p[2]]);
    const colors = [];
    for (let i = 0; i < COUNT; i++) {
        const r = Math.random();
        if (r < 0.52) colors.push([0, 240, 255]);       // Electric Cyan #00F0FF
        else if (r < 0.80) colors.push([56, 189, 248]); // Sky Signal #38BDF8
        else if (r < 0.93) colors.push([232, 237, 245]);// Bone White
        else colors.push([37, 99, 235]);                // Deep Signal Blue
    }

    let activeShapeIdx = 0;
    let targetShape = SHAPES[0];

    function updateScrollState() {
        const doc = document.documentElement;
        const maxScroll = Math.max(1, doc.scrollHeight - doc.clientHeight);
        const pct = Math.min(1, Math.max(0, window.scrollY / maxScroll));
        prog.style.width = (pct * 100).toFixed(1) + '%';
        const idx = Math.min(SHAPES.length - 1, Math.floor(pct * SHAPES.length));
        if (idx !== activeShapeIdx) {
            activeShapeIdx = idx;
            targetShape = SHAPES[idx];
        }
    }
    window.addEventListener('scroll', updateScrollState, { passive: true });
    updateScrollState();

    let mouseX = 0;
    let mouseY = 0;
    let rotY = 0;
    let rotX = 0.18;
    let dragRotY = 0;
    let dragRotX = 0;
    let isDragging = false;
    let lastX = 0;
    let lastY = 0;

    window.addEventListener('pointermove', (e) => {
        mouseX = (e.clientX / Math.max(1, W) - 0.5) * 2;
        mouseY = (e.clientY / Math.max(1, H) - 0.5) * 2;
        if (isDragging) {
            dragRotY += (e.clientX - lastX) * 0.005;
            dragRotX = Math.max(-0.9, Math.min(0.9, dragRotX + (e.clientY - lastY) * 0.004));
            lastX = e.clientX;
            lastY = e.clientY;
        }
    }, { passive: true });

    window.addEventListener('pointerdown', (e) => {
        if (e.button !== 0 || e.target.closest('a,button,input,textarea,select,form,nav')) return;
        isDragging = true;
        lastX = e.clientX;
        lastY = e.clientY;
    }, { passive: true });

    window.addEventListener('pointerup', () => { isDragging = false; }, { passive: true });

    let t = 0;
    const FOV = 520;
    const CAM_Z = 22;

    function project3D(x, y, z, cy, sy, cx, sx) {
        const rx = x * cy + z * sy;
        const rz0 = -x * sy + z * cy;
        const ry = y * cx - rz0 * sx;
        const rz = y * sx + rz0 * cx + CAM_Z;
        if (rz <= 1) return null;
        const scale = FOV / rz;
        return [W * 0.5 + rx * scale, H * 0.5 + ry * scale, rz, scale];
    }

    function animate() {
        t += 0.016;
        if (!isDragging) {
            rotY += 0.0028;
        }
        const totalRotY = rotY + dragRotY + mouseX * 0.22;
        const totalRotX = rotX + dragRotX + mouseY * 0.14;
        const cy = Math.cos(totalRotY);
        const sy = Math.sin(totalRotY);
        const cx = Math.cos(totalRotX);
        const sx = Math.sin(totalRotX);

        ctx.clearRect(0, 0, W, H);

        // Draw subtle constellation lines between HUBS when in neural or gyro mode
        if (activeShapeIdx === 1 || activeShapeIdx === 2) {
            const hubProj = HUBS.map(h => project3D(h[0], h[1], h[2], cy, sy, cx, sx));
            ctx.strokeStyle = 'rgba(0, 240, 255, 0.13)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            for (let i = 0; i < hubProj.length; i++) {
                for (let j = i + 1; j < hubProj.length; j++) {
                    if (hubProj[i] && hubProj[j]) {
                        ctx.moveTo(hubProj[i][0], hubProj[i][1]);
                        ctx.lineTo(hubProj[j][0], hubProj[j][1]);
                    }
                }
            }
            ctx.stroke();
        }

        for (let i = 0; i < COUNT; i++) {
            const c = cur[i];
            const tg = targetShape[i];
            c[0] += (tg[0] - c[0]) * 0.055;
            c[1] += (tg[1] - c[1]) * 0.055;
            c[2] += (tg[2] - c[2]) * 0.055;

            const wobble = Math.sin(t * 1.4 + i * 0.37) * 0.08;
            const px = c[0] + wobble;
            const py = c[1] + Math.cos(t * 1.1 + i * 0.53) * 0.08;
            const pz = c[2] + wobble;

            const pr = project3D(px, py, pz, cy, sy, cx, sx);
            if (!pr) continue;

            const [sx2, sy2, rz, scale] = pr;
            if (sx2 < -20 || sx2 > W + 20 || sy2 < -20 || sy2 > H + 20) continue;

            const radius = Math.max(1.1, Math.min(4.2, scale * 0.085));
            const depthAlpha = Math.max(0.12, Math.min(0.88, (34 - rz) / 22));
            const col = colors[i];

            ctx.fillStyle = `rgba(${col[0]}, ${col[1]}, ${col[2]}, ${depthAlpha.toFixed(2)})`;
            ctx.beginPath();
            ctx.arc(sx2, sy2, radius, 0, Math.PI * 2);
            ctx.fill();
        }

        window.requestAnimationFrame(animate);
    }

    window.requestAnimationFrame(animate);
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
    initServiceSelection();
    initSignalOrbitStage();
});
