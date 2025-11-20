// ==================== PHONE INPUT INITIALIZATION ====================
function initPhone(id, errId) {
    const input = document.querySelector(id);
    const iti = window.intlTelInput(input, {
        initialCountry: "IN",
        preferredCountries: ["IN", "US", "GB"],
        utilsScript: "https://cdn.jsdelivr.net/npm/intl-tel-input@24.3.6/build/js/utils.js",
        separateDialCode: true,
        formatOnDisplay: true,
    });
    const err = document.getElementById(errId);

    input.addEventListener('input', () => {
        const fullNum = iti.getNumber();
        const selectedCountry = iti.getSelectedCountryData();
        const dialCode = selectedCountry ? selectedCountry.dialCode : '';
        const nationalNum = fullNum.replace(new RegExp(`^\\+?${dialCode}`), '').replace(/\D/g, '');

        input.classList.remove('is-valid', 'is-invalid');
        if (err) err.textContent = '';

        // Limit length
        if (nationalNum.length > 15) {
            input.value = input.value.slice(0, -1);
            return;
        }

        // India-specific: cannot start with 0
        if (selectedCountry.iso2 === 'in' && nationalNum[0] === '0') {
            input.value = '';
            if (err) err.textContent = 'Indian numbers cannot start with 0';
            input.classList.add('is-invalid');
            return;
        }

        if (nationalNum.length >= 8 && iti.isValidNumber()) {
            input.classList.add('is-valid');
        }
    });

    return iti;
}

const mainIti = initPhone('#phone', 'phoneError');
const popupIti = initPhone('#popup-phone', 'popupPhoneError');

// ==================== VALIDATION FUNCTIONS ====================
function validate(form, iti) {
    let ok = true;

    // Clear previous errors
    form.querySelectorAll('.is-invalid, .is-valid').forEach(el => el.classList.remove('is-invalid', 'is-valid'));
    form.querySelectorAll('.error-text').forEach(el => el.textContent = '');

    // Get fields
    const nameField = form.querySelector('input[name="name"], #popup-name');
    const emailField = form.querySelector('input[name="email"], #popup-email');
    const phoneField = form.querySelector('input[name="phone"], #popup-phone');
    const terms = form.querySelector('input[type="checkbox"]');

    // NAME
    if (!nameField || nameField.value.trim() === "") {
        if (nameField) markError(nameField, "Name is required");
        ok = false;
    }

    // EMAIL
    const email = emailField ? emailField.value.trim() : "";
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailField || !emailPattern.test(email)) {
        if (emailField) markError(emailField, "Valid email required");
        ok = false;
    }

    // TERMS
    if (!terms || !terms.checked) {
        alert("Please accept Terms and Conditions");
        ok = false;
    }

    // PHONE
    // PHONE
    let fullNum = "";
    if (iti) fullNum = iti.getNumber();
    const selectedCountry = iti ? iti.getSelectedCountryData() : null;

    if (!phoneField || !fullNum) {
        if (phoneField) markError(phoneField, "Phone number required");
        ok = false;
    } else if (!iti.isValidNumber()) {
        markError(phoneField, "Invalid phone number for selected country");
        ok = false;
    } else {
        // Optional: mark valid visually
        phoneField.classList.add("is-valid");
    }


    return ok;
}

function markError(input, message) {
    input.classList.add("is-invalid");
    const errorEl = input.parentElement.querySelector('.error-text');
    if (errorEl) errorEl.textContent = message;
}

