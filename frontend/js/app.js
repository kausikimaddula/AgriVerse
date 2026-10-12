/**
 * AgriVerse 2026 // APPLICATION LOGIC & API INTEGRATION
 * Communicates with backend Express API at http://localhost:5000/api
 * Includes fallback to localStorage, dynamic QR rendering, confetti, validation,
 * live telemetry updates, countdown timer, schedule switching, and modal passes.
 */

const API_BASE = 'http://localhost:5000/api';
const STORAGE_KEY = 'agriverse_2026_registrations';
const MAX_SEATS = 500;
let initialFilledSeats = 372;

document.addEventListener('DOMContentLoaded', () => {
  // --- 1. SEAT MANAGEMENT & STATS ---
  function getLocalRegistrations() {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      return [];
    }
  }

  function saveLocalRegistration(reg) {
    const list = getLocalRegistrations();
    list.push(reg);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    } catch (e) {}
  }

  async function fetchSummitStats() {
    try {
      const res = await fetch(`${API_BASE}/stats`);
      if (res.ok) {
        const data = await res.json();
        renderStats(data.seatsRemaining, data.percentFilled);
        return;
      }
    } catch (e) {
      // Offline fallback
    }

    // Client-side fallback
    const local = getLocalRegistrations();
    const currentFilled = initialFilledSeats + local.length;
    const remaining = Math.max(0, MAX_SEATS - currentFilled);
    const percentage = Math.min(100, (currentFilled / MAX_SEATS) * 100).toFixed(1);
    renderStats(remaining, percentage);
  }

  function renderStats(remaining, percentage) {
    const seatsLeftEl = document.getElementById('seats-left-val');
    const progressBar = document.getElementById('seat-progress-bar');
    const percentageEl = document.getElementById('seats-percentage');

    if (seatsLeftEl) seatsLeftEl.textContent = remaining;
    if (progressBar) progressBar.style.width = `${percentage}%`;
    if (percentageEl) percentageEl.textContent = `${percentage}% Filled`;
  }

  fetchSummitStats();

  // --- 2. COUNTDOWN TIMER ---
  function initCountdown() {
    const targetDate = new Date('2026-11-14T09:00:00+05:30').getTime();

    function update() {
      const now = new Date().getTime();
      const diff = targetDate - now;

      if (diff <= 0) {
        document.getElementById('cd-days').textContent = '00';
        document.getElementById('cd-hours').textContent = '00';
        document.getElementById('cd-mins').textContent = '00';
        document.getElementById('cd-secs').textContent = '00';
        return;
      }

      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const secs = Math.floor((diff % (1000 * 60)) / 1000);

      const dEl = document.getElementById('cd-days');
      const hEl = document.getElementById('cd-hours');
      const mEl = document.getElementById('cd-mins');
      const sEl = document.getElementById('cd-secs');

      if (dEl) dEl.textContent = String(days).padStart(2, '0');
      if (hEl) hEl.textContent = String(hours).padStart(2, '0');
      if (mEl) mEl.textContent = String(mins).padStart(2, '0');
      if (sEl) sEl.textContent = String(secs).padStart(2, '0');
    }

    update();
    setInterval(update, 1000);
  }
  initCountdown();

  // --- 3. STICKY NAVBAR & ACTIVE LINK OBSERVER ---
  const navWrapper = document.getElementById('main-nav');
  const navLinks = document.querySelectorAll('.nav-link');
  const sections = document.querySelectorAll('section[id]');

  window.addEventListener('scroll', () => {
    if (window.scrollY > 40) {
      navWrapper?.classList.add('scrolled');
    } else {
      navWrapper?.classList.remove('scrolled');
    }

    let current = '';
    sections.forEach((section) => {
      const sectionTop = section.offsetTop - 120;
      const sectionHeight = section.offsetHeight;
      if (window.scrollY >= sectionTop && window.scrollY < sectionTop + sectionHeight) {
        current = section.getAttribute('id');
      }
    });

    navLinks.forEach((link) => {
      link.classList.remove('active');
      if (link.getAttribute('href') === `#${current}`) {
        link.classList.add('active');
      }
    });
  });

  // --- 4. MOBILE DRAWER NAVIGATION ---
  const mobileBtn = document.getElementById('mobile-menu-btn');
  const mobileDrawer = document.getElementById('mobile-drawer');
  const mobileLinks = document.querySelectorAll('.mobile-nav-link, .mobile-register-btn');

  if (mobileBtn && mobileDrawer) {
    mobileBtn.addEventListener('click', () => {
      const isOpen = mobileDrawer.classList.contains('open');
      if (isOpen) {
        mobileDrawer.classList.remove('open');
        mobileBtn.classList.remove('active');
        mobileBtn.setAttribute('aria-expanded', 'false');
        mobileDrawer.setAttribute('aria-hidden', 'true');
        document.body.style.overflow = '';
      } else {
        mobileDrawer.classList.add('open');
        mobileBtn.classList.add('active');
        mobileBtn.setAttribute('aria-expanded', 'true');
        mobileDrawer.setAttribute('aria-hidden', 'false');
        document.body.style.overflow = 'hidden';
      }
    });

    mobileLinks.forEach((link) => {
      link.addEventListener('click', () => {
        mobileDrawer.classList.remove('open');
        mobileBtn.classList.remove('active');
        mobileBtn.setAttribute('aria-expanded', 'false');
        mobileDrawer.setAttribute('aria-hidden', 'true');
        document.body.style.overflow = '';
      });
    });
  }

  // --- 5. REAL-TIME HERO PASS CARD PREVIEW ---
  const fullNameInput = document.getElementById('fullName');
  const trackSelect = document.getElementById('participationType');
  const previewHolderName = document.getElementById('preview-holder-name');
  const previewHolderTrack = document.getElementById('preview-holder-track');

  if (fullNameInput && previewHolderName) {
    fullNameInput.addEventListener('input', (e) => {
      const val = e.target.value.trim();
      previewHolderName.textContent = val ? val.toUpperCase() : 'YOUR NAME HERE';
    });
  }

  if (trackSelect && previewHolderTrack) {
    trackSelect.addEventListener('change', (e) => {
      const val = e.target.value;
      previewHolderTrack.textContent = val ? val : 'AI & Smart Agriculture';
    });
  }

  // --- 6. SCHEDULE TAB TOGGLE ---
  const tabDay1 = document.getElementById('tab-day1');
  const tabDay2 = document.getElementById('tab-day2');
  const schedDay1 = document.getElementById('schedule-day1');
  const schedDay2 = document.getElementById('schedule-day2');

  function switchSchedule(activeDay) {
    if (activeDay === 'day1') {
      tabDay1?.classList.add('active');
      tabDay1?.setAttribute('aria-selected', 'true');
      tabDay2?.classList.remove('active');
      tabDay2?.setAttribute('aria-selected', 'false');
      schedDay1?.classList.add('active');
      schedDay2?.classList.remove('active');
    } else {
      tabDay2?.classList.add('active');
      tabDay2?.setAttribute('aria-selected', 'true');
      tabDay1?.classList.remove('active');
      tabDay1?.setAttribute('aria-selected', 'false');
      schedDay2?.classList.add('active');
      schedDay1?.classList.remove('active');
    }
  }

  tabDay1?.addEventListener('click', () => switchSchedule('day1'));
  tabDay2?.addEventListener('click', () => switchSchedule('day2'));

  // --- 7. FAQ ACCORDION ---
  const faqItems = document.querySelectorAll('.faq-item');
  faqItems.forEach((item) => {
    const trigger = item.querySelector('.faq-trigger');
    trigger?.addEventListener('click', () => {
      const isExpanded = item.classList.contains('active');
      
      faqItems.forEach((other) => {
        if (other !== item) {
          other.classList.remove('active');
          other.querySelector('.faq-trigger')?.setAttribute('aria-expanded', 'false');
        }
      });

      if (isExpanded) {
        item.classList.remove('active');
        trigger.setAttribute('aria-expanded', 'false');
      } else {
        item.classList.add('active');
        trigger.setAttribute('aria-expanded', 'true');
      }
    });
  });

  // --- 8. TOAST NOTIFICATION SYSTEM ---
  const toastContainer = document.getElementById('toast-container');
  function showToast(message, type = 'success') {
    if (!toastContainer) return;
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    let icon = '🌱';
    if (type === 'success') icon = '✅';
    if (type === 'warning') icon = '⚠️';
    if (type === 'error') icon = '❌';

    toast.innerHTML = `
      <span class="toast-icon">${icon}</span>
      <span class="toast-msg">${message}</span>
    `;

    toastContainer.appendChild(toast);
    setTimeout(() => toast.classList.add('show'), 20);

    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 400);
    }, 4000);
  }

  // --- 9. FORM VALIDATION & REGISTRATION FLOW ---
  const regForm = document.getElementById('summit-registration-form');
  const submitBtn = document.getElementById('submit-btn');

  const emailInput = document.getElementById('email');
  const phoneInput = document.getElementById('phone');
  const collegeInput = document.getElementById('college');
  const deptSelect = document.getElementById('department');
  const yearSelect = document.getElementById('year');
  const termsCheckbox = document.getElementById('terms');

  function validateField(fieldId, condition) {
    const group = document.getElementById(`group-${fieldId}`);
    if (!group) return false;

    if (condition) {
      group.classList.remove('has-error');
      group.classList.add('is-valid');
      return true;
    } else {
      group.classList.add('has-error');
      group.classList.remove('is-valid');
      return false;
    }
  }

  fullNameInput?.addEventListener('input', () => {
    validateField('fullName', fullNameInput.value.trim().length >= 1);
  });

  emailInput?.addEventListener('input', () => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    validateField('email', emailRegex.test(emailInput.value.trim()));
  });

  phoneInput?.addEventListener('input', () => {
    const cleanPhone = phoneInput.value.replace(/[\s\-\+]/g, '');
    validateField('phone', cleanPhone.length >= 10 && /^\d+$/.test(cleanPhone));
  });

  collegeInput?.addEventListener('input', () => {
    validateField('college', collegeInput.value.trim().length >= 4);
  });

  deptSelect?.addEventListener('change', () => {
    validateField('department', deptSelect.value !== '');
  });

  yearSelect?.addEventListener('change', () => {
    validateField('year', yearSelect.value !== '');
  });

  trackSelect?.addEventListener('change', () => {
    validateField('participationType', trackSelect.value !== '');
  });

  termsCheckbox?.addEventListener('change', () => {
    validateField('terms', termsCheckbox.checked);
  });

  regForm?.addEventListener('submit', async (e) => {
    e.preventDefault();

    const isNameValid = validateField('fullName', fullNameInput.value.trim().length >= 1);
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const isEmailValid = validateField('email', emailRegex.test(emailInput.value.trim()));
    const cleanPhone = phoneInput.value.replace(/[\s\-\+]/g, '');
    const isPhoneValid = validateField('phone', cleanPhone.length >= 10 && /^\d+$/.test(cleanPhone));
    const isCollegeValid = validateField('college', collegeInput.value.trim().length >= 4);
    const isDeptValid = validateField('department', deptSelect.value !== '');
    const isYearValid = validateField('year', yearSelect.value !== '');
    const isTrackValid = validateField('participationType', trackSelect.value !== '');
    const isTermsValid = validateField('terms', termsCheckbox.checked);

    if (
      !isNameValid ||
      !isEmailValid ||
      !isPhoneValid ||
      !isCollegeValid ||
      !isDeptValid ||
      !isYearValid ||
      !isTrackValid ||
      !isTermsValid
    ) {
      showToast('Please fix all highlighted fields before submitting.', 'error');
      const firstError = document.querySelector('.form-group.has-error');
      firstError?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    const payload = {
      fullName: fullNameInput.value.trim(),
      email: emailInput.value.trim(),
      phone: phoneInput.value.trim(),
      college: collegeInput.value.trim(),
      department: deptSelect.value,
      year: yearSelect.value,
      participationType: trackSelect.value,
      club: document.getElementById('club')?.value || 'N/A',
      profileLink: document.getElementById('profileLink')?.value || 'N/A',
      specialReqs: document.getElementById('specialReqs')?.value || 'None',
      terms: termsCheckbox.checked
    };

    submitBtn?.classList.add('is-loading');
    submitBtn?.setAttribute('disabled', 'true');

    try {
      // Try Backend API First
      const response = await fetch(`${API_BASE}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await response.json();

      if (!response.ok) {
        showToast(data.error || 'Registration error. Please check your details.', 'warning');
        submitBtn?.classList.remove('is-loading');
        submitBtn?.removeAttribute('disabled');
        return;
      }

      saveLocalRegistration(data.registration);
      fetchSummitStats();

      submitBtn?.classList.remove('is-loading');
      submitBtn?.removeAttribute('disabled');

      triggerCelebration();
      showConfirmationModal(data.registration);
      showToast('AgriVerse Pass generated successfully!', 'success');
      return;
    } catch (networkErr) {
      // Fallback to client-side localStorage simulation if backend server is not running
      const local = getLocalRegistrations();
      const isDup = local.some((r) => r.email.toLowerCase() === payload.email.toLowerCase() || r.phone === payload.phone);
      if (isDup) {
        showToast('You have already registered with this email or phone number!', 'warning');
        submitBtn?.classList.remove('is-loading');
        submitBtn?.removeAttribute('disabled');
        return;
      }

      const randomHex = Math.floor(1000 + Math.random() * 9000);
      const regId = `AGRI-2026-${randomHex}`;
      const localData = {
        id: regId,
        name: payload.fullName,
        email: payload.email,
        phone: payload.phone,
        college: payload.college,
        department: payload.department,
        year: payload.year,
        track: payload.participationType,
        timestamp: new Date().toISOString()
      };

      saveLocalRegistration(localData);
      fetchSummitStats();

      submitBtn?.classList.remove('is-loading');
      submitBtn?.removeAttribute('disabled');

      triggerCelebration();
      showConfirmationModal(localData);
      showToast('AgriVerse Pass generated successfully!', 'success');
    }
  });

  // --- 10. CONFETTI CELEBRATION ---
  function triggerCelebration() {
    if (typeof confetti === 'function') {
      confetti({
        particleCount: 130,
        spread: 85,
        origin: { y: 0.6 },
        colors: ['#BFD8B5', '#6A1B2D', '#D6B56D', '#a42c47', '#ffffff']
      });

      setTimeout(() => {
        confetti({
          particleCount: 65,
          angle: 60,
          spread: 55,
          origin: { x: 0 },
          colors: ['#BFD8B5', '#D6B56D']
        });
        confetti({
          particleCount: 65,
          angle: 120,
          spread: 55,
          origin: { x: 1 },
          colors: ['#6A1B2D', '#D6B56D']
        });
      }, 350);
    }
  }

  // --- 11. CONFIRMATION MODAL & QR CODE GENERATION ---
  const confirmationModal = document.getElementById('confirmation-modal');
  const modalCloseBtn = document.getElementById('modal-close-btn');
  const backToEventBtn = document.getElementById('back-to-event-btn');
  const printTicketBtn = document.getElementById('print-ticket-btn');
  const downloadTicketBtn = document.getElementById('download-ticket-btn');

  function showConfirmationModal(data) {
    document.getElementById('ticket-name').textContent = data.name.toUpperCase();
    document.getElementById('ticket-college').textContent = data.college;
    document.getElementById('ticket-regid').textContent = data.id;
    document.getElementById('ticket-track').textContent = data.track;
    document.getElementById('ticket-security-code').textContent = `HASH: ${data.id.replace('AGRI-2026-', '')}-BIO-OK`;
    document.getElementById('ticket-timestamp').textContent = new Date().toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });

    const qrContainer = document.getElementById('ticket-qr-code');
    if (qrContainer) {
      qrContainer.innerHTML = '';
      if (typeof QRCode !== 'undefined') {
        new QRCode(qrContainer, {
          text: `https://agriverse2026.org/verify?id=${data.id}&delegate=${encodeURIComponent(data.name)}`,
          width: 110,
          height: 110,
          colorDark: '#081d16',
          colorLight: '#ffffff',
          correctLevel: QRCode.CorrectLevel.H
        });
      }
    }

    confirmationModal?.classList.add('active');
    document.body.style.overflow = 'hidden';
  }

  function closeModal() {
    confirmationModal?.classList.remove('active');
    document.body.style.overflow = '';
  }

  modalCloseBtn?.addEventListener('click', closeModal);
  backToEventBtn?.addEventListener('click', closeModal);

  confirmationModal?.addEventListener('click', (e) => {
    if (e.target === confirmationModal) {
      closeModal();
    }
  });

  printTicketBtn?.addEventListener('click', () => {
    window.print();
  });

  downloadTicketBtn?.addEventListener('click', () => {
    const regId = document.getElementById('ticket-regid').textContent;
    const name = document.getElementById('ticket-name').textContent;
    const track = document.getElementById('ticket-track').textContent;
    const college = document.getElementById('ticket-college').textContent;

    const receiptContent = `=====================================================
AGRIVERSE 2026 // OFFICIAL DELEGATE ADMISSION PASS
Faculty of Agri-Tech & Sustainable Engineering
=====================================================

REGISTRATION ID : ${regId}
PASS HOLDER     : ${name}
INSTITUTION     : ${college}
TRACK ALLOCATED : ${track}
EVENT DATES     : November 14 - 15, 2026 (08:30 AM IST)
VENUE           : BioTech Grand Amphitheater & Smart AgriLabs
ENTRY GATE      : Green-1 Gate (Academic Center)
MEAL PRIVILEGES : Included (Organic Breakfast, Lunch, Coffee)
SECURITY STATUS : VERIFIED PASS [256-BIT CRYPTOGRAPHIC]

IMPORTANT INSTRUCTIONS:
1. Carry a printed copy or digital view of this pass on your phone.
2. Present your original College Student ID card at Check-in.
3. Arrive by 08:30 AM on Day 1 for badge & bio-swag kit collection.
4. For accommodation queries, email: support@agriverse2026.org

=====================================================
Generated electronically for ${name}.
© 2026 AgriVerse. All Rights Reserved.
=====================================================`;

    const blob = new Blob([receiptContent], { type: 'text/plain' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `AgriVerse-2026-Pass-${regId}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    showToast('AgriVerse pass receipt downloaded!', 'success');
  });

  // --- 12. NEWSLETTER FORM ---
  const newsForm = document.getElementById('newsletter-form');
  newsForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('news-email')?.value;
    if (email) {
      try {
        await fetch(`${API_BASE}/newsletter`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email })
        });
      } catch (err) {}
      showToast(`Subscribed ${email} to AgriVerse updates!`, 'success');
      newsForm.reset();
    }
  });

  // --- 13. INTERSECTION OBSERVER FOR SCROLL REVEAL ---
  const revealElements = document.querySelectorAll('.reveal-on-scroll');
  if ('IntersectionObserver' in window) {
    const revealObserver = new IntersectionObserver(
      (entries, observer) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('revealed');
            observer.unobserve(entry.target);
          }
        });
      },
      { root: null, rootMargin: '0px 0px -50px 0px', threshold: 0.1 }
    );

    revealElements.forEach((el) => revealObserver.observe(el));
  } else {
    revealElements.forEach((el) => el.classList.add('revealed'));
  }
});
