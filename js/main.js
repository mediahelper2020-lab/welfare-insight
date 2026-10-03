/* =========================================================
   복지인사이트 전문교육 — Interactions
   ========================================================= */
(() => {
  "use strict";

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const icon = (id) => `<svg aria-hidden="true"><use href="#i-${id}"/></svg>`;
  const pad = (n) => String(n).padStart(2, "0");
  const trackOf = (id) => TRACKS.find((t) => t.id === id);
  const courseOf = (no) => COURSES.find((c) => c.no === Number(no));

  /* ---------- Toast ---------- */
  const toastEl = $("#toast");
  let toastTimer;
  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove("show"), 2600);
  }

  /* ---------- Header / nav ---------- */
  const header = $(".site-header");
  const nav = $("#mainNav");
  const navToggle = $("#navToggle");

  function setNav(open) {
    nav.classList.toggle("open", open);
    navToggle.setAttribute("aria-expanded", String(open));
    navToggle.setAttribute("aria-label", open ? "메뉴 닫기" : "메뉴 열기");
    document.body.classList.toggle("modal-open", open);
  }
  navToggle.addEventListener("click", () => setNav(!nav.classList.contains("open")));
  nav.addEventListener("click", (e) => { if (e.target.closest("a")) setNav(false); });

  const quickMenu = $(".quick-menu");
  const mobileBar = $(".mobile-bar");
  const onScroll = () => {
    const y = window.scrollY;
    header.classList.toggle("scrolled", y > 10);
    quickMenu.classList.toggle("show", y > 500);
    mobileBar.classList.toggle("show", y > 500);
  };
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();
  $("#toTop").addEventListener("click", () => window.scrollTo({ top: 0, behavior: "smooth" }));

  // active menu highlight
  const navLinks = $$('.main-nav a:not(.btn)');
  const sectionIds = navLinks.map((a) => a.getAttribute("href").slice(1));
  const spy = new IntersectionObserver((entries) => {
    entries.forEach((en) => {
      if (en.isIntersecting) {
        navLinks.forEach((a) => a.classList.toggle("active", a.getAttribute("href") === "#" + en.target.id));
      }
    });
  }, { rootMargin: "-45% 0px -50% 0px" });
  sectionIds.forEach((id) => { const el = document.getElementById(id); if (el) spy.observe(el); });

  /* ---------- Reveal on scroll ---------- */
  const revealer = new IntersectionObserver((entries) => {
    entries.forEach((en) => {
      if (en.isIntersecting) { en.target.classList.add("in"); revealer.unobserve(en.target); }
    });
  }, { threshold: 0.12, rootMargin: "0px 0px -40px 0px" });
  const observeReveal = (root = document) => $$(".reveal:not(.in)", root).forEach((el, i) => {
    el.style.transitionDelay = `${(i % 6) * 60}ms`;
    revealer.observe(el);
  });

  /* ---------- Count-up stats ---------- */
  const counter = new IntersectionObserver((entries) => {
    entries.forEach((en) => {
      if (!en.isIntersecting) return;
      const el = en.target;
      const target = Number(el.dataset.count);
      const suffix = el.dataset.suffix || "";
      const start = performance.now();
      const dur = 1400;
      const step = (now) => {
        const p = Math.min((now - start) / dur, 1);
        const v = Math.round(target * (1 - Math.pow(1 - p, 3)));
        el.textContent = v.toLocaleString("ko-KR") + (p === 1 ? suffix : "");
        if (p < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
      counter.unobserve(el);
    });
  }, { threshold: 0.6 });
  if (!matchMedia("(prefers-reduced-motion: reduce)").matches) $$("[data-count]").forEach((el) => counter.observe(el));

  /* =========================================================
     EDUCATION — 탭 + 검색 + 카드
     ========================================================= */
  const tabsEl = $("#trackTabs");
  const gridEl = $("#courseGrid");
  const emptyEl = $("#courseEmpty");
  const searchEl = $("#courseSearch");
  let currentTrack = "all";

  const tabList = [{ id: "all", name: "전체", count: COURSES.length }]
    .concat(TRACKS.map((t) => ({ id: t.id, name: t.short, count: COURSES.filter((c) => c.track === t.id).length })));

  tabsEl.innerHTML = tabList.map((t) => `
    <button type="button" role="tab" class="track-tab" data-track="${t.id}" aria-selected="${t.id === "all"}">
      ${esc(t.name)} <span class="cnt">${t.count}</span>
    </button>`).join("");

  tabsEl.addEventListener("click", (e) => {
    const btn = e.target.closest(".track-tab");
    if (!btn) return;
    currentTrack = btn.dataset.track;
    $$(".track-tab", tabsEl).forEach((b) => b.setAttribute("aria-selected", String(b === btn)));
    renderCourses();
  });
  searchEl.addEventListener("input", renderCourses);

  function renderCourses() {
    const q = searchEl.value.trim().toLowerCase();
    const list = COURSES.filter((c) => {
      if (currentTrack !== "all" && c.track !== currentTrack) return false;
      if (!q) return true;
      const hay = [c.title, c.summary, c.target, ...c.contents, ...c.practice, ...c.outcomes, trackOf(c.track).name].join(" ").toLowerCase();
      return hay.includes(q);
    });

    gridEl.innerHTML = list.map((c, i) => `
      <button type="button" class="course-card" data-open-course="${c.no}" style="animation-delay:${Math.min(i, 12) * 35}ms">
        <span class="course-top">
          <span class="course-no">${pad(c.no)}</span>
          <span class="level">${esc(c.level)}</span>
        </span>
        <h3>${esc(c.title)}</h3>
        <span class="course-go">${icon("arrow-up-right")}</span>
      </button>`).join("");
    emptyEl.hidden = list.length > 0;
  }
  renderCourses();

  /* =========================================================
     MODAL
     ========================================================= */
  const modal = $("#modal");
  const modalBody = $("#modalBody");
  const modalPanel = $(".modal-panel", modal);
  let lastFocus = null;

  function openModal(html, { wide = false } = {}) {
    if (modal.hidden) lastFocus = document.activeElement;
    modalBody.innerHTML = html;
    modalPanel.classList.toggle("wide", wide);
    modal.hidden = false;
    document.body.classList.add("modal-open");
    modalPanel.scrollTop = 0;
    const title = $("h2", modalBody);
    if (title) { title.id = "modalTitle"; title.tabIndex = -1; title.focus({ preventScroll: true }); }
  }
  function closeModal() {
    modal.hidden = true;
    document.body.classList.remove("modal-open", "print-syllabus");
    if (lastFocus) lastFocus.focus({ preventScroll: true });
  }
  modal.addEventListener("click", (e) => { if (e.target.closest("[data-close]")) closeModal(); });
  document.addEventListener("keydown", (e) => {
    if (modal.hidden) { if (e.key === "Escape" && nav.classList.contains("open")) setNav(false); return; }
    if (e.key === "Escape") closeModal();
    if (e.key === "Tab") { // focus trap
      const f = $$('button, a[href], input, select, textarea, [tabindex]:not([tabindex="-1"])', modalPanel).filter((el) => !el.disabled && el.offsetParent !== null);
      if (!f.length) return;
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });

  /* ---------- Course detail ---------- */
  function courseHTML(c) {
    const t = trackOf(c.track);
    const prev = courseOf(c.no - 1), next = courseOf(c.no + 1);
    return `
      <div class="md-head">
        <div class="md-tags">
          <span class="md-no">${pad(c.no)}</span>
          <span class="level level-${esc(c.level.split(" ")[0])}">${esc(c.level)}</span>
          <span class="md-track">${esc(t.no)} ${esc(t.name)}</span>
        </div>
        <h2>${esc(c.title)}</h2>
        <p>${esc(c.summary)}</p>
      </div>
      <dl class="md-info">
        <div><dt>${icon("user")}교육대상</dt><dd>${esc(c.target)}</dd></div>
        <div><dt>${icon("clock")}교육시간</dt><dd>${esc(c.hours)} <small style="color:var(--muted);font-weight:500">· 기관 협의 조정 가능</small></dd></div>
      </dl>
      <div class="md-sections">
        <section>
          <h4>${icon("book")}주요내용</h4>
          <ul>${c.contents.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>
        </section>
        <section>
          <h4>${icon("tool")}실습내용</h4>
          <ul>${c.practice.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>
        </section>
        <section class="full">
          <h4>${icon("check")}교육 후 만들 수 있는 결과물</h4>
          <div class="md-outcomes">${c.outcomes.map((x) => `<span>${esc(x)}</span>`).join("")}</div>
        </section>
      </div>
      <div class="md-actions">
        <button type="button" class="btn btn-accent" data-inquire="${c.no}">이 과정으로 교육 문의하기 ${icon("arrow")}</button>
        <button type="button" class="btn btn-outline" data-open-syllabus>전체 강의계획서 보기</button>
      </div>
      <div class="md-nav">
        ${prev ? `<button type="button" data-open-course="${prev.no}">← ${pad(prev.no)} ${esc(prev.title)}</button>` : "<span></span>"}
        ${next ? `<button type="button" data-open-course="${next.no}">${pad(next.no)} ${esc(next.title)} →</button>` : "<span></span>"}
      </div>`;
  }
  const openCourse = (no) => { const c = courseOf(no); if (c) openModal(courseHTML(c)); };

  /* ---------- 2027 Syllabus ---------- */
  function syllabusHTML() {
    return `
      <div class="sy-head">
        <div>
          <small>WELFARE INSIGHT · 2027</small>
          <h2>복지인사이트 전문교육 강의계획서</h2>
          <p>현장의 경험에 AI를 더하다 — 4개 분야 20개 과정</p>
        </div>
        <button type="button" class="btn btn-dark btn-sm no-print" id="printSyllabus">${icon("print")} 인쇄 · PDF 저장</button>
      </div>
      ${TRACKS.map((t) => `
        <section class="sy-track">
          <h3>${esc(t.no)} ${esc(t.name)}</h3>
          <table class="sy-table">
            <thead><tr><th>No</th><th>교육과정</th><th>교육대상</th><th>시간</th><th>주요내용</th></tr></thead>
            <tbody>
              ${COURSES.filter((c) => c.track === t.id).map((c) => `
                <tr>
                  <td>${pad(c.no)}</td>
                  <td class="t"><button type="button" data-open-course="${c.no}">${esc(c.title)}</button></td>
                  <td class="c">${esc(c.target)}</td>
                  <td class="h">${esc(c.hours)}</td>
                  <td class="c">${c.contents.map(esc).join(" · ")}</td>
                </tr>`).join("")}
            </tbody>
          </table>
        </section>`).join("")}
      <div class="sy-foot">
        ※ 모든 과정은 기관의 사업영역·참여자 수준·교육시간에 맞춰 조정할 수 있으며, 개인정보 보호와 비식별화 원칙을 함께 교육합니다.<br />
        ※ 교육시간: 실습 교육은 1회 3~8시간(시간 단위), 1~2시간은 기조강연 형태로만 진행 · 여러 회차(예: 3회 × 4시간) 신청 가능<br />
        문의 ${esc(CONTACT.phone)} · ${esc(CONTACT.email)}
      </div>
      <div class="md-actions no-print">
        <button type="button" class="btn btn-accent" data-inquire="">교육 문의하기 ${icon("arrow")}</button>
      </div>`;
  }
  const openSyllabus = () => openModal(syllabusHTML(), { wide: true });

  /* ---------- Instructor profile ---------- */
  const PROFILE = [
    ["現", "한국재가장기요양기관협회 외부전문위원"],
    ["現", "한국사회복지사협회 돌봄통합위원회 위원"],
    ["現", "한국사회복지사협회, 한국사회복지관협회, 한국노인복지중앙회 보수교육 강사"],
    ["現", "사회복지 챗GPT, 홍보콘텐츠 스터디 카페 운영 (6,500명 회원)"],
    ["現", "GPTs 사회복지 슈퍼바이저, 사례관리, 개별상담기록지 등 100종 챗봇 제작"],
    ["2026", "한국사회복지행정학회 워크숍 ‘생성AI를 활용한 사회복지 행정혁신: SWA 5단계 재구성 모델’ 발제"],
    ["발제", "제16회 세계 사회복지사 유라시아포럼, ‘사회복지와 AI 라포형성: 100종 챗봇 사례’ 발제"],
    ["수상", "대한민국인재상 (부총리 겸 교육부장관)"],
    ["자격", "사회복지사 1급, 인공지능데이터전문가 1급, 청소년지도사 2급"],
    ["출강", "카이스트, 대한의료사회복지사협회, 서울사회복지협의회, 한국정신재활시설협회 등 출강 1,500회 이상"],
  ];
  function profileHTML() {
    return `
      <div class="pf-head">
        <img src="assets/img/logo.png" alt="" />
        <div>
          <small>INSTRUCTOR PROFILE</small>
          <h2>복지인사이트 대표 이창희</h2>
          <p>사회복지 현장의 경험과 생성형 AI 기술을 연결하여 사회복지사가 실제 업무에서 활용할 수 있는 AI 교육과 도구를 연구하고 있습니다.</p>
        </div>
      </div>
      <ul class="pf-list">
        ${PROFILE.map(([k, v]) => `<li><b class="${k === "現" ? "now" : ""}">${esc(k)}</b><span>${esc(v)}</span></li>`).join("")}
      </ul>
      <div class="md-actions">
        <button type="button" class="btn btn-accent" data-inquire="">강의 요청하기 ${icon("arrow")}</button>
        <button type="button" class="btn btn-outline" data-open-syllabus>강의계획서 보기</button>
      </div>`;
  }

  /* ---------- Global click delegation ---------- */
  document.addEventListener("click", (e) => {
    const courseBtn = e.target.closest("[data-open-course]");
    if (courseBtn) { e.preventDefault(); openCourse(courseBtn.dataset.openCourse); return; }
    if (e.target.closest("[data-open-syllabus]")) { e.preventDefault(); openSyllabus(); return; }
    if (e.target.closest("[data-open-profile]")) { e.preventDefault(); openModal(profileHTML()); return; }
    if (e.target.closest("#printSyllabus")) {
      document.body.classList.add("print-syllabus");
      window.print();
      setTimeout(() => document.body.classList.remove("print-syllabus"), 500);
      return;
    }
    const inq = e.target.closest("[data-inquire]");
    if (inq) {
      closeModal();
      if (inq.dataset.inquire) selectTopics([Number(inq.dataset.inquire)]);
      goContact();
      return;
    }
    const preset = e.target.closest("[data-preset-type]");
    if (preset) { form.elements.type.value = preset.dataset.presetType; }
  });

  /* =========================================================
     CUSTOM — 맞춤교육 빌더
     ========================================================= */
  const builder = $("#builder");
  const state = { org: "center", hours: 6, sessions: 1, level: "beginner" };
  const NUM_KEYS = ["hours", "sessions"];

  $$(".choice-group", builder).forEach((g) => {
    const key = g.dataset.group;
    g.innerHTML = CUSTOM_OPTIONS[key].map((o) => `
      <button type="button" class="choice" data-key="${key}" data-val="${o.id}" aria-pressed="false">
        ${esc(o.label)}${o.note ? `<small>${esc(o.note)}</small>` : ""}
      </button>`).join("");
  });
  builder.addEventListener("click", (e) => {
    const c = e.target.closest(".choice");
    if (!c) return;
    const key = c.dataset.key;
    if (c.disabled) return;
    state[key] = NUM_KEYS.includes(key) ? Number(c.dataset.val) : c.dataset.val;
    if (key === "hours" && state.hours <= 2) state.sessions = 1; // 기조강연은 1회
    $$(".example-chip").forEach((x) => x.classList.remove("active"));
    renderBuilder();
  });
  $$(".example-chip").forEach((chip) => chip.addEventListener("click", () => {
    const [org, hours, level, sessions] = chip.dataset.example.split(",");
    Object.assign(state, { org, hours: Number(hours), level, sessions: Number(sessions) || 1 });
    $$(".example-chip").forEach((x) => x.classList.toggle("active", x === chip));
    renderBuilder();
    if (window.innerWidth <= 1024) builder.scrollIntoView({ behavior: "smooth", block: "start" });
  }));

  function buildPlan() {
    const org = CUSTOM_OPTIONS.org.find((o) => o.id === state.org);
    const lvl = CUSTOM_OPTIONS.level.find((o) => o.id === state.level);
    const hrs = CUSTOM_OPTIONS.hours.find((o) => o.id === state.hours);
    const keynote = hrs.id <= 2;
    const ses = keynote ? 1 : state.sessions;
    const total = hrs.id * ses;
    let mods = [...org.modules];
    if (lvl.id === "beginner") mods.unshift(lvl.intro);
    if (lvl.id === "advanced") mods.push(lvl.intro);
    if (keynote) {
      mods = ["AI 시대의 사회복지 (기조강연)", `${org.modules[0]} 활용 사례`];
    } else {
      const take = total <= 3 ? 3 : total <= 5 ? 4 : mods.length;
      mods = mods.slice(0, take);
      if (total >= 12) mods.push("현장 적용 프로젝트");
    }
    const hasSafety = mods.some((m) => /개인정보|민감정보/.test(m));
    const courses = [...new Set([...(lvl.id === "beginner" ? [lvl.course] : []), ...org.courses, ...(lvl.id === "advanced" ? [9] : [])])].slice(0, 3);
    const timeLabel = keynote ? "1~2시간 기조강연 (1회)" : ses > 1 ? `${hrs.id}시간 × ${ses}회 (총 ${total}시간)` : `${hrs.id}시간`;
    return { org, lvl, hrs, ses, total, keynote, timeLabel, mods, hasSafety, courses };
  }

  function renderBuilder() {
    $$(".choice", builder).forEach((c) => {
      const val = NUM_KEYS.includes(c.dataset.key) ? Number(c.dataset.val) : c.dataset.val;
      c.setAttribute("aria-pressed", String(state[c.dataset.key] === val));
      if (c.dataset.key === "sessions") c.disabled = state.hours <= 2 && val !== 1;
    });
    const p = buildPlan();
    const chips = p.mods.map((m) => `<span>${esc(m)}</span>`);
    if (!p.hasSafety) chips.push(`<span class="safe">개인정보 보호</span>`);
    $("#builderResult").innerHTML = `
      <p class="br-time">${icon("clock")}${esc(p.timeLabel)}</p>
      <div class="br-modules">${chips.join("")}</div>
      <div class="br-courses">
        ${p.courses.map((no) => { const c = courseOf(no); return `<button type="button" data-open-course="${no}"><b>${pad(no)}</b>${esc(c.title)}</button>`; }).join("")}
      </div>`;
  }
  renderBuilder();

  $("#builderCta").addEventListener("click", (e) => {
    e.preventDefault();
    const p = buildPlan();
    const orgMap = { center: "사회복지관", ltc: "장기요양기관", disability: "장애인복지시설", child: "아동복지기관", mental: "정신건강복지기관", manager: "" };
    form.elements.type.value = "기관 맞춤교육 문의";
    if (orgMap[p.org.id]) form.elements.orgType.value = orgMap[p.org.id];
    form.elements.hours.value = p.keynote ? "1~2시간 (기조강연)" : p.hrs.label;
    form.elements.sessions.value = `${p.ses}회`;
    updateHoursHint();
    if (!form.elements.target.value) form.elements.target.value = p.org.id === "manager" ? "관리자" : p.lvl.label;
    selectTopics(p.courses);
    const mods = p.mods.concat(p.hasSafety ? [] : ["개인정보 보호"]).join(" + ");
    if (!form.elements.message.value.trim()) form.elements.message.value = `[맞춤교육 미리보기] ${p.org.label} / ${p.timeLabel} / ${p.lvl.label}\n희망 구성: ${mods}`;
    goContact();
  });

  /* =========================================================
     PRACTICE / PORTFOLIO / REVIEWS / FAQ
     ========================================================= */
  $("#practiceFlow").innerHTML = PRACTICE_STEPS.map((s, i) => `
    <li class="practice-step reveal">
      <span class="ps-num">STEP ${pad(i + 1)}</span>
      <span class="ps-icon">${icon(s.icon)}</span>
      <h3>${esc(s.title)}</h3>
    </li>`).join("");

  const FIELD_STYLE = {
    "보수교육": ["#2a2d12", "#5d6b1e", "book"],
    "사회복지관": ["#3d4220", "#7d8b33", "pin"],
    "장기요양": ["#4a3a1a", "#b0772c", "hands"],
    "장애인복지": ["#1f3a35", "#3f7d6f", "user"],
    "아동복지": ["#40291c", "#d0793a", "star"],
    "정신건강": ["#262d44", "#5869a3", "shield"],
    "사회서비스": ["#30311c", "#8a8f4a", "layers"],
  };
  const fieldCats = ["전체", ...Object.keys(FIELD_STYLE)];
  const fieldFilters = $("#fieldFilters");
  fieldFilters.innerHTML = fieldCats.map((c, i) => `<button type="button" role="tab" class="filter-btn" data-cat="${esc(c)}" aria-selected="${i === 0}">${esc(c === "보수교육" ? "사회복지사 보수교육" : c === "사회서비스" ? "사회서비스 제공기관" : c)}</button>`).join("");
  fieldFilters.addEventListener("click", (e) => {
    const b = e.target.closest(".filter-btn");
    if (!b) return;
    $$(".filter-btn", fieldFilters).forEach((x) => x.setAttribute("aria-selected", String(x === b)));
    renderField(b.dataset.cat);
  });
  function renderField(cat = "전체") {
    const list = PORTFOLIO.filter((p) => cat === "전체" || p.cat === cat);
    $("#fieldGrid").innerHTML = list.map((p, i) => {
      const [c1, c2, ic] = FIELD_STYLE[p.cat] || ["#2a2d12", "#5d6b1e", "image"];
      const thumb = p.image
        ? `<img src="${esc(p.image)}" alt="${esc(p.topic)} 교육 현장" loading="lazy" />`
        : `<span class="ph">${icon(ic)}</span>`;
      return `
        <article class="field-card" style="animation-delay:${i * 50}ms">
          <div class="field-thumb" style="background:linear-gradient(135deg, ${c1}, ${c2})">${thumb}</div>
          <span class="field-cat">${esc(p.type)}</span>
          <h3>${esc(p.topic)}</h3>
        </article>`;
    }).join("");
  }
  renderField();

  $("#reviewGrid").innerHTML = REVIEWS.map((r) => `
    <article class="review-card reveal">
      <span class="q grad">“</span>
      <blockquote>${esc(r.text)}</blockquote>
      <p class="review-who">${esc(r.who)}</p>
    </article>`).join("");

  $("#faqList").innerHTML = FAQS.map((f, i) => `
    <div class="faq-item reveal">
      <button type="button" class="faq-q" aria-expanded="${i === 0}" aria-controls="faq-a-${i}" id="faq-q-${i}">
        <span>${esc(f.q)}</span>${icon("plus")}
      </button>
      <div class="faq-a" id="faq-a-${i}" role="region" aria-labelledby="faq-q-${i}"><div><p>${esc(f.a)}</p></div></div>
    </div>`).join("");
  $("#faqList").addEventListener("click", (e) => {
    const q = e.target.closest(".faq-q");
    if (q) q.setAttribute("aria-expanded", String(q.getAttribute("aria-expanded") !== "true"));
  });

  observeReveal();

  /* =========================================================
     CONTACT FORM
     ========================================================= */
  const form = $("#contactForm");
  const formMsg = $("#formMsg");
  $("#topicChips").innerHTML = COURSES.map((c) => `
    <label class="topic-chip"><input type="checkbox" name="topics" value="${c.no}" /><span><b>${pad(c.no)}</b>${esc(c.title)}</span></label>`).join("");

  /* 교육시간: 1회 시간 × 회차 */
  const hoursHint = $("#hoursHint");
  function timeText() {
    const h = form.elements.hours.value, n = form.elements.sessions.value;
    if (!h && !n) return "";
    if (h.includes("기조강연")) return "1~2시간 기조강연 (1회)";
    const hNum = parseInt(h, 10), nNum = parseInt(n, 10);
    if (hNum && nNum) return nNum > 1 ? `${hNum}시간 × ${nNum}회 (총 ${hNum * nNum}시간)` : `${hNum}시간 (1회)`;
    return [h && `1회 ${h}`, n && `${n}`].filter(Boolean).join(" / ");
  }
  function updateHoursHint() {
    const sesSel = form.elements.sessions;
    const keynote = form.elements.hours.value.includes("기조강연");
    if (keynote) sesSel.value = "1회";
    sesSel.disabled = keynote;
    const h = parseInt(form.elements.hours.value, 10), n = parseInt(sesSel.value, 10);
    markSelects();
    hoursHint.innerHTML = keynote
      ? "1~2시간은 <b>기조강연</b> 형태로만 진행됩니다."
      : h && n > 1 ? `총 <b>${h * n}시간</b> (${n}회 × ${h}시간)` : "";
  }
  // 선택된 드롭다운은 글자색을 진하게
  const markSelects = () => $$("select", form).forEach((sel) => sel.classList.toggle("has-value", !!sel.value));
  form.addEventListener("change", markSelects);
  form.addEventListener("reset", () => setTimeout(markSelects));
  form.elements.hours.addEventListener("change", updateHoursHint);
  form.elements.sessions.addEventListener("change", updateHoursHint);

  const topicCount = $("#topicCount");
  function updateTopicCount() {
    const n = $$('input[name="topics"]:checked', form).length;
    topicCount.textContent = n ? `${n}개 선택` : "";
  }
  $("#topicChips").addEventListener("change", updateTopicCount);
  function selectTopics(nos) {
    nos.forEach((no) => {
      const cb = $(`input[name="topics"][value="${no}"]`, form);
      if (cb) cb.checked = true;
    });
    updateTopicCount();
  }
  function goContact() {
    $("#contact").scrollIntoView({ behavior: "smooth" });
    setTimeout(() => form.elements.org.focus({ preventScroll: true }), 700);
  }

  function collect() {
    const f = form.elements;
    const topics = $$('input[name="topics"]:checked', form).map((cb) => { const c = courseOf(cb.value); return `${pad(c.no)} ${c.title}`; });
    return [
      ["문의 유형", f.type.value],
      ["기관명", f.org.value],
      ["기관 유형", f.orgType.value],
      ["담당자", f.name.value],
      ["연락처", f.phone.value],
      ["이메일", f.email.value],
      ["교육대상·인원", f.target.value],
      ["희망일정", f.date.value],
      ["교육시간", timeText()],
      ["희망 교육과정", topics.join(", ")],
      ["문의내용", f.message.value],
    ].filter(([, v]) => v && v.trim()).map(([k, v]) => `■ ${k}: ${v.trim()}`).join("\n");
  }

  function validate() {
    let ok = true;
    ["org", "name", "phone"].forEach((n) => {
      const el = form.elements[n];
      const bad = !el.value.trim();
      el.classList.toggle("invalid", bad);
      if (bad) ok = false;
    });
    const agree = form.elements.agree;
    agree.closest(".agree").classList.toggle("invalid", !agree.checked);
    if (!agree.checked) ok = false;
    return ok;
  }
  form.addEventListener("input", (e) => { if (e.target.classList.contains("invalid") && e.target.value.trim()) e.target.classList.remove("invalid"); });
  form.elements.agree.addEventListener("change", (e) => e.target.closest(".agree").classList.toggle("invalid", !e.target.checked));

  function openMail() {
    const subject = `[복지인사이트 교육문의] ${form.elements.org.value.trim()} - ${form.elements.type.value}`;
    const body = collect() + "\n\n— 복지인사이트 홈페이지에서 보낸 문의입니다.";
    window.location.href = `mailto:${CONTACT.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  }

  // 메일 본문 표에 들어갈 항목 (키가 그대로 메일의 항목 이름이 됩니다)
  function mailFields() {
    const f = form.elements;
    const topics = $$('input[name="topics"]:checked', form).map((cb) => { const c = courseOf(cb.value); return `${pad(c.no)} ${c.title}`; });
    const data = {
      "문의 유형": f.type.value, "기관명": f.org.value, "기관 유형": f.orgType.value, "담당자": f.name.value,
      "연락처": f.phone.value, "이메일": f.email.value, "교육대상·인원": f.target.value, "희망일정": f.date.value,
      "교육시간": timeText(), "희망 교육과정": topics.join(", "), "문의내용": f.message.value,
    };
    Object.keys(data).forEach((k) => { data[k] = String(data[k]).trim(); if (!data[k]) delete data[k]; });
    return data;
  }

  function showDone() {
    form.classList.add("is-done");
    form.insertAdjacentHTML("beforeend", `
      <div class="form-done" role="status">
        <span class="fd-icon">${icon("check")}</span>
        <h3>신청이 접수되었습니다</h3>
        <p>${esc(form.elements.name.value.trim())}님, 확인 후 빠르게 연락드리겠습니다.<br />급한 문의는 <a href="tel:${CONTACT.phone}">${CONTACT.phone}</a></p>
        <button type="button" class="btn btn-line" id="formAgain">새 신청 작성</button>
      </div>`);
    $("#formAgain").addEventListener("click", () => {
      form.reset(); updateTopicCount(); updateHoursHint();
      form.classList.remove("is-done");
      $(".form-done", form).remove();
      formMsg.textContent = "";
    });
  }

  const submitBtn = $('button[type="submit"]', form);
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (submitBtn.disabled) return;
    if (!validate()) {
      formMsg.className = "form-msg err";
      formMsg.textContent = "필수 항목(기관명·담당자·연락처)과 개인정보 동의를 확인해 주세요.";
      const first = $(".invalid", form);
      if (first) (first.matches("input,select,textarea") ? first : $("input", first)).focus();
      return;
    }
    if (form.elements._honey.value) return; // 자동 스팸 차단

    const label = submitBtn.innerHTML;
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="spinner" aria-hidden="true"></span> 보내는 중…';
    formMsg.textContent = "";
    try {
      // FormSubmit: 입력 내용을 CONTACT.email 메일함으로 바로 보내 줍니다.
      const res = await fetch(`https://formsubmit.co/ajax/${CONTACT.email}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          ...mailFields(),
          _subject: `[복지인사이트 교육신청] ${form.elements.org.value.trim()} · ${form.elements.name.value.trim()}`,
          _replyto: form.elements.email.value.trim() || undefined,
          _template: "table",
          _captcha: "false",
        }),
      });
      const out = await res.json().catch(() => ({}));
      if (!res.ok || String(out.success) !== "true") throw new Error(out.message || "failed");
      showDone();
    } catch (err) {
      formMsg.className = "form-msg err";
      formMsg.innerHTML = `전송에 실패했습니다. <button type="button" class="link-btn" id="mailFallback">메일 앱으로 보내기</button> 또는 ${CONTACT.phone}로 연락주세요.`;
      $("#mailFallback").addEventListener("click", openMail);
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerHTML = label;
    }
  });

  $("#copyForm").addEventListener("click", async () => {
    const text = collect();
    if (!text) { toast("먼저 문의 내용을 입력해 주세요."); return; }
    try {
      await navigator.clipboard.writeText(`[복지인사이트 교육문의]\n${text}`);
      toast(`문의 내용이 복사되었습니다. ${CONTACT.email} 로 보내주세요.`);
    } catch {
      toast("복사에 실패했습니다. 내용을 직접 선택해 복사해 주세요.");
    }
  });

  $("#year").textContent = new Date().getFullYear();

  /* =========================================================
     MOTION — 스포트라이트 · 카드 기울기 · 마그네틱 버튼 · 제목 등장
     ========================================================= */
  const fine = matchMedia("(hover: hover) and (pointer: fine)").matches;
  const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const SPOT = ".quick-card, .bento-card, .course-card, .tool-card, .review-card, .material-card, .process li, .faq-item, .practice-step, .kpi li, .builder";

  if (fine) {
    document.addEventListener("pointermove", (e) => {
      const card = e.target.closest(SPOT);
      if (!card) return;
      const r = card.getBoundingClientRect();
      const x = e.clientX - r.left, y = e.clientY - r.top;
      card.style.setProperty("--mx", `${x}px`);
      card.style.setProperty("--my", `${y}px`);
      if (!still && card.classList.contains("course-card")) {
        const rx = ((y / r.height) - 0.5) * -8, ry = ((x / r.width) - 0.5) * 10;
        card.style.transform = `translateY(-6px) rotateX(${rx}deg) rotateY(${ry}deg)`;
      }
    }, { passive: true });
    document.addEventListener("pointerout", (e) => {
      const card = e.target.closest(".course-card");
      if (card && !card.contains(e.relatedTarget)) card.style.transform = "";
    });

    if (!still) $$(".magnetic").forEach((btn) => {
      btn.addEventListener("pointermove", (e) => {
        const r = btn.getBoundingClientRect();
        btn.style.transform = `translate(${(e.clientX - r.left - r.width / 2) * 0.25}px, ${(e.clientY - r.top - r.height / 2) * 0.35}px)`;
      });
      btn.addEventListener("pointerleave", () => { btn.style.transform = ""; });
    });
  }

  // 섹션 제목을 줄 단위로 감싸 아래에서 올라오게
  const splitObs = new IntersectionObserver((entries) => {
    entries.forEach((en) => { if (en.isIntersecting) { en.target.classList.add("in"); splitObs.unobserve(en.target); } });
  }, { threshold: 0.3 });
  $$(".head h2, .custom-copy h2, .contact-copy h2").forEach((h) => {
    h.innerHTML = h.innerHTML.split(/<br\s*\/?>/i).map((part) => `<span class="line"><span>${part.trim()}</span></span>`).join("");
    h.classList.add("split");
    splitObs.observe(h);
  });
})();