// ==================== FORM SUBMISSION HANDLER ====================
async function handleFormSubmit(event, formType) {
    event.preventDefault();
    const form = event.target;

    const itiInstance = (formType === "popup") ? popupIti : mainIti;
    const submitBtn = form.querySelector(".submit-btn");

    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = "Submitting...";
    }

    if (!validate(form, itiInstance)) {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = "Submit Form";
        }
        return;
    }

    // UTM params
    const url = new URL(window.location.href);
    const getParam = (param, fallback) => url.searchParams.get(param) || fallback;

    const newSource = getParam("utm_source", "Google Lead");
    const newContentsource = getParam("utm_content", "Content");
    const newCampaignName = getParam("utm_campaign", "Campaign Name");
    const newKeyword = getParam("keyword", "Keyword");

    // Get full number
    const phoneInput = form.querySelector('input[name="phone"], #popup-phone');
    let formattedNumber = "";
    try {
        formattedNumber = itiInstance ? itiInstance.getNumber() : (phoneInput ? phoneInput.value.trim() : "");
    } catch (e) {
        formattedNumber = phoneInput ? phoneInput.value.trim() : "";
    }

    try {
        // Visitor IP
        const ipResponse = await fetch("https://api.ipify.org?format=json");
        const ipData = await ipResponse.json();
        const visitorIP = ipData.ip || "Unknown";

        // NuraCRM payload
        const name = form.querySelector('input[name="name"], #popup-name')?.value.trim() || "";
        const email = form.querySelector('input[name="email"], #popup-email')?.value.trim() || "";

        const nuraPayload = {
            first_name: name,
            lead_name: name,
            email: email,
            mobile_no: formattedNumber,
            status: "Not contacted",
            source: newSource,
            territory: "Bengaluru",
        };

        await fetch("https://nuracrm-test.onedesk.app/api/resource/CRM Lead", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": "token 21b6f0d64bdf0cd:24630f1b0410c28",
            },
            body: JSON.stringify(nuraPayload),
        });

        // TeleCRM payload
        const telePayload = {
            fields: {
                name: name,
                phone: formattedNumber,
                email: email,
                lead_source: newSource,
                center: "Bengaluru",
                landing_page: window.location.origin + location.pathname,
                campaign_name: newCampaignName,
                ad_name: newContentsource,
                keyword: newKeyword,
                ip_address: visitorIP,
            },
        };

        await fetch(
            "https://next-api.telecrm.in/v2/enterprise/68c406e91f25e2261f341b1e/autoupdatelead",
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization":
                        "Bearer 412f35c0-2549-4114-bfe0-09ff79b6af1f1758088338356:4a03adde-cf32-437c-bc22-fd8d74332348",
                },
                body: JSON.stringify(telePayload),
            }
        );

        // Redirect on success
        window.location.href = "./thankyou.html";
    } catch (error) {
        console.error("Error submitting form:", error);
        alert("There was a problem submitting the form. Please try again.");
    } finally {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = "Submit Form";
        }
    }
}

// ==================== EVENT LISTENERS ====================
document.addEventListener("DOMContentLoaded", function () {
    const mainForm = document.getElementById("contactForm");
    const popupForm = document.getElementById("popupForm");

    if (mainForm) mainForm.addEventListener("submit", (e) => handleFormSubmit(e, "main"));
    if (popupForm) popupForm.addEventListener("submit", (e) => handleFormSubmit(e, "popup"));
});


// Auto-play videos when slide becomes active (keep this function - it's still needed)
const playActiveVideo = (swiper) => {
  swiper.slides.forEach((slide, i) => {
    const video = slide.querySelector('video');
    if (video) {
      if (i === swiper.activeIndex) {
        video.play();
      } else {
        video.pause();
        video.currentTime = 0;
      }
    }
  });
};

// Image Carousel (if you also want to remove autoplay here)
const imageSwiper = new Swiper('.image-swiper', {
  loop: true,
  // autoplay removed completely
  pagination: {
    el: '.swiper-pagination',
    clickable: true,
  },
  navigation: {
    nextEl: '.swiper-button-next',
    prevEl: '.swiper-button-prev',
  },
});

// Video Carousel - AUTOPLAY REMOVED
const videoSwiper = new Swiper('.video-swiper', {
  loop: true,
  // ← Autoplay completely removed
  pagination: {
    el: '.swiper-pagination',
    clickable: true,
  },
  navigation: {
    nextEl: '.swiper-button-next',
    prevEl: '.swiper-button-prev',
  },
  on: {
    slideChange: function () {
      playActiveVideo(this);
    },
    init: function () {
      playActiveVideo(this);
    },
  },
});

document.addEventListener('DOMContentLoaded', () => {
    const wrappers = document.querySelectorAll('.testimonial-video-wrapper');

    wrappers.forEach(wrapper => {
        const playBtn = wrapper.querySelector('.play-btn');
        const poster = wrapper.querySelector('.poster');
        const videoSrc = wrapper.dataset.video;
        const posterSrc = wrapper.dataset.poster;

        playBtn.addEventListener('click', () => {
            // Skip hidden elements (desktop vs mobile)
            if (wrapper.offsetParent === null) return;

            // Pause all other videos
            document.querySelectorAll('.testimonial-video-wrapper video').forEach(v => v.pause());

            // Hide poster and button
            poster.style.display = 'none';
            playBtn.style.display = 'none';

            // Remove any existing video
            const existingVideo = wrapper.querySelector('video');
            if (existingVideo) existingVideo.remove();

            // Create new video
            const video = document.createElement('video');
            video.src = videoSrc;
            if (posterSrc) video.poster = posterSrc;
            video.autoplay = true;
            video.controls = true;
            video.playsInline = true;

            wrapper.appendChild(video);
            wrapper.classList.add('playing');

            // Toggle play/pause on video click
            video.addEventListener('click', () => {
                if (video.paused) {
                    document.querySelectorAll('.testimonial-video-wrapper video').forEach(v => v.pause());
                    video.play();
                } else {
                    video.pause();
                }
            });
        });
    });

    // ===== Swiper Init for Mobile - AUTOPLAY REMOVED =====
    if (window.innerWidth < 768 && document.querySelector('.testimonials-slider .swiper')) {
        const swiper = new Swiper('.testimonials-slider .swiper', {
            loop: true,
            slidesPerView: 1,
            spaceBetween: 20,
            centeredSlides: true,
            // Autoplay completely removed - no auto-advance anymore

            pagination: {
                el: '.swiper-pagination',
                clickable: true,
            },
            navigation: {
                nextEl: '.swiper-button-next',
                prevEl: '.swiper-button-prev',
            },
            breakpoints: {
                576: {
                    slidesPerView: 1.2,
                    spaceBetween: 15
                }
            }
        });
    }

    // Initialize AOS
    if (AOS) AOS.init();
});



