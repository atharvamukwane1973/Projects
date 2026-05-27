(function () {
  "use strict";

  const app = window.PortfolioApp;
  if (!app) return;

  const KEYS = {
    hero: "portfolio_hero",
    about: "portfolio_about",
    skills: "portfolio_skills",
    projects: "portfolio_projects",
    education: "portfolio_education",
    contact: "portfolio_contact",
  };

  const ICONS = {
    zap: "⚡",
    chart: "📈",
    search: "🔍",
    robot: "🤖",
    code: "💻",
    git: "⌨",
    design: "🎨",
    office: "📊",
    game: "🎮",
    book: "📚",
    web: "🌐",
    star: "✨",
    mail: "✉",
    phone: "📱",
    linkedin: "in",
    github: "⌘",
    whatsapp: "💬",
    rocket: "🚀",
    mobile: "📱",
    chat: "💬",
    ai: "🤖",
    data: "📊",
    music: "🎵",
    shop: "🛒",
  };

  const PROJECT_EMOJIS = [
    "🚀", "💻", "🎮", "📚", "🌐", "✨", "🤖", "📱", "💬", "🎨",
    "⚡", "🔥", "💡", "🛠", "📊", "🎵", "🛒", "📷", "🏆", "💼",
    "🐍", "☕", "🧠", "🔐", "📧", "🎯", "🌟", "💎", "🦾", "📝",
  ];

  const DEFAULTS = {
    hero: {
      greeting: "Hello, I'm",
      name: "Atharva Mukwane",
      title: "Computer Engineering Student | Python Learner | Tech Enthusiast",
      intro:
        "I am a first-year engineering student passionate about coding, AI, and building projects while continuously improving my skills.",
    },
    about: {
      paragraphs: [
        "I'm a first-year Computer Engineering student on a journey to master programming and software development. I actively seek internships and hands-on experience to apply what I learn in the classroom to real-world problems. My curiosity drives me toward artificial intelligence, automation, and building tools that make learning and daily life easier.",
        "Whether it's debugging Python scripts, designing responsive web pages, or exploring new frameworks, I stay consistent and push myself to grow a little every day.",
      ],
      strengths: [
        { icon: "zap", text: "Quick learner" },
        { icon: "chart", text: "Consistent" },
        { icon: "search", text: "Curious about technology" },
        { icon: "robot", text: "Interested in AI and development" },
      ],
    },
    skills: {
      subtitle: "Technologies and tools I'm learning and using",
      programming: [
        { name: "Python", level: 85, badge: "" },
        { name: "HTML", level: 80, badge: "" },
        { name: "CSS", level: 75, badge: "" },
        { name: "JavaScript", level: 45, badge: "Beginner" },
        { name: "SQL", level: 35, badge: "Learning" },
      ],
      tools: [
        { icon: "git", name: "GitHub" },
        { icon: "code", name: "VS Code / Cursor" },
        { icon: "design", name: "Canva" },
        { icon: "office", name: "MS Office" },
      ],
    },
    projects: {
      subtitle: "Things I've built and am building",
      items: [
        {
          id: "proj_1",
          icon: "game",
          title: "Hangman Game",
          tech: "Python",
          desc: "A classic word-guessing game built with Python, featuring random word selection and score tracking.",
          github: "https://github.com/atharvamukwane1973",
          demo: "#",
        },
        {
          id: "proj_2",
          icon: "book",
          title: "AI Study Buddy",
          tech: "Python · AI",
          desc: "An AI-assisted study companion to help organize notes, answer questions, and support learning sessions.",
          github: "https://github.com/atharvamukwane1973",
          demo: "#",
        },
        {
          id: "proj_3",
          icon: "web",
          title: "Portfolio Website",
          tech: "HTML · CSS · JavaScript",
          desc: "This responsive personal portfolio showcasing my skills, projects, and journey as an engineering student.",
          github: "https://github.com/atharvamukwane1973",
          demo: "#hero",
        },
      ],
    },
    education: {
      status: "First Year Completed",
      degree: "Bachelor of Engineering — Computer Engineering",
      college: "[Your College Name]",
      year: "2024 – Present",
      courses: [
        "Programming Fundamentals",
        "Engineering Mathematics",
        "Physics & Chemistry",
        "Data Structures (In Progress)",
        "Digital Logic / Electronics Basics",
        "Communication Skills",
      ],
    },
    contact: {
      subtitle: "Open to internships, collaborations, and learning opportunities",
      items: [
        { type: "email", label: "Email", value: "atharvamukwane887@gmail.com", link: "mailto:atharvamukwane887@gmail.com" },
        {
          type: "linkedin",
          label: "LinkedIn",
          value: "linkedin.com/in/atharva-mukwane-634239377",
          link: "https://linkedin.com/in/atharva-mukwane-634239377",
        },
        {
          type: "github",
          label: "GitHub",
          value: "github.com/atharvamukwane1973",
          link: "https://github.com/atharvamukwane1973",
        },
        { type: "phone", label: "Phone", value: "+91 8087132935", link: "" },
      ],
    },
  };

  function load(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      if (raw) return JSON.parse(raw);
    } catch (e) {}
    return JSON.parse(JSON.stringify(fallback));
  }

  function save(key, data) {
    localStorage.setItem(key, JSON.stringify(data));
  }

  function icon(key) {
    if (!key) return "✦";
    if (ICONS[key]) return ICONS[key];
    return key;
  }

  function whatsAppLink(number, message) {
    if (!number) return "";
    const digits = String(number).replace(/\D/g, "");
    if (!digits) return "";
    let url = "https://wa.me/" + digits;
    if (message && message.trim()) {
      url += "?text=" + encodeURIComponent(message.trim());
    }
    return url;
  }

  function buildProjectLinks(p) {
    let html = '<div class="project-links">';
    if (p.github && p.github !== "#") {
      html +=
        '<a href="' +
        esc(p.github) +
        '" target="_blank" rel="noopener noreferrer" class="btn btn-sm btn-ghost">GitHub</a>';
    }
    if (p.demo && p.demo !== "#") {
      html += '<a href="' + esc(p.demo) + '" class="btn btn-sm btn-primary">Live Demo</a>';
    }
    const wa = whatsAppLink(p.whatsapp, p.whatsappMessage);
    if (wa) {
      html +=
        '<a href="' +
        esc(wa) +
        '" target="_blank" rel="noopener noreferrer" class="btn btn-sm btn-whatsapp">💬 WhatsApp</a>';
    }
    html += "</div>";
    return html;
  }

  function initEmojiPicker() {
    const picker = document.getElementById("projEmojiPicker");
    const input = document.getElementById("editProjIcon");
    const preview = document.getElementById("projIconPreview");
    if (!picker || !input) return;

    picker.innerHTML = PROJECT_EMOJIS.map(function (em) {
      return (
        '<button type="button" class="emoji-btn" data-emoji="' +
        em +
        '" aria-label="Icon ' +
        em +
        '">' +
        em +
        "</button>"
      );
    }).join("");

    function setIcon(val) {
      input.value = val;
      if (preview) preview.textContent = icon(val);
      picker.querySelectorAll(".emoji-btn").forEach(function (btn) {
        btn.classList.toggle("selected", btn.getAttribute("data-emoji") === val || icon(btn.getAttribute("data-emoji")) === icon(val));
      });
    }

    picker.querySelectorAll(".emoji-btn").forEach(function (btn) {
      btn.addEventListener("click", function () {
        setIcon(btn.getAttribute("data-emoji"));
      });
    });

    input.addEventListener("input", function () {
      if (preview) preview.textContent = icon(input.value.trim()) || "✦";
    });

    window.PortfolioContent.setProjectIcon = setIcon;
  }

  function esc(s) {
    return app.escapeHtml(s || "");
  }

  function observeSkills() {
    if (app.observeSkillBars) app.observeSkillBars();
  }

  // ——— Render ———
  function renderHero() {
    const d = load(KEYS.hero, DEFAULTS.hero);
    const g = document.getElementById("heroGreeting");
    const n = document.getElementById("heroName");
    const t = document.getElementById("heroTitle");
    const i = document.getElementById("heroIntro");
    if (g) g.textContent = d.greeting;
    if (n) n.textContent = d.name;
    if (t) t.textContent = d.title;
    if (i) i.textContent = d.intro;
  }

  function renderAbout() {
    const d = load(KEYS.about, DEFAULTS.about);
    const textEl = document.getElementById("aboutText");
    const listEl = document.getElementById("strengthList");
    if (textEl) {
      textEl.innerHTML = d.paragraphs.map(function (p) {
        return "<p>" + esc(p) + "</p>";
      }).join("");
    }
    if (listEl) {
      listEl.innerHTML = d.strengths
        .map(function (s) {
          return (
            '<li class="strength-item"><span class="strength-icon">' +
            icon(s.icon) +
            '</span><span>' +
            esc(s.text) +
            "</span></li>"
          );
        })
        .join("");
    }
  }

  function renderSkills() {
    const d = load(KEYS.skills, DEFAULTS.skills);
    const sub = document.getElementById("skillsSubtitle");
    const grid = document.getElementById("skillsGrid");
    const tools = document.getElementById("toolsGrid");
    if (sub) sub.textContent = d.subtitle;
    if (grid) {
      grid.innerHTML = d.programming
        .map(function (s) {
          const badge = s.badge
            ? '<span class="skill-badge">' + esc(s.badge) + "</span>"
            : '<span class="skill-level">' + s.level + "%</span>";
          return (
            '<div class="skill-card glass-card" data-level="' +
            s.level +
            '"><div class="skill-header"><span>' +
            esc(s.name) +
            "</span>" +
            badge +
            '</div><div class="progress-bar"><div class="progress-fill"></div></div></div>'
          );
        })
        .join("");
    }
    if (tools) {
      tools.innerHTML = d.tools
        .map(function (t) {
          return (
            '<div class="tool-card glass-card"><span class="tool-icon">' +
            icon(t.icon) +
            "</span><span>" +
            esc(t.name) +
            "</span></div>"
          );
        })
        .join("");
    }
    observeSkills();
  }

  function renderProjects() {
    const d = load(KEYS.projects, DEFAULTS.projects);
    const sub = document.getElementById("projectsSubtitle");
    const grid = document.getElementById("projectsGrid");
    const empty = document.getElementById("projectsEmptyHint");
    if (sub) sub.textContent = d.subtitle;
    if (!grid) return;
    if (!d.items.length) {
      grid.innerHTML = "";
      if (empty) empty.classList.remove("hidden");
      return;
    }
    if (empty) empty.classList.add("hidden");
    grid.innerHTML = d.items
      .map(function (p, idx) {
        return (
          '<article class="project-card glass-card reveal visible anim-float-card" style="animation-delay:' +
          idx * 0.08 +
          's">' +
          '<div class="project-icon">' +
          icon(p.icon) +
          "</div>" +
          "<h3>" +
          esc(p.title) +
          "</h3>" +
          '<p class="project-tech">' +
          esc(p.tech) +
          "</p>" +
          '<p class="project-desc">' +
          esc(p.desc) +
          "</p>" +
          buildProjectLinks(p) +
          (app.isAdmin()
            ? '<div class="exp-card-actions"><button type="button" class="btn-icon" data-proj-edit="' +
              p.id +
              '">Edit</button><button type="button" class="btn-icon danger" data-proj-delete="' +
              p.id +
              '">Remove</button></div>'
            : "") +
          "</article>"
        );
      })
      .join("");
    bindProjectEvents();
  }

  function bindProjectEvents() {
    const grid = document.getElementById("projectsGrid");
    if (!grid) return;
    grid.querySelectorAll("[data-proj-edit]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        if (!app.requireAdmin()) return;
        openProjectModal(btn.getAttribute("data-proj-edit"));
      });
    });
    grid.querySelectorAll("[data-proj-delete]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        if (!app.requireAdmin()) return;
        if (!confirm("Remove this project?")) return;
        const d = load(KEYS.projects, DEFAULTS.projects);
        d.items = d.items.filter(function (p) {
          return p.id !== btn.getAttribute("data-proj-delete");
        });
        save(KEYS.projects, d);
        renderProjects();
        app.showToast("Project removed.");
      });
    });
  }

  function renderEducation() {
    const d = load(KEYS.education, DEFAULTS.education);
    const card = document.getElementById("educationCard");
    if (!card) return;
    card.innerHTML =
      '<div class="edu-status">' +
      esc(d.status) +
      "</div>" +
      "<h3>" +
      esc(d.degree) +
      "</h3>" +
      '<p class="edu-college">' +
      esc(d.college) +
      "</p>" +
      '<p class="edu-year">' +
      esc(d.year) +
      "</p>" +
      "<h4>Relevant Coursework</h4>" +
      '<ul class="edu-courses">' +
      d.courses
        .map(function (c) {
          return "<li>" + esc(c) + "</li>";
        })
        .join("") +
      "</ul>" +
      (app.isAdmin()
        ? '<div class="exp-card-actions"><button type="button" class="btn-icon" id="editEducationBtn">Edit education</button></div>'
        : "");
    const editBtn = document.getElementById("editEducationBtn");
    if (editBtn) editBtn.addEventListener("click", openEducationModal);
  }

  function renderContact() {
    const d = load(KEYS.contact, DEFAULTS.contact);
    const sub = document.getElementById("contactSubtitle");
    const grid = document.getElementById("contactGrid");
    if (sub) sub.textContent = d.subtitle;
    if (!grid) return;
    const iconMap = { email: "mail", linkedin: "linkedin", github: "github", phone: "phone" };
    grid.innerHTML =
      d.items
        .map(function (c) {
          const ic = iconMap[c.type] || "mail";
          if (c.type === "phone" || !c.link) {
            return (
              '<div class="contact-card glass-card contact-static">' +
              '<span class="contact-icon">' +
              icon(ic) +
              '</span><span class="contact-label">' +
              esc(c.label) +
              '</span><span class="contact-value">' +
              esc(c.value) +
              "</span></div>"
            );
          }
          return (
            '<a href="' +
            esc(c.link) +
            '" target="_blank" rel="noopener noreferrer" class="contact-card glass-card">' +
            '<span class="contact-icon">' +
            icon(ic) +
            '</span><span class="contact-label">' +
            esc(c.label) +
            '</span><span class="contact-value">' +
            esc(c.value) +
            "</span></a>"
          );
        })
        .join("") +
      (app.isAdmin()
        ? '<div class="contact-card glass-card contact-static owner-edit-card"><button type="button" class="btn btn-outline btn-sm" id="editContactBtn">Edit contact info</button></div>'
        : "");
    const editBtn = document.getElementById("editContactBtn");
    if (editBtn) editBtn.addEventListener("click", openContactModal);
  }

  function renderAll() {
    renderHero();
    renderAbout();
    renderSkills();
    renderProjects();
    renderEducation();
    renderContact();
  }

  window.PortfolioContent = {
    renderAll: renderAll,
    openHeroModal: openHeroModal,
    openAboutModal: openAboutModal,
    openSkillsModal: openSkillsModal,
    openProjectModal: openProjectModal,
    openEducationModal: openEducationModal,
    openContactModal: openContactModal,
  };

  // ——— Modals ———
  const heroModal = document.getElementById("heroModal");
  const aboutModal = document.getElementById("aboutModal");
  const skillsModal = document.getElementById("skillsModal");
  const projectModal = document.getElementById("projectModal");
  const educationModal = document.getElementById("educationModal");
  const contactModal = document.getElementById("contactModal");

  function bindClose(modal, attr) {
    if (!modal) return;
    modal.querySelectorAll("[" + attr + "]").forEach(function (el) {
      el.addEventListener("click", function () {
        app.closeModal(modal);
      });
    });
  }

  bindClose(heroModal, "data-close-hero");
  bindClose(aboutModal, "data-close-about");
  bindClose(skillsModal, "data-close-skills");
  bindClose(projectModal, "data-close-project");
  bindClose(educationModal, "data-close-education");
  bindClose(contactModal, "data-close-contact");

  function openHeroModal() {
    if (!app.requireAdmin()) return;
    const d = load(KEYS.hero, DEFAULTS.hero);
    document.getElementById("editHeroGreeting").value = d.greeting;
    document.getElementById("editHeroName").value = d.name;
    document.getElementById("editHeroTitle").value = d.title;
    document.getElementById("editHeroIntro").value = d.intro;
    app.openModal(heroModal);
  }

  document.getElementById("heroForm") &&
    document.getElementById("heroForm").addEventListener("submit", function (e) {
      e.preventDefault();
      save(KEYS.hero, {
        greeting: document.getElementById("editHeroGreeting").value.trim(),
        name: document.getElementById("editHeroName").value.trim(),
        title: document.getElementById("editHeroTitle").value.trim(),
        intro: document.getElementById("editHeroIntro").value.trim(),
      });
      renderHero();
      app.closeModal(heroModal);
      app.showToast("Hero section saved.");
    });

  function openAboutModal() {
    if (!app.requireAdmin()) return;
    const d = load(KEYS.about, DEFAULTS.about);
    document.getElementById("editAboutParagraphs").value = d.paragraphs.join("\n\n");
    document.getElementById("editAboutStrengths").value = d.strengths
      .map(function (s) {
        return s.icon + "|" + s.text;
      })
      .join("\n");
    app.openModal(aboutModal);
  }

  document.getElementById("aboutForm") &&
    document.getElementById("aboutForm").addEventListener("submit", function (e) {
      e.preventDefault();
      const strengths = app
        .parseLines(document.getElementById("editAboutStrengths").value)
        .map(function (line) {
          const parts = line.split("|");
          return { icon: (parts[0] || "zap").trim(), text: (parts[1] || parts[0] || "").trim() };
        })
        .filter(function (s) {
          return s.text;
        });
      save(KEYS.about, {
        paragraphs: document
          .getElementById("editAboutParagraphs")
          .value.split("\n\n")
          .map(function (p) {
            return p.trim();
          })
          .filter(Boolean),
        strengths: strengths,
      });
      renderAbout();
      app.closeModal(aboutModal);
      app.showToast("About section saved.");
    });

  function openSkillsModal() {
    if (!app.requireAdmin()) return;
    const d = load(KEYS.skills, DEFAULTS.skills);
    document.getElementById("editSkillsSubtitle").value = d.subtitle;
    document.getElementById("editSkillsProgramming").value = d.programming
      .map(function (s) {
        return s.name + "|" + s.level + "|" + (s.badge || "");
      })
      .join("\n");
    document.getElementById("editSkillsTools").value = d.tools
      .map(function (t) {
        return t.icon + "|" + t.name;
      })
      .join("\n");
    app.openModal(skillsModal);
  }

  document.getElementById("skillsForm") &&
    document.getElementById("skillsForm").addEventListener("submit", function (e) {
      e.preventDefault();
      const programming = app
        .parseLines(document.getElementById("editSkillsProgramming").value)
        .map(function (line) {
          const p = line.split("|");
          return {
            name: p[0].trim(),
            level: parseInt(p[1], 10) || 50,
            badge: (p[2] || "").trim(),
          };
        })
        .filter(function (s) {
          return s.name;
        });
      const tools = app
        .parseLines(document.getElementById("editSkillsTools").value)
        .map(function (line) {
          const p = line.split("|");
          return { icon: (p[0] || "code").trim(), name: (p[1] || p[0] || "").trim() };
        })
        .filter(function (t) {
          return t.name;
        });
      save(KEYS.skills, {
        subtitle: document.getElementById("editSkillsSubtitle").value.trim(),
        programming: programming,
        tools: tools,
      });
      renderSkills();
      app.closeModal(skillsModal);
      app.showToast("Skills saved.");
    });

  let projectEditId = "";

  function openProjectModal(id) {
    if (!app.requireAdmin()) return;
    projectEditId = id || "";
    const d = load(KEYS.projects, DEFAULTS.projects);
    const p = id ? d.items.find(function (x) {
      return x.id === id;
    }) : null;
    document.getElementById("projectModalTitle").textContent = p ? "Edit Project" : "Add Project";
    const iconVal = p ? p.icon : "star";
    document.getElementById("editProjIcon").value = iconVal;
    if (window.PortfolioContent.setProjectIcon) {
      window.PortfolioContent.setProjectIcon(iconVal);
    }
    document.getElementById("editProjTitle").value = p ? p.title : "";
    document.getElementById("editProjTech").value = p ? p.tech : "";
    document.getElementById("editProjDesc").value = p ? p.desc : "";
    document.getElementById("editProjGithub").value = p ? p.github || "" : "";
    document.getElementById("editProjDemo").value = p ? p.demo || "" : "";
    document.getElementById("editProjWhatsapp").value = p ? p.whatsapp || "" : "";
    document.getElementById("editProjWhatsappMsg").value = p ? p.whatsappMessage || "" : "";
    app.openModal(projectModal);
  }

  document.getElementById("projectForm") &&
    document.getElementById("projectForm").addEventListener("submit", function (e) {
      e.preventDefault();
      const d = load(KEYS.projects, DEFAULTS.projects);
      const item = {
        id: projectEditId || app.generateId("proj"),
        icon: document.getElementById("editProjIcon").value.trim() || "star",
        title: document.getElementById("editProjTitle").value.trim(),
        tech: document.getElementById("editProjTech").value.trim(),
        desc: document.getElementById("editProjDesc").value.trim(),
        github: document.getElementById("editProjGithub").value.trim(),
        demo: document.getElementById("editProjDemo").value.trim(),
        whatsapp: document.getElementById("editProjWhatsapp").value.trim(),
        whatsappMessage: document.getElementById("editProjWhatsappMsg").value.trim(),
      };
      if (projectEditId) {
        const idx = d.items.findIndex(function (x) {
          return x.id === projectEditId;
        });
        if (idx >= 0) d.items[idx] = item;
      } else {
        d.items.push(item);
      }
      save(KEYS.projects, d);
      renderProjects();
      app.closeModal(projectModal);
      app.showToast("Project saved.");
    });

  function openEducationModal() {
    if (!app.requireAdmin()) return;
    const d = load(KEYS.education, DEFAULTS.education);
    document.getElementById("editEduStatus").value = d.status;
    document.getElementById("editEduDegree").value = d.degree;
    document.getElementById("editEduCollege").value = d.college;
    document.getElementById("editEduYear").value = d.year;
    document.getElementById("editEduCourses").value = d.courses.join("\n");
    app.openModal(educationModal);
  }

  document.getElementById("educationForm") &&
    document.getElementById("educationForm").addEventListener("submit", function (e) {
      e.preventDefault();
      save(KEYS.education, {
        status: document.getElementById("editEduStatus").value.trim(),
        degree: document.getElementById("editEduDegree").value.trim(),
        college: document.getElementById("editEduCollege").value.trim(),
        year: document.getElementById("editEduYear").value.trim(),
        courses: app.parseLines(document.getElementById("editEduCourses").value),
      });
      renderEducation();
      app.closeModal(educationModal);
      app.showToast("Education saved.");
    });

  function openContactModal() {
    if (!app.requireAdmin()) return;
    const d = load(KEYS.contact, DEFAULTS.contact);
    document.getElementById("editContactSubtitle").value = d.subtitle;
    document.getElementById("editContactItems").value = d.items
      .map(function (c) {
        return c.type + "|" + c.label + "|" + c.value + "|" + (c.link || "");
      })
      .join("\n");
    app.openModal(contactModal);
  }

  document.getElementById("contactForm") &&
    document.getElementById("contactForm").addEventListener("submit", function (e) {
      e.preventDefault();
      const items = app
        .parseLines(document.getElementById("editContactItems").value)
        .map(function (line) {
          const p = line.split("|");
          return {
            type: (p[0] || "email").trim(),
            label: (p[1] || "").trim(),
            value: (p[2] || "").trim(),
            link: (p[3] || "").trim(),
          };
        })
        .filter(function (c) {
          return c.label && c.value;
        });
      save(KEYS.contact, {
        subtitle: document.getElementById("editContactSubtitle").value.trim(),
        items: items,
      });
      renderContact();
      app.closeModal(contactModal);
      app.showToast("Contact saved.");
    });

  document.getElementById("addProjectBtn") &&
    document.getElementById("addProjectBtn").addEventListener("click", function () {
      if (!app.requireAdmin()) return;
      openProjectModal(null);
    });

  document.getElementById("hubEditHero") &&
    document.getElementById("hubEditHero").addEventListener("click", function () {
      app.closeModal(document.getElementById("ownerPanelModal"));
      openHeroModal();
    });
  document.getElementById("hubEditAbout") &&
    document.getElementById("hubEditAbout").addEventListener("click", function () {
      app.closeModal(document.getElementById("ownerPanelModal"));
      openAboutModal();
    });
  document.getElementById("hubEditSkills") &&
    document.getElementById("hubEditSkills").addEventListener("click", function () {
      app.closeModal(document.getElementById("ownerPanelModal"));
      openSkillsModal();
    });
  document.getElementById("hubEditProjects") &&
    document.getElementById("hubEditProjects").addEventListener("click", function () {
      app.closeModal(document.getElementById("ownerPanelModal"));
      openProjectModal(null);
    });
  document.getElementById("hubEditEducation") &&
    document.getElementById("hubEditEducation").addEventListener("click", function () {
      app.closeModal(document.getElementById("ownerPanelModal"));
      openEducationModal();
    });
  document.getElementById("hubEditContact") &&
    document.getElementById("hubEditContact").addEventListener("click", function () {
      app.closeModal(document.getElementById("ownerPanelModal"));
      openContactModal();
    });

  document.getElementById("editAboutSectionBtn") &&
    document.getElementById("editAboutSectionBtn").addEventListener("click", openAboutModal);
  document.getElementById("editSkillsSectionBtn") &&
    document.getElementById("editSkillsSectionBtn").addEventListener("click", openSkillsModal);

  initEmojiPicker();
  renderAll();
})();
