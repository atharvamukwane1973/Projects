(function () {
  "use strict";

  const STORAGE_KEYS = {
    profile: "portfolio_profile_image",
    certs: "portfolio_certificates",
    internships: "portfolio_internships",
    resume: "portfolio_resume_pdf",
    ownerPin: "portfolio_owner_pin",
    adminSession: "portfolio_admin_unlocked",
  };

  const MAX_IMAGE_SIZE = 2 * 1024 * 1024; // 2 MB
  const MAX_DOC_SIZE = 3 * 1024 * 1024; // 3 MB (offer letter, completion cert)
  const MAX_RESUME_SIZE = 5 * 1024 * 1024; // 5 MB
  const STATIC_RESUME_PATH = "assets/resume.pdf";

  const header = document.getElementById("header");
  const navToggle = document.getElementById("navToggle");
  const navLinks = document.getElementById("navLinks");
  const yearEl = document.getElementById("year");
  const navAnchors = document.querySelectorAll(".nav-links a[href^='#']");
  const sections = document.querySelectorAll("section[id]");
  const revealEls = document.querySelectorAll(".reveal");
  let skillObserver = null;
  const toast = document.getElementById("toast");

  // Profile photo
  const profileUploadWrap = document.getElementById("profileUploadWrap");
  const profileImage = document.getElementById("profileImage");
  const profileInitials = document.getElementById("profileInitials");
  const profileModal = document.getElementById("profileModal");
  const profileModalInput = document.getElementById("profileModalInput");
  const profilePreviewImg = document.getElementById("profilePreviewImg");
  const profilePreviewInitials = document.getElementById("profilePreviewInitials");
  const profileZoom = document.getElementById("profileZoom");
  const profilePosX = document.getElementById("profilePosX");
  const profilePosY = document.getElementById("profilePosY");
  const profileZoomVal = document.getElementById("profileZoomVal");
  const profilePosXVal = document.getElementById("profilePosXVal");
  const profilePosYVal = document.getElementById("profilePosYVal");
  const profileResetAdjustBtn = document.getElementById("profileResetAdjustBtn");
  const profileRemoveBtn = document.getElementById("profileRemoveBtn");
  const profileSaveBtn = document.getElementById("profileSaveBtn");
  const openProfileEditorBtn = document.getElementById("openProfileEditorBtn");
  const DEFAULT_PROFILE_ASSET = "assets/profile.jpg";

  let profileDraft = null;

  // Certificates
  const certGrid = document.getElementById("certGrid");
  const certEmptyHint = document.getElementById("certEmptyHint");
  const addCertBtn = document.getElementById("addCertBtn");
  const certModal = document.getElementById("certModal");
  const certForm = document.getElementById("certForm");
  const certEditId = document.getElementById("certEditId");
  const certFileInput = document.getElementById("certFileInput");
  const certDropzone = document.getElementById("certDropzone");
  const certDropzoneInner = document.getElementById("certDropzoneInner");
  const certPreview = document.getElementById("certPreview");
  const certTitle = document.getElementById("certTitle");
  const certIssuer = document.getElementById("certIssuer");
  const certYear = document.getElementById("certYear");
  const certModalTitle = document.getElementById("certModalTitle");
  const lightbox = document.getElementById("lightbox");
  const lightboxImg = document.getElementById("lightboxImg");
  const lightboxClose = document.getElementById("lightboxClose");

  let certPendingImage = null;
  let certificates = [];
  let internships = [];
  let internPendingOffer = undefined;
  let internPendingCompletion = undefined;
  let resumePendingFile = null;
  let staticResumeAvailable = false;

  // Resume (public download + owner manage)
  const resumeDownloadBtn = document.getElementById("resumeDownloadBtn");
  const resumeDownloadLabel = document.getElementById("resumeDownloadLabel");
  const navLogoBtn = document.getElementById("navLogoBtn");
  const ownerLoginModal = document.getElementById("ownerLoginModal");
  const ownerLoginForm = document.getElementById("ownerLoginForm");
  const ownerLoginDesc = document.getElementById("ownerLoginDesc");
  const ownerPinInput = document.getElementById("ownerPin");
  const ownerPanelModal = document.getElementById("ownerPanelModal");
  const resumeFileName = document.getElementById("resumeFileName");
  const resumeUploadDate = document.getElementById("resumeUploadDate");
  const resumeFileInput = document.getElementById("resumeFileInput");
  const resumeUploadBtn = document.getElementById("resumeUploadBtn");
  const resumePreviewBtn = document.getElementById("resumePreviewBtn");
  const resumeDeleteBtn = document.getElementById("resumeDeleteBtn");
  const resumeExportBtn = document.getElementById("resumeExportBtn");
  const ownerLogoutBtn = document.getElementById("ownerLogoutBtn");
  const ownerChangePinBtn = document.getElementById("ownerChangePinBtn");
  const goToCertsBtn = document.getElementById("goToCertsBtn");
  const goToInternBtn = document.getElementById("goToInternBtn");
  const certSubtitle = document.getElementById("certSubtitle");

  // Internships
  const experienceGrid = document.getElementById("experienceGrid");
  const expEmptyHint = document.getElementById("expEmptyHint");
  const expSubtitle = document.getElementById("expSubtitle");
  const addInternBtn = document.getElementById("addInternBtn");
  const internModal = document.getElementById("internModal");
  const internForm = document.getElementById("internForm");
  const internEditId = document.getElementById("internEditId");
  const internModalTitle = document.getElementById("internModalTitle");
  const internTitle = document.getElementById("internTitle");
  const internCompany = document.getElementById("internCompany");
  const internDuration = document.getElementById("internDuration");
  const internDescription = document.getElementById("internDescription");
  const internAchievements = document.getElementById("internAchievements");
  const internSkills = document.getElementById("internSkills");
  const offerFileInput = document.getElementById("offerFileInput");
  const completionFileInput = document.getElementById("completionFileInput");
  const offerDropzone = document.getElementById("offerDropzone");
  const completionDropzone = document.getElementById("completionDropzone");
  const offerFileName = document.getElementById("offerFileName");
  const completionFileName = document.getElementById("completionFileName");
  const offerClearBtn = document.getElementById("offerClearBtn");
  const completionClearBtn = document.getElementById("completionClearBtn");

  // ——— Utilities ———
  function showToast(message) {
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add("show");
    clearTimeout(showToast._timer);
    showToast._timer = setTimeout(function () {
      toast.classList.remove("show");
    }, 3200);
  }

  function readFileAsDataURL(file) {
    return new Promise(function (resolve, reject) {
      const reader = new FileReader();
      reader.onload = function () {
        resolve(reader.result);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  function validateImageFile(file) {
    if (!file || !file.type.startsWith("image/")) {
      showToast("Please choose a JPG, PNG, or WebP image.");
      return false;
    }
    if (file.size > MAX_IMAGE_SIZE) {
      showToast("Image is too large. Please use a file under 2 MB.");
      return false;
    }
    return true;
  }

  function generateId(prefix) {
    return (prefix || "item") + "_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8);
  }

  function validateDocFile(file) {
    if (!file) return false;
    const isImage = file.type.startsWith("image/");
    const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
    if (!isImage && !isPdf) {
      showToast("Use JPG, PNG, WebP, or PDF only.");
      return false;
    }
    if (file.size > MAX_DOC_SIZE) {
      showToast("File is too large. Max size is 3 MB.");
      return false;
    }
    return true;
  }

  async function fileToStoredDoc(file) {
    const data = await readFileAsDataURL(file);
    return {
      data: data,
      fileName: file.name,
      mime: file.type || (file.name.toLowerCase().endsWith(".pdf") ? "application/pdf" : "image/jpeg"),
    };
  }

  function isPdfDoc(doc) {
    return doc && (doc.mime === "application/pdf" || (doc.fileName && doc.fileName.toLowerCase().endsWith(".pdf")));
  }

  function viewStoredDoc(doc) {
    if (!doc || !doc.data) return;
    if (isPdfDoc(doc)) {
      window.open(doc.data, "_blank", "noopener,noreferrer");
    } else {
      openLightbox(doc.data);
    }
  }

  function parseLines(text) {
    return text
      .split("\n")
      .map(function (s) {
        return s.trim();
      })
      .filter(Boolean);
  }

  function parseTags(text) {
    return text
      .split(",")
      .map(function (s) {
        return s.trim();
      })
      .filter(Boolean);
  }

  function readFileAsArrayBuffer(file) {
    return new Promise(function (resolve, reject) {
      const reader = new FileReader();
      reader.onload = function () {
        resolve(reader.result);
      };
      reader.onerror = reject;
      reader.readAsArrayBuffer(file);
    });
  }

  function arrayBufferToBase64(buffer) {
    let binary = "";
    const bytes = new Uint8Array(buffer);
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  function isAdmin() {
    return sessionStorage.getItem(STORAGE_KEYS.adminSession) === "1";
  }

  function setAdmin(unlocked) {
    if (unlocked) {
      sessionStorage.setItem(STORAGE_KEYS.adminSession, "1");
    } else {
      sessionStorage.removeItem(STORAGE_KEYS.adminSession);
    }
    updateAdminUI();
  }

  function updateAdminUI() {
    const admin = isAdmin();
    document.body.classList.toggle("admin-mode", admin);

    if (certSubtitle) {
      certSubtitle.textContent = admin
        ? "Owner mode — add, edit, or remove your certificates below."
        : "Click a certificate to view it full size.";
    }

    if (certEmptyHint && certificates.length === 0) {
      certEmptyHint.classList.remove("hidden");
      certEmptyHint.innerHTML = admin
        ? 'No certificates yet. Click <strong>Add Certificate</strong> to get started.'
        : "No certificates listed yet.";
    }

    if (expSubtitle) {
      expSubtitle.textContent = admin
        ? "Owner mode — add internships, describe your work, and upload documents."
        : "Internships and work experience.";
    }

    if (expEmptyHint) {
      if (internships.length === 0) {
        expEmptyHint.classList.remove("hidden");
        expEmptyHint.innerHTML = admin
          ? 'No internships yet. Click <strong>Add Internship</strong> to add CodeAlpha or any other role.'
          : "No internships listed yet.";
      } else {
        expEmptyHint.classList.add("hidden");
      }
    }

    renderCertificates();
    renderInternships();
    if (window.PortfolioContent && window.PortfolioContent.renderAll) {
      window.PortfolioContent.renderAll();
    }
  }

  function requireAdmin(action) {
    if (isAdmin()) return true;
    showToast("Unlock owner access first (footer → Owner).");
    openOwnerLogin();
    return false;
  }

  function getStoredPin() {
    return localStorage.getItem(STORAGE_KEYS.ownerPin);
  }

  function openModal(modal) {
    if (!modal) return;
    modal.classList.add("open");
    modal.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
  }

  function closeModal(modal) {
    if (!modal) return;
    modal.classList.remove("open");
    modal.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
  }

  // ——— Resume ———
  function getResumeData() {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.resume);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  function saveResumeData(data) {
    if (data) {
      localStorage.setItem(STORAGE_KEYS.resume, JSON.stringify(data));
    } else {
      localStorage.removeItem(STORAGE_KEYS.resume);
    }
    updateResumeUI();
  }

  function hasResumeAvailable() {
    return !!getResumeData() || staticResumeAvailable;
  }

  function getResumeDownloadInfo() {
    const stored = getResumeData();
    if (stored && stored.data) {
      return {
        url: "data:application/pdf;base64," + stored.data,
        fileName: stored.fileName || "Atharva_Mukwane_Resume.pdf",
      };
    }
    if (staticResumeAvailable) {
      return {
        url: STATIC_RESUME_PATH,
        fileName: "Atharva_Mukwane_Resume.pdf",
      };
    }
    return null;
  }

  function updateResumeUI() {
    const stored = getResumeData();
    const available = hasResumeAvailable();

    if (resumeDownloadBtn) {
      resumeDownloadBtn.disabled = !available;
    }
    if (resumeDownloadLabel) {
      resumeDownloadLabel.textContent = available ? "Download Resume" : "Resume not uploaded";
    }

    if (resumeFileName) {
      if (stored) {
        resumeFileName.textContent = stored.fileName || "resume.pdf";
      } else if (staticResumeAvailable) {
        resumeFileName.textContent = "assets/resume.pdf (from folder)";
      } else {
        resumeFileName.textContent = "No resume uploaded";
      }
    }

    if (resumeUploadDate) {
      resumeUploadDate.textContent = stored && stored.uploadedAt
        ? "Last updated: " + new Date(stored.uploadedAt).toLocaleDateString()
        : "";
    }

    const canManage = !!(stored && stored.data);
    if (resumePreviewBtn) resumePreviewBtn.disabled = !available;
    if (resumeDeleteBtn) resumeDeleteBtn.disabled = !canManage;
    if (resumeExportBtn) resumeExportBtn.disabled = !canManage;
  }

  async function checkStaticResume() {
    try {
      const res = await fetch(STATIC_RESUME_PATH, { method: "HEAD" });
      staticResumeAvailable = res.ok;
    } catch (e) {
      staticResumeAvailable = false;
    }
    updateResumeUI();
  }

  function downloadResume() {
    const info = getResumeDownloadInfo();
    if (!info) {
      showToast("Resume is not available yet.");
      return;
    }
    const link = document.createElement("a");
    link.href = info.url;
    link.download = info.fileName;
    link.rel = "noopener";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast("Downloading resume…");
  }

  function previewResume() {
    const info = getResumeDownloadInfo();
    if (!info) return;
    window.open(info.url, "_blank", "noopener,noreferrer");
  }

  async function saveResumeFromFile(file) {
    if (!file) {
      showToast("Choose a PDF file first.");
      return;
    }
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      showToast("Only PDF files are allowed.");
      return;
    }
    if (file.size > MAX_RESUME_SIZE) {
      showToast("PDF is too large. Max size is 5 MB.");
      return;
    }

    try {
      const buffer = await readFileAsArrayBuffer(file);
      const base64 = arrayBufferToBase64(buffer);
      saveResumeData({
        data: base64,
        fileName: file.name,
        uploadedAt: new Date().toISOString(),
      });
      resumePendingFile = null;
      if (resumeFileInput) resumeFileInput.value = "";
      showToast("Resume saved! Recruiters can now download it.");
      updateResumeUI();
    } catch (e) {
      showToast("Could not save resume. Try a smaller PDF.");
    }
  }

  function deleteResume() {
    if (!getResumeData()) return;
    if (!confirm("Delete your uploaded resume? Recruiters will not be able to download until you upload again.")) {
      return;
    }
    saveResumeData(null);
    showToast("Resume deleted.");
  }

  function openOwnerLogin() {
    const hasPin = !!getStoredPin();
    if (ownerLoginDesc) {
      ownerLoginDesc.textContent = hasPin
        ? "Enter your PIN to manage profile photo, resume, internships, and certificates."
        : "Create a PIN (4–8 digits) to manage your portfolio. Recruiters can only view and download.";
    }
    if (ownerPinInput) ownerPinInput.value = "";
    openModal(ownerLoginModal);
    ownerPinInput && ownerPinInput.focus();
  }

  function openOwnerPanel() {
    updateResumeUI();
    openModal(ownerPanelModal);
  }

  function handleOwnerLogin(pin) {
    const stored = getStoredPin();
    if (!stored) {
      if (!/^\d{4,8}$/.test(pin)) {
        showToast("PIN must be 4–8 digits.");
        return false;
      }
      localStorage.setItem(STORAGE_KEYS.ownerPin, pin);
      setAdmin(true);
      setAdmin(true);
      showToast("PIN created. Manage resume, internships & certificates.");
      return true;
    }
    if (pin !== stored) {
      showToast("Wrong PIN. Try again.");
      return false;
    }
    setAdmin(true);
    showToast("Unlocked. You can edit your portfolio.");
    return true;
  }

  function handleChangePin() {
    const current = prompt("Enter your current PIN:");
    if (current === null) return;
    if (current !== getStoredPin()) {
      showToast("Current PIN is incorrect.");
      return;
    }
    const next = prompt("Enter new PIN (4–8 digits):");
    if (next === null) return;
    if (!/^\d{4,8}$/.test(next)) {
      showToast("New PIN must be 4–8 digits.");
      return;
    }
    localStorage.setItem(STORAGE_KEYS.ownerPin, next);
    showToast("PIN updated.");
  }

  if (resumeDownloadBtn) {
    resumeDownloadBtn.addEventListener("click", downloadResume);
  }

  // Triple-tap AM logo for owner access (single tap = scroll to top)
  const LOGO_TAPS_REQUIRED = 3;
  const LOGO_TAP_RESET_MS = 550;
  let logoTapCount = 0;
  let logoTapResetTimer = null;

  function openOwnerAccess() {
    if (isAdmin()) {
      openOwnerPanel();
    } else {
      openOwnerLogin();
    }
  }

  if (navLogoBtn) {
    navLogoBtn.addEventListener("click", function (e) {
      e.preventDefault();
      logoTapCount++;
      clearTimeout(logoTapResetTimer);

      if (logoTapCount >= LOGO_TAPS_REQUIRED) {
        logoTapCount = 0;
        openOwnerAccess();
        return;
      }

      logoTapResetTimer = setTimeout(function () {
        if (logoTapCount === 1) {
          const hero = document.getElementById("hero");
          if (hero) {
            hero.scrollIntoView({ behavior: "smooth", block: "start" });
          }
        }
        logoTapCount = 0;
      }, LOGO_TAP_RESET_MS);
    });
  }

  document.getElementById("editHeroSectionBtn") &&
    document.getElementById("editHeroSectionBtn").addEventListener("click", function () {
      if (!requireAdmin()) return;
      if (window.PortfolioContent && window.PortfolioContent.openHeroModal) {
        window.PortfolioContent.openHeroModal();
      }
    });

  if (ownerLoginForm) {
    ownerLoginForm.addEventListener("submit", function (e) {
      e.preventDefault();
      const pin = ownerPinInput ? ownerPinInput.value.trim() : "";
      if (handleOwnerLogin(pin)) {
        closeModal(ownerLoginModal);
        openOwnerPanel();
      }
    });
  }

  ownerLoginModal &&
    ownerLoginModal.querySelectorAll("[data-close-owner-login]").forEach(function (el) {
      el.addEventListener("click", function () {
        closeModal(ownerLoginModal);
      });
    });

  ownerPanelModal &&
    ownerPanelModal.querySelectorAll("[data-close-owner-panel]").forEach(function (el) {
      el.addEventListener("click", function () {
        closeModal(ownerPanelModal);
      });
    });

  if (resumeFileInput) {
    resumeFileInput.addEventListener("change", function () {
      resumePendingFile = this.files && this.files[0];
      if (resumePendingFile) {
        showToast('Selected: "' + resumePendingFile.name + '". Click Save resume.');
      }
    });
  }

  if (resumeUploadBtn) {
    resumeUploadBtn.addEventListener("click", function () {
      if (!isAdmin()) {
        showToast("Unlock owner access first.");
        openOwnerLogin();
        return;
      }
      if (resumePendingFile) {
        saveResumeFromFile(resumePendingFile);
      } else if (resumeFileInput && resumeFileInput.files[0]) {
        saveResumeFromFile(resumeFileInput.files[0]);
      } else {
        showToast("Choose a PDF file first.");
      }
    });
  }

  if (resumePreviewBtn) {
    resumePreviewBtn.addEventListener("click", previewResume);
  }

  if (resumeDeleteBtn) {
    resumeDeleteBtn.addEventListener("click", function () {
      if (!isAdmin()) {
        openOwnerLogin();
        return;
      }
      deleteResume();
    });
  }

  if (resumeExportBtn) {
    resumeExportBtn.addEventListener("click", function () {
      const stored = getResumeData();
      if (!stored || !stored.data) {
        showToast("Upload a resume first.");
        return;
      }
      const link = document.createElement("a");
      link.href = "data:application/pdf;base64," + stored.data;
      link.download = "resume.pdf";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      showToast("Save as assets/resume.pdf in your project folder.");
    });
  }

  if (ownerLogoutBtn) {
    ownerLogoutBtn.addEventListener("click", function () {
      setAdmin(false);
      closeModal(ownerPanelModal);
      showToast("Locked. Owner tools hidden.");
    });
  }

  if (ownerChangePinBtn) {
    ownerChangePinBtn.addEventListener("click", handleChangePin);
  }

  if (goToCertsBtn) {
    goToCertsBtn.addEventListener("click", function () {
      closeModal(ownerPanelModal);
      const section = document.getElementById("certifications");
      if (section) {
        section.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    });
  }

  if (goToInternBtn) {
    goToInternBtn.addEventListener("click", function () {
      closeModal(ownerPanelModal);
      const section = document.getElementById("experience");
      if (section) {
        section.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    });
  }

  // ——— Internships ———
  function loadInternships() {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.internships);
      internships = raw ? JSON.parse(raw) : [];
    } catch (e) {
      internships = [];
    }
    renderInternships();
  }

  function saveInternships() {
    localStorage.setItem(STORAGE_KEYS.internships, JSON.stringify(internships));
    renderInternships();
    if (expEmptyHint) {
      if (internships.length === 0) {
        expEmptyHint.classList.remove("hidden");
      } else {
        expEmptyHint.classList.add("hidden");
      }
    }
  }

  function setDocFileName(el, doc, cleared) {
    if (!el) return;
    if (cleared) {
      el.textContent = "No file selected";
      return;
    }
    if (doc && doc.fileName) {
      el.textContent = "✓ " + doc.fileName;
    } else {
      el.textContent = "";
    }
  }

  function renderInternships() {
    if (!experienceGrid) return;
    experienceGrid.innerHTML = "";

    internships.forEach(function (item) {
      const achievements = item.achievements || [];
      const skills = item.skills || [];
      const achHtml =
        achievements.length > 0
          ? '<h4 class="exp-achievements-title">Key achievements</h4><ul class="exp-achievements-list">' +
            achievements
              .map(function (a) {
                return "<li>" + escapeHtml(a) + "</li>";
              })
              .join("") +
            "</ul>"
          : "";

      const tagsHtml =
        skills.length > 0
          ? '<ul class="exp-tags">' +
            skills
              .map(function (t) {
                return "<li>" + escapeHtml(t) + "</li>";
              })
              .join("") +
            "</ul>"
          : "";

      let docsHtml = "";
      if (item.offerLetter || item.completionCert) {
        docsHtml = '<div class="exp-documents">';
        if (item.offerLetter) {
          docsHtml +=
            '<button type="button" class="btn btn-sm btn-ghost" data-doc-offer="' +
            item.id +
            '">📄 Offer letter</button>';
        }
        if (item.completionCert) {
          docsHtml +=
            '<button type="button" class="btn btn-sm btn-ghost" data-doc-completion="' +
            item.id +
            '">🏆 Completion certificate</button>';
        }
        docsHtml += "</div>";
      }

      const card = document.createElement("article");
      card.className = "exp-card glass-card reveal visible";
      card.innerHTML =
        '<div class="exp-badge">Internship</div>' +
        "<h3>" +
        escapeHtml(item.title) +
        "</h3>" +
        '<p class="exp-company">' +
        escapeHtml(item.company) +
        "</p>" +
        '<p class="exp-duration">' +
        escapeHtml(item.duration) +
        "</p>" +
        '<p class="exp-desc">' +
        escapeHtml(item.description) +
        "</p>" +
        achHtml +
        tagsHtml +
        docsHtml +
        '<div class="exp-card-actions">' +
        '<button type="button" class="btn-icon" data-intern-edit="' +
        item.id +
        '">Edit</button>' +
        '<button type="button" class="btn-icon danger" data-intern-delete="' +
        item.id +
        '">Remove</button>' +
        "</div>";

      experienceGrid.appendChild(card);
    });

    bindInternCardEvents();
  }

  function bindInternCardEvents() {
    experienceGrid.querySelectorAll("[data-doc-offer]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        const item = internships.find(function (i) {
          return i.id === btn.getAttribute("data-doc-offer");
        });
        if (item && item.offerLetter) viewStoredDoc(item.offerLetter);
      });
    });

    experienceGrid.querySelectorAll("[data-doc-completion]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        const item = internships.find(function (i) {
          return i.id === btn.getAttribute("data-doc-completion");
        });
        if (item && item.completionCert) viewStoredDoc(item.completionCert);
      });
    });

    experienceGrid.querySelectorAll("[data-intern-edit]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        if (!requireAdmin()) return;
        openInternModal(btn.getAttribute("data-intern-edit"));
      });
    });

    experienceGrid.querySelectorAll("[data-intern-delete]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        if (!requireAdmin()) return;
        const id = btn.getAttribute("data-intern-delete");
        if (confirm("Remove this internship?")) {
          internships = internships.filter(function (i) {
            return i.id !== id;
          });
          saveInternships();
          showToast("Internship removed.");
        }
      });
    });
  }

  function openInternModal(editId) {
    if (!requireAdmin()) return;

    internPendingOffer = undefined;
    internPendingCompletion = undefined;
    internForm.reset();
    internEditId.value = "";

    if (editId) {
      const item = internships.find(function (i) {
        return i.id === editId;
      });
      if (!item) return;
      internEditId.value = editId;
      internModalTitle.textContent = "Edit Internship";
      internTitle.value = item.title;
      internCompany.value = item.company;
      internDuration.value = item.duration;
      internDescription.value = item.description;
      internAchievements.value = (item.achievements || []).join("\n");
      internSkills.value = (item.skills || []).join(", ");
      setDocFileName(offerFileName, item.offerLetter, false);
      setDocFileName(completionFileName, item.completionCert, false);
    } else {
      internModalTitle.textContent = "Add Internship";
      setDocFileName(offerFileName, null, true);
      setDocFileName(completionFileName, null, true);
    }

    openModal(internModal);
  }

  function closeInternModal() {
    closeModal(internModal);
  }

  async function handleInternDocFile(file, type) {
    if (!file || !validateDocFile(file)) return;
    try {
      const doc = await fileToStoredDoc(file);
      if (type === "offer") {
        internPendingOffer = doc;
        setDocFileName(offerFileName, doc, false);
      } else {
        internPendingCompletion = doc;
        setDocFileName(completionFileName, doc, false);
      }
      showToast("Document attached.");
    } catch (e) {
      showToast("Could not read file.");
    }
  }

  function setupDocDropzone(dropzone, input, type) {
    if (!dropzone || !input) return;
    dropzone.addEventListener("click", function () {
      input.click();
    });
    input.addEventListener("change", function () {
      handleInternDocFile(input.files && input.files[0], type);
      input.value = "";
    });
  }

  setupDocDropzone(offerDropzone, offerFileInput, "offer");
  setupDocDropzone(completionDropzone, completionFileInput, "completion");

  if (offerClearBtn) {
    offerClearBtn.addEventListener("click", function () {
      internPendingOffer = null;
      setDocFileName(offerFileName, null, true);
      if (offerFileInput) offerFileInput.value = "";
    });
  }

  if (completionClearBtn) {
    completionClearBtn.addEventListener("click", function () {
      internPendingCompletion = null;
      setDocFileName(completionFileName, null, true);
      if (completionFileInput) completionFileInput.value = "";
    });
  }

  if (addInternBtn) {
    addInternBtn.addEventListener("click", function () {
      if (!requireAdmin()) return;
      openInternModal(null);
    });
  }

  if (internModal) {
    internModal.querySelectorAll("[data-close-intern-modal]").forEach(function (el) {
      el.addEventListener("click", closeInternModal);
    });
  }

  if (internForm) {
    internForm.addEventListener("submit", function (e) {
      e.preventDefault();
      if (!requireAdmin()) return;

      const title = internTitle.value.trim();
      const company = internCompany.value.trim();
      const duration = internDuration.value.trim();
      const description = internDescription.value.trim();
      const achievements = parseLines(internAchievements.value);
      const skills = parseTags(internSkills.value);
      const editId = internEditId.value;

      if (!title || !company || !duration || !description) {
        showToast("Please fill in required fields.");
        return;
      }

      const payload = {
        title: title,
        company: company,
        duration: duration,
        description: description,
        achievements: achievements,
        skills: skills,
      };

      if (editId) {
        const item = internships.find(function (i) {
          return i.id === editId;
        });
        if (item) {
          Object.assign(item, payload);
          if (internPendingOffer !== undefined) {
            item.offerLetter = internPendingOffer;
          }
          if (internPendingCompletion !== undefined) {
            item.completionCert = internPendingCompletion;
          }
        }
        showToast("Internship updated!");
      } else {
        internships.push({
          id: generateId("intern"),
          title: payload.title,
          company: payload.company,
          duration: payload.duration,
          description: payload.description,
          achievements: payload.achievements,
          skills: payload.skills,
          offerLetter: internPendingOffer || null,
          completionCert: internPendingCompletion || null,
        });
        showToast("Internship added!");
      }

      saveInternships();
      closeInternModal();
    });
  }

  // ——— Profile ———
  const DEFAULT_PROFILE_SETTINGS = { scale: 1, posX: 50, posY: 50 };

  function normalizeProfile(data) {
    return {
      image: data.image || null,
      scale: typeof data.scale === "number" ? data.scale : 1,
      posX: typeof data.posX === "number" ? data.posX : 50,
      posY: typeof data.posY === "number" ? data.posY : 50,
    };
  }

  function getProfileData() {
    const raw = localStorage.getItem(STORAGE_KEYS.profile);
    if (!raw) return normalizeProfile({ image: null });

    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") {
        return normalizeProfile(parsed);
      }
    } catch (e) {
      /* legacy: plain data URL string */
    }

    if (raw.indexOf("data:image") === 0) {
      return normalizeProfile({ image: raw });
    }

    return normalizeProfile({ image: null });
  }

  function saveProfileData(data) {
    localStorage.setItem(STORAGE_KEYS.profile, JSON.stringify(normalizeProfile(data)));
  }

  function applyProfileToImg(img, data) {
    if (!img || !data || !data.image) return;
    img.src = data.image;
    img.style.objectPosition = data.posX + "% " + data.posY + "%";
    img.style.transform = "scale(" + data.scale + ")";
  }

  function updateProfileVisibility(img, initials, hasImage) {
    if (!img || !initials) return;
    if (hasImage) {
      img.classList.remove("hidden");
      initials.classList.add("hidden");
    } else {
      img.classList.add("hidden");
      initials.classList.remove("hidden");
    }
  }

  function renderProfileEverywhere(data) {
    const hasImage = !!(data && data.image);

    if (profileImage && profileInitials) {
      if (hasImage) {
        applyProfileToImg(profileImage, data);
        updateProfileVisibility(profileImage, profileInitials, true);
      } else {
        profileImage.src = DEFAULT_PROFILE_ASSET;
        profileImage.style.objectPosition = "50% 50%";
        profileImage.style.transform = "scale(1)";
        profileImage.classList.remove("hidden");
        profileInitials.classList.add("hidden");
        profileImage.onerror = function () {
          profileImage.onerror = null;
          updateProfileVisibility(profileImage, profileInitials, false);
        };
      }
    }

    if (profilePreviewImg && profilePreviewInitials) {
      if (hasImage) {
        applyProfileToImg(profilePreviewImg, data);
        updateProfileVisibility(profilePreviewImg, profilePreviewInitials, true);
      } else {
        updateProfileVisibility(profilePreviewImg, profilePreviewInitials, false);
      }
    }
  }

  function syncProfileSlidersFromDraft() {
    if (!profileDraft) return;
    const zoomPct = Math.round(profileDraft.scale * 100);
    if (profileZoom) profileZoom.value = String(zoomPct);
    if (profilePosX) profilePosX.value = String(profileDraft.posX);
    if (profilePosY) profilePosY.value = String(profileDraft.posY);
    if (profileZoomVal) profileZoomVal.textContent = zoomPct + "%";
    if (profilePosXVal) profilePosXVal.textContent = profileDraft.posX + "%";
    if (profilePosYVal) profilePosYVal.textContent = profileDraft.posY + "%";
  }

  function syncDraftFromSliders() {
    if (!profileDraft) profileDraft = normalizeProfile({ image: null });
    profileDraft.scale = profileZoom ? parseInt(profileZoom.value, 10) / 100 : 1;
    profileDraft.posX = profilePosX ? parseInt(profilePosX.value, 10) : 50;
    profileDraft.posY = profilePosY ? parseInt(profilePosY.value, 10) : 50;
    if (profileZoomVal) profileZoomVal.textContent = Math.round(profileDraft.scale * 100) + "%";
    if (profilePosXVal) profilePosXVal.textContent = profileDraft.posX + "%";
    if (profilePosYVal) profilePosYVal.textContent = profileDraft.posY + "%";
    renderProfileEverywhere(profileDraft);
  }

  function openProfileModal() {
    if (!requireAdmin()) return;
    profileDraft = getProfileData();
    syncProfileSlidersFromDraft();
    renderProfileEverywhere(profileDraft);
    if (profileModalInput) profileModalInput.value = "";
    openModal(profileModal);
  }

  function closeProfileModal(revert) {
    closeModal(profileModal);
    if (revert) {
      renderProfileEverywhere(getProfileData());
    }
  }

  function loadProfile() {
    renderProfileEverywhere(getProfileData());
  }

  if (profileUploadWrap) {
    profileUploadWrap.addEventListener("click", function () {
      if (!isAdmin()) return;
      openProfileModal();
    });
  }

  if (openProfileEditorBtn) {
    openProfileEditorBtn.addEventListener("click", function () {
      closeModal(ownerPanelModal);
      openProfileModal();
    });
  }

  if (profileModal) {
    profileModal.querySelectorAll("[data-close-profile-modal]").forEach(function (el) {
      el.addEventListener("click", function () {
        closeProfileModal(true);
      });
    });
  }

  [profileZoom, profilePosX, profilePosY].forEach(function (slider) {
    if (slider) {
      slider.addEventListener("input", syncDraftFromSliders);
    }
  });

  if (profileResetAdjustBtn) {
    profileResetAdjustBtn.addEventListener("click", function () {
      if (!profileDraft) profileDraft = getProfileData();
      profileDraft.scale = 1;
      profileDraft.posX = 50;
      profileDraft.posY = 50;
      syncProfileSlidersFromDraft();
      renderProfileEverywhere(profileDraft);
    });
  }

  if (profileRemoveBtn) {
    profileRemoveBtn.addEventListener("click", function () {
      profileDraft = normalizeProfile({ image: null, scale: 1, posX: 50, posY: 50 });
      syncProfileSlidersFromDraft();
      renderProfileEverywhere(profileDraft);
      showToast("Photo removed. Save to apply, or Cancel to undo.");
    });
  }

  if (profileModalInput) {
    profileModalInput.addEventListener("change", async function () {
      const file = this.files && this.files[0];
      if (!file) return;
      if (!validateImageFile(file)) {
        this.value = "";
        return;
      }
      try {
        const dataUrl = await readFileAsDataURL(file);
        if (!profileDraft) profileDraft = getProfileData();
        profileDraft.image = dataUrl;
        profileDraft.scale = 1;
        profileDraft.posX = 50;
        profileDraft.posY = 50;
        syncProfileSlidersFromDraft();
        renderProfileEverywhere(profileDraft);
        showToast("Photo loaded. Adjust zoom/position, then Save.");
      } catch (e) {
        showToast("Could not load image.");
      }
      this.value = "";
    });
  }

  if (profileSaveBtn) {
    profileSaveBtn.addEventListener("click", function () {
      if (!profileDraft) profileDraft = getProfileData();
      syncDraftFromSliders();
      saveProfileData(profileDraft);
      renderProfileEverywhere(getProfileData());
      closeProfileModal(false);
      showToast("Profile photo saved!");
    });
  }

  // ——— Certificates ———
  function loadCertificates() {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.certs);
      certificates = raw ? JSON.parse(raw) : [];
    } catch (e) {
      certificates = [];
    }
    renderCertificates();
  }

  function saveCertificates() {
    localStorage.setItem(STORAGE_KEYS.certs, JSON.stringify(certificates));
    renderCertificates();
  }

  function renderCertificates() {
    if (!certGrid) return;

    certGrid.innerHTML = "";

    if (certificates.length === 0) {
      certEmptyHint && certEmptyHint.classList.remove("hidden");
      return;
    }

    certEmptyHint && certEmptyHint.classList.add("hidden");

    const admin = isAdmin();

    certificates.forEach(function (cert) {
      const card = document.createElement("article");
      card.className = "cert-card glass-card reveal visible";

      let imageHtml;
      if (cert.image) {
        imageHtml = '<img src="' + cert.image + '" alt="' + escapeHtml(cert.title) + '" />';
      } else if (admin) {
        imageHtml =
          '<button type="button" class="cert-card-placeholder owner-only" data-upload="' + cert.id + '">' +
          '<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>' +
          '<span>Upload image</span></button>';
      } else {
        imageHtml = '<div class="cert-no-image">Certificate</div>';
      }

      card.innerHTML =
        '<div class="cert-card-image-wrap" data-view="' + cert.id + '">' +
          imageHtml +
        '</div>' +
        '<div class="cert-card-body">' +
          '<h3>' + escapeHtml(cert.title) + '</h3>' +
          '<p>' + escapeHtml(cert.issuer) + ' · ' + escapeHtml(cert.year) + '</p>' +
          '<div class="cert-card-actions">' +
            '<button type="button" class="btn-icon" data-edit="' + cert.id + '">Edit</button>' +
            '<button type="button" class="btn-icon danger" data-delete="' + cert.id + '">Remove</button>' +
          '</div>' +
        '</div>';

      certGrid.appendChild(card);
    });

    bindCertCardEvents();
  }

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  function bindCertCardEvents() {
    certGrid.querySelectorAll("[data-view]").forEach(function (el) {
      const id = el.getAttribute("data-view");
      const cert = certificates.find(function (c) {
        return c.id === id;
      });
      if (cert && cert.image) {
        el.addEventListener("click", function () {
          openLightbox(cert.image);
        });
      }
    });

    certGrid.querySelectorAll("[data-upload]").forEach(function (btn) {
      btn.addEventListener("click", function (e) {
        e.stopPropagation();
        if (!requireAdmin()) return;
        openCertModal(btn.getAttribute("data-upload"));
      });
    });

    certGrid.querySelectorAll("[data-edit]").forEach(function (btn) {
      btn.addEventListener("click", function (e) {
        e.stopPropagation();
        if (!requireAdmin()) return;
        openCertModal(btn.getAttribute("data-edit"));
      });
    });

    certGrid.querySelectorAll("[data-delete]").forEach(function (btn) {
      btn.addEventListener("click", function (e) {
        e.stopPropagation();
        if (!requireAdmin()) return;
        const id = btn.getAttribute("data-delete");
        if (confirm("Remove this certificate?")) {
          certificates = certificates.filter(function (c) {
            return c.id !== id;
          });
          saveCertificates();
          showToast("Certificate removed.");
        }
      });
    });
  }

  function openCertModal(editId) {
    if (!requireAdmin()) return;

    certPendingImage = null;
    certForm.reset();
    certPreview.classList.add("hidden");
    certDropzoneInner.classList.remove("hidden");
    certFileInput.value = "";

    if (editId) {
      const cert = certificates.find(function (c) {
        return c.id === editId;
      });
      if (!cert) return;
      certEditId.value = editId;
      certModalTitle.textContent = "Edit Certificate";
      certTitle.value = cert.title;
      certIssuer.value = cert.issuer;
      certYear.value = cert.year;
      if (cert.image) {
        certPendingImage = cert.image;
        certPreview.src = cert.image;
        certPreview.classList.remove("hidden");
        certDropzoneInner.classList.add("hidden");
      }
    } else {
      certEditId.value = "";
      certModalTitle.textContent = "Add Certificate";
    }

    certModal.classList.add("open");
    certModal.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
  }

  function closeCertModal() {
    certModal.classList.remove("open");
    certModal.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
  }

  function setCertPreview(dataUrl) {
    certPendingImage = dataUrl;
    certPreview.src = dataUrl;
    certPreview.classList.remove("hidden");
    certDropzoneInner.classList.add("hidden");
  }

  async function handleCertFile(file) {
    if (!file) return;
    if (!validateImageFile(file)) return;
    try {
      const dataUrl = await readFileAsDataURL(file);
      setCertPreview(dataUrl);
    } catch (e) {
      showToast("Could not read image.");
    }
  }

  if (addCertBtn) {
    addCertBtn.addEventListener("click", function () {
      if (!requireAdmin()) return;
      openCertModal(null);
    });
  }

  if (certModal) {
    certModal.querySelectorAll("[data-close-modal]").forEach(function (el) {
      el.addEventListener("click", closeCertModal);
    });
  }

  if (certDropzone && certFileInput) {
    certDropzone.addEventListener("click", function () {
      certFileInput.click();
    });

    certFileInput.addEventListener("change", function () {
      handleCertFile(this.files && this.files[0]);
      this.value = "";
    });

    certDropzone.addEventListener("dragover", function (e) {
      e.preventDefault();
      certDropzone.classList.add("dragover");
    });

    certDropzone.addEventListener("dragleave", function () {
      certDropzone.classList.remove("dragover");
    });

    certDropzone.addEventListener("drop", function (e) {
      e.preventDefault();
      certDropzone.classList.remove("dragover");
      const file = e.dataTransfer.files && e.dataTransfer.files[0];
      handleCertFile(file);
    });
  }

  if (certForm) certForm.addEventListener("submit", function (e) {
    e.preventDefault();
    if (!requireAdmin()) return;

    const title = certTitle.value.trim();
    const issuer = certIssuer.value.trim();
    const year = certYear.value.trim();
    const editId = certEditId.value;

    if (!title || !issuer || !year) {
      showToast("Please fill in all fields.");
      return;
    }

    if (!editId && !certPendingImage) {
      showToast("Please upload a certificate image.");
      return;
    }

    if (editId) {
      const cert = certificates.find(function (c) {
        return c.id === editId;
      });
      if (cert) {
        cert.title = title;
        cert.issuer = issuer;
        cert.year = year;
        if (certPendingImage) cert.image = certPendingImage;
      }
      showToast("Certificate updated!");
    } else {
      certificates.push({
        id: generateId("cert"),
        title: title,
        issuer: issuer,
        year: year,
        image: certPendingImage,
      });
      showToast("Certificate added!");
    }

    saveCertificates();
    closeCertModal();
  });

  function openLightbox(src) {
    if (!lightbox || !lightboxImg) return;
    lightboxImg.src = src;
    lightbox.classList.add("open");
    lightbox.setAttribute("aria-hidden", "false");
  }

  function closeLightbox() {
    if (!lightbox || !lightboxImg) return;
    lightbox.classList.remove("open");
    lightbox.setAttribute("aria-hidden", "true");
    lightboxImg.src = "";
  }

  if (lightboxClose && lightbox) {
    lightboxClose.addEventListener("click", closeLightbox);
    lightbox.addEventListener("click", function (e) {
      if (e.target === lightbox) closeLightbox();
    });
  }

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") {
      closeCertModal();
      closeInternModal();
      closeProfileModal(true);
      closeLightbox();
      closeModal(ownerLoginModal);
      closeModal(ownerPanelModal);
    }
  });

  // ——— Footer year ———
  if (yearEl) {
    yearEl.textContent = new Date().getFullYear();
  }

  // ——— Header scroll ———
  function onScroll() {
    if (window.scrollY > 40) {
      header.classList.add("scrolled");
    } else {
      header.classList.remove("scrolled");
    }
    updateActiveNav();
  }

  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  // ——— Mobile nav ———
  if (navToggle && navLinks) {
    navToggle.addEventListener("click", function () {
      const isOpen = navLinks.classList.toggle("open");
      navToggle.classList.toggle("active", isOpen);
      navToggle.setAttribute("aria-expanded", String(isOpen));
    });

    navLinks.querySelectorAll("a").forEach(function (link) {
      link.addEventListener("click", function () {
        navLinks.classList.remove("open");
        navToggle.classList.remove("active");
        navToggle.setAttribute("aria-expanded", "false");
      });
    });
  }

  function updateActiveNav() {
    const scrollPos = window.scrollY + 120;
    let current = "";

    sections.forEach(function (section) {
      const top = section.offsetTop;
      const height = section.offsetHeight;
      if (scrollPos >= top && scrollPos < top + height) {
        current = section.getAttribute("id");
      }
    });

    navAnchors.forEach(function (anchor) {
      anchor.classList.remove("active");
      if (anchor.getAttribute("href") === "#" + current) {
        anchor.classList.add("active");
      }
    });
  }

  // ——— Scroll reveal ———
  const revealObserver = new IntersectionObserver(
    function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add("visible");
          revealObserver.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.12, rootMargin: "0px 0px -40px 0px" }
  );

  revealEls.forEach(function (el) {
    revealObserver.observe(el);
  });

  // ——— Skill bars ———
  function observeSkillBars() {
    if (!skillObserver) {
      skillObserver = new IntersectionObserver(
        function (entries) {
          entries.forEach(function (entry) {
            if (!entry.isIntersecting) return;
            const card = entry.target;
            const level = card.getAttribute("data-level");
            const fill = card.querySelector(".progress-fill");
            if (fill && level) {
              fill.style.width = level + "%";
              card.classList.add("animated");
            }
            skillObserver.unobserve(card);
          });
        },
        { threshold: 0.3 }
      );
    }
    document.querySelectorAll(".skill-card[data-level]").forEach(function (card) {
      skillObserver.observe(card);
    });
  }

  observeSkillBars();

  // ——— Smooth scroll ———
  document.querySelectorAll('a[href^="#"]').forEach(function (anchor) {
    anchor.addEventListener("click", function (e) {
      const id = this.getAttribute("href");
      if (id === "#" || !id) return;
      const target = document.querySelector(id);
      if (!target) return;
      e.preventDefault();
      target.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });

  // Init
  loadProfile();
  loadCertificates();
  loadInternships();
  checkStaticResume();
  updateResumeUI();
  updateAdminUI();

  window.PortfolioApp = {
    isAdmin: isAdmin,
    requireAdmin: requireAdmin,
    showToast: showToast,
    openModal: openModal,
    closeModal: closeModal,
    openOwnerLogin: openOwnerLogin,
    openOwnerPanel: openOwnerPanel,
    setAdmin: setAdmin,
    generateId: generateId,
    escapeHtml: function (str) {
      const div = document.createElement("div");
      div.textContent = str;
      return div.innerHTML;
    },
    parseLines: parseLines,
    parseTags: parseTags,
    observeSkillBars: observeSkillBars,
  };
})();