document.addEventListener('DOMContentLoaded', () => {
  if (window.innerWidth < 992) {
    new bootstrap.Carousel('#mobileInfoCarousel', {
      ride: 'carousel',
      interval: 4000
    });
  }
});



/* ==================== MAP = FORM HEIGHT ==================== */
function syncHeight() {
    const formSide = document.querySelector('.form-side');
    const mapSide = document.querySelector('.map-side');
    if (!formSide || !mapSide) return;

    const height = formSide.offsetHeight;
    mapSide.style.minHeight = height + 'px';
}
window.addEventListener('load', syncHeight);
window.addEventListener('resize', syncHeight);


/* ==================== POPUP (15 seconds) ==================== */
const popup = document.getElementById('popup');
const closeBtn = document.getElementById('closePopup');

let timer = setTimeout(() => {
    if (!sessionStorage.getItem('popupSeen')) {
        popup.classList.add('open');
        document.body.style.overflow = 'hidden';
    }
}, 15000);

function closePopup() {
    popup.classList.remove('open');
    document.body.style.overflow = 'auto';
    clearTimeout(timer);
}
if (closeBtn) closeBtn.onclick = closePopup;
if (popup) {
    popup.onclick = e => { if (e.target === popup) closePopup(); };
    popup.addEventListener('transitionend', () => {
        if (popup.classList.contains('open')) sessionStorage.setItem('popupSeen', 'true');
    });
}
document.onkeydown = e => { if (e.key === 'Escape') closePopup(); };
if (sessionStorage.getItem('popupSeen')) clearTimeout(timer);



// FAQ Section
const buttons = document.querySelectorAll('.category-btn');
const categories = document.querySelectorAll('.faq-category');

buttons.forEach(btn => {
  btn.addEventListener('click', () => {
    // update button states
    buttons.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    // show corresponding FAQ section
    const target = btn.dataset.category;
    categories.forEach(cat => {
      cat.classList.toggle('active', cat.id === target);
    });
  });
});

/* ✅ SEO Popup*/
function openSeoPopup(element) {
  document.getElementById('seoPopup').style.display = 'flex';

  // scroll to target section inside popup
  const target = element.getAttribute('data-target');
  const section = document.getElementById(target);
  if (section) {
    section.scrollIntoView({ behavior: 'smooth' });
  }
}

function closeSeoPopup() {
  document.getElementById('seoPopup').style.display = 'none';
}

// Close popup when clicking outside content
window.addEventListener('click', function (event) {
  const popup = document.getElementById('seoPopup');
  if (event.target === popup) {
    closeSeoPopup();
  }
});


// =========carousel script=========

document.addEventListener('DOMContentLoaded', () => {
  const carouselEl = document.getElementById('heroCarousel');
  const carousel = new bootstrap.Carousel(carouselEl, { pause: false });
  const video = document.querySelector('.hero-video');
  const playButton = document.querySelector('.play-button');
  const thumbnail = document.querySelector('.hero-thumbnail');
  const overlay = document.querySelector('.video-overlay');

  // Autoplay when slide becomes active
  carouselEl.addEventListener('slide.bs.carousel', (e) => {
    if (e.to === 0) {
      // Going to video slide → autoplay
      video.play().catch(() => console.log("Autoplay prevented"));
      // Hide thumbnail & overlay after short delay (smooth)
      setTimeout(() => {
        thumbnail.style.opacity = '0';
        overlay.style.opacity = '0';
      }, 100);
    } else {
      // Leaving video slide → pause & reset
      video.pause();
      video.currentTime = 0;
      thumbnail.style.opacity = '1';
      overlay.style.opacity = '1';
    }
  });

  // Optional: Click play button to restart (in case user wants)
  playButton?.addEventListener('click', () => {
    video.play();
    thumbnail.style.opacity = '0';
    overlay.style.opacity = '0';
  });

  // Ensure video is ready
  video.addEventListener('canplay', () => {
    if (document.querySelector('.carousel-item.active .hero-video')) {
      video.play().catch(() => { });
    }
  });
});