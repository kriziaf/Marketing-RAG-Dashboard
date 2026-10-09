function toggleBadge(element) {
    element.parentElement.querySelectorAll('.shell-toolbar__pill').forEach(pill => {
        pill.classList.remove('is-active');
    });
    element.classList.add('is-active');
    const label = element.childNodes[0].textContent.trim();
    showNotification(`Filter applied: ${label}`);
}

function performAction(action) {
    if (action === 'generate') {
        openGenModal();
        return;
    }
    if (action === 'patterns') {
        openPatModal();
        return;
    }
    if (action === 'ingest') {
        openIngModal();
        return;
    }
    if (action === 'slack') {
        executeQuery('Set up a Slack bot integration for the RAG system');
    }
}

/* ===== Scenario C: Ingest Content ===== */

const ING_MOCK = {
    drive: {
        label: 'Ingesting from Google Drive',
        docs: [
            { name: 'Blog: Patient Portal No-Show Results (draft 3)', chunks: 16, fail: false },
            { name: 'Email: Telehealth expansion sequence', chunks: 9, fail: false },
            { name: 'Social: July community outreach batch', chunks: 5, fail: false },
            { name: 'Article: Managing Type 2 Diabetes Between Visits', chunks: 12, fail: false },
            { name: 'Article: Understanding Your EOB v3', chunks: 7, fail: false },
            { name: 'Report: 2026 Community Health Outcomes.pdf', chunks: 0, fail: true, reason: 'Password-protected PDF' },
            { name: 'Blog: Remote monitoring program notes', chunks: 11, fail: false }
        ]
    },
    upload: {
        label: 'Processing uploaded files',
        docs: [
            { name: 'patient-comms-style-guide-2026.docx', chunks: 14, fail: false },
            { name: 'health-fair-webinar-transcript.md', chunks: 22, fail: false },
            { name: 'flu-season-campaign-recap.pdf', chunks: 18, fail: false }
        ]
    },
    url: {
        label: 'Scraping from URL',
        docs: [
            { name: 'health.example.org/telehealth-expansion', chunks: 8, fail: false },
            { name: 'health.example.org/community-nursing-milestone', chunks: 10, fail: false },
            { name: 'health.example.org/2026-programs (redirect)', chunks: 0, fail: true, reason: '404 after redirect' }
        ]
    }
};

const STALE_CONTENT = [
    { name: 'Member Billing FAQ', updated: 'Apr 2, 2026', type: 'article' },
    { name: 'Telehealth Expansion Announcement (internal brief)', updated: 'May 15, 2026', type: 'email' }
];

let currentChunkTotal = 2847;

function openIngModal() {
    document.getElementById('ing-modal').classList.add('open');
    showIngStep('source');
}

function closeIngModal() {
    document.getElementById('ing-modal').classList.remove('open');
}

function showIngStep(step) {
    document.getElementById('ing-step-source').style.display = step === 'source' ? 'block' : 'none';
    document.getElementById('ing-step-progress').style.display = step === 'progress' ? 'block' : 'none';
    document.getElementById('ing-step-summary').style.display = step === 'summary' ? 'block' : 'none';
}

function startIngestion(source) {
    const cfg = ING_MOCK[source];
    document.getElementById('ing-progress-label').textContent = cfg.label;
    document.getElementById('ing-progress-fill').style.width = '0%';
    document.getElementById('ing-progress-pct').textContent = '0%';
    document.getElementById('ing-progress-text').textContent = 'Scanning source…';

    const list = document.getElementById('ing-doc-list');
    list.innerHTML = cfg.docs.map((d, i) => `
        <div class="doc-row pending" id="doc-row-${i}">
            <span class="doc-status" id="doc-status-${i}">○</span>
            <span class="doc-name">${d.name}</span>
            <span class="doc-chunks" id="doc-chunks-${i}"></span>
        </div>`).join('');

    showIngStep('progress');
    processDocs(cfg);
}

function processDocs(cfg) {
    const total = cfg.docs.length;
    let i = 0;

    function step() {
        if (i > 0) finishDoc(i - 1, cfg.docs[i - 1]);
        if (i < total) {
            const row = document.getElementById(`doc-row-${i}`);
            row.classList.remove('pending');
            row.classList.add('processing');
            document.getElementById(`doc-status-${i}`).textContent = '⏳';
            document.getElementById('ing-progress-text').textContent =
                `Extracting → chunking → embedding: ${cfg.docs[i].name}`;
            const pct = Math.round(((i + 0.5) / total) * 100);
            document.getElementById('ing-progress-fill').style.width = pct + '%';
            document.getElementById('ing-progress-pct').textContent = pct + '%';
            i++;
            setTimeout(step, 550 + Math.random() * 350);
        } else {
            document.getElementById('ing-progress-fill').style.width = '100%';
            document.getElementById('ing-progress-pct').textContent = '100%';
            document.getElementById('ing-progress-text').textContent = 'Indexing complete';
            setTimeout(() => showSummary(cfg), 600);
        }
    }
    step();
}

function finishDoc(idx, doc) {
    const row = document.getElementById(`doc-row-${idx}`);
    row.classList.remove('processing');
    if (doc.fail) {
        row.classList.add('failed');
        document.getElementById(`doc-status-${idx}`).textContent = '✕';
        document.getElementById(`doc-chunks-${idx}`).textContent = doc.reason;
    } else {
        document.getElementById(`doc-status-${idx}`).textContent = '✓';
        document.getElementById(`doc-chunks-${idx}`).textContent = `${doc.chunks} chunks`;
    }
}

function showSummary(cfg) {
    const ok = cfg.docs.filter(d => !d.fail);
    const failed = cfg.docs.filter(d => d.fail);
    const newChunks = ok.reduce((n, d) => n + d.chunks, 0);

    document.getElementById('sum-docs').textContent = ok.length;
    document.getElementById('sum-chunks').textContent = '+' + newChunks;
    document.getElementById('sum-failed').textContent = failed.length;

    const stalePanel = document.getElementById('stale-panel');
    if (STALE_CONTENT.length) {
        stalePanel.style.display = 'block';
        document.getElementById('stale-list').innerHTML = STALE_CONTENT.map(s => `
            <div class="stale-item">
                <span>${s.name} <span style="color:var(--color-text-tertiary)">· last updated ${s.updated}</span></span>
                <button class="shell-btn-outline btn-compact" onclick="showNotification('Re-ingestion queued: ${s.name}', 'info')">Re-ingest</button>
            </div>`).join('');
    } else {
        stalePanel.style.display = 'none';
    }

    showIngStep('summary');
    animateChunkCount(currentChunkTotal, currentChunkTotal + newChunks);
    currentChunkTotal += newChunks;
    updateStatusBar();
}

function animateChunkCount(from, to) {
    const el = document.getElementById('content-chunks');
    if (!el) return;
    const duration = 900;
    const start = performance.now();
    function tick(now) {
        const t = Math.min((now - start) / duration, 1);
        const val = Math.round(from + (to - from) * t);
        el.textContent = val.toLocaleString();
        if (t < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
}

function updateStatusBar() {
    const bar = document.querySelector('.status-bar span:last-child');
    if (bar) {
        bar.textContent = `Last ingestion: just now • ${currentChunkTotal.toLocaleString()} chunks indexed • System healthy`;
    }
}

document.getElementById('ing-modal').addEventListener('click', function(e) {
    if (e.target === this) closeIngModal();
});

/* ===== Scenario B: Find Patterns ===== */

const PATTERN_MOCK = {
    blog: {
        analyzed: 48,
        patterns: [
            {
                title: "Outcome-first headlines",
                desc: "Top posts state the patient or clinic outcome in the headline, not the program name.",
                metric: "Avg. time on page",
                patternVal: 4.6, baselineVal: 2.8, unit: "min",
                excerpt: "\"How Our Patient Portal Cut No-Show Rates by a Third\" — leads with the measurable outcome, not the product.",
                source: "No-Show Reduction Pilot: Results Memo",
                applyBrief: "Write a blog post using an outcome-first headline: lead with the measurable patient or clinic outcome, not the program name."
            },
            {
                title: "One number in the intro",
                desc: "High performers anchor the problem with a single concrete stat in the first two paragraphs.",
                metric: "Scroll depth",
                patternVal: 78, baselineVal: 54, unit: "%",
                excerpt: "\"62% of no-shows said they would have rescheduled if it took under a minute.\"",
                source: "Patient Portal FAQ v3",
                applyBrief: "Write a blog post that anchors the problem with one concrete statistic in the opening two paragraphs."
            }
        ]
    },
    email: {
        analyzed: 32,
        patterns: [
            {
                title: "Concrete benefit in first 40 characters",
                desc: "Subject lines stating the specific benefit early outperform generic announcements.",
                metric: "Open rate",
                patternVal: 52, baselineVal: 33, unit: "%",
                excerpt: "\"Telehealth now open evenings & weekends\" — the benefit lands before the fold on mobile.",
                source: "Patient Email Playbook",
                applyBrief: "Write a patient email whose subject line states the concrete benefit within the first 40 characters."
            },
            {
                title: "Cost clarity up front",
                desc: "Emails stating coverage/cost in the body's first half see far fewer support calls and higher booking rates.",
                metric: "Booking conversion",
                patternVal: 11.4, baselineVal: 6.2, unit: "%",
                excerpt: "\"Flu shots are covered at no cost under most plans.\" — cost objection answered before the CTA.",
                source: "Member Billing FAQ",
                applyBrief: "Write a patient email that addresses cost or coverage clearly before the call to action."
            },
            {
                title: "One action per email",
                desc: "Single-CTA patient emails outperform multi-option emails on completion of the primary action.",
                metric: "Primary action completion",
                patternVal: 64, baselineVal: 41, unit: "%",
                excerpt: "\"[Book a telehealth visit]\" — one action, with the phone alternative kept to a footnote.",
                source: "Telehealth Expansion Announcement (internal brief)",
                applyBrief: "Write a patient email with exactly one call to action; secondary options only as a brief footnote."
            }
        ]
    },
    social: {
        analyzed: 156,
        patterns: [
            {
                title: "Team-milestone openers",
                desc: "Posts opening with a concrete care-team milestone outperform program announcements 3:1.",
                metric: "Engagement rate",
                patternVal: 6.3, baselineVal: 2.1, unit: "%",
                excerpt: "\"500 home visits this quarter.\" — the number opens the post; context follows.",
                source: "Community Nursing Q2 Report",
                applyBrief: "Write a social post that opens with a concrete care-team milestone before any program description."
            },
            {
                title: "No hype, no exclamation marks",
                desc: "The plain, numbers-first voice consistently beats promotional-toned variants in health comms.",
                metric: "Comment rate",
                patternVal: 3.4, baselineVal: 1.9, unit: "%",
                excerpt: "\"High blood pressure often has no symptoms — a two-minute check is how most people find out.\"",
                source: "Social Voice Guide (Health Comms)",
                applyBrief: "Write a social post in a plain, numbers-first voice: concrete facts, no exclamation marks, no promotional adjectives."
            }
        ]
    },
    article: {
        analyzed: 24,
        patterns: [
            {
                title: "Numbered-section structure",
                desc: "Patient education articles broken into short numbered sections are completed far more often than continuous prose.",
                metric: "Read completion",
                patternVal: 71, baselineVal: 44, unit: "%",
                excerpt: "\"...reading it takes about two minutes once you know the four sections.\" — the structure is promised up front.",
                source: "Health Literacy Review Checklist",
                applyBrief: "Write a patient education article structured as short numbered sections, promising the structure in the intro."
            },
            {
                title: "\"When to call\" section",
                desc: "Articles that include explicit escalation guidance score higher on usefulness surveys and reduce portal messages.",
                metric: "Usefulness rating",
                patternVal: 4.6, baselineVal: 3.7, unit: "/5",
                excerpt: "\"When to call before your next visit: repeated readings outside your range... Don't wait these out.\"",
                source: "Diabetes Care Guide (Patient Education Library)",
                applyBrief: "Write a patient education article that includes an explicit 'when to call your care team' section."
            }
        ]
    }
};

function openPatModal() {
    document.getElementById('pat-modal').classList.add('open');
    showPatStep('type');
}

function closePatModal() {
    document.getElementById('pat-modal').classList.remove('open');
}

function showPatStep(step) {
    document.getElementById('pat-step-type').style.display = step === 'type' ? 'block' : 'none';
    document.getElementById('pat-step-loading').style.display = step === 'loading' ? 'block' : 'none';
    document.getElementById('pat-step-results').style.display = step === 'results' ? 'block' : 'none';
}

function analyzePatterns(type) {
    showPatStep('loading');
    const msgs = [
        'Analyzing content performance…',
        'Clustering high performers…',
        'Extracting shared structures…'
    ];
    let i = 0;
    const msgEl = document.getElementById('pat-load-msg');
    msgEl.textContent = msgs[0];
    const timer = setInterval(() => {
        i++;
        if (i < msgs.length) {
            msgEl.textContent = msgs[i];
        } else {
            clearInterval(timer);
            renderPatterns(type);
        }
    }, 650);
}

function renderPatterns(type) {
    const data = PATTERN_MOCK[type];
    const typeLabels = { blog: 'Blog', email: 'Email', social: 'Social', article: 'Article' };

    document.getElementById('pat-results-meta').textContent =
        `${typeLabels[type]} · ${data.analyzed} items analyzed · ${data.patterns.length} patterns found`;

    document.getElementById('pat-results-list').innerHTML = data.patterns.map((p, idx) => {
        const maxVal = Math.max(p.patternVal, p.baselineVal);
        const pw = Math.round(p.patternVal / maxVal * 100);
        const bw = Math.round(p.baselineVal / maxVal * 100);
        return `
        <div class="pattern-card">
            <div class="pattern-title">${idx + 1}. ${p.title}</div>
            <div class="pattern-desc">${p.desc}</div>
            <div class="bar-compare">
                <div class="bar-row">
                    <div class="bar-label">With pattern</div>
                    <div class="bar-track"><div class="bar-fill pattern" style="width:${pw}%">${p.patternVal}${p.unit}</div></div>
                </div>
                <div class="bar-row">
                    <div class="bar-label">Repository baseline</div>
                    <div class="bar-track"><div class="bar-fill baseline" style="width:${bw}%">${p.baselineVal}${p.unit}</div></div>
                </div>
                <div style="font-size:11px;color:var(--color-text-tertiary);text-align:right;">${p.metric}</div>
            </div>
            <div class="pattern-excerpt">
                ${p.excerpt}
                <div class="pattern-excerpt-source">— ${p.source}</div>
            </div>
            <button class="shell-btn-primary btn-compact" onclick="applyPattern('${type}', ${idx})">✨ Apply to new content</button>
        </div>`;
    }).join('');

    showPatStep('results');
}

function applyPattern(type, idx) {
    const pattern = PATTERN_MOCK[type].patterns[idx];
    closePatModal();
    openGenModal();
    document.querySelectorAll('#gen-type-grid .type-option').forEach(o => {
        o.classList.toggle('selected', o.dataset.type === type);
    });
    genState.type = type;
    document.getElementById('gen-brief').value = pattern.applyBrief;
    showNotification(`Pattern loaded: ${pattern.title}`, 'success');
}

document.getElementById('pat-modal').addEventListener('click', function(e) {
    if (e.target === this) closePatModal();
});

/* ===== Scenario A: Generate Content ===== */

const GEN_MOCK = {
    blog: {
        variants: [
            "# How Our Patient Portal Cut No-Show Rates by a Third\n\nMissed appointments cost clinics time and delay care for the patients who need it most. Here's what changed when we made rescheduling a two-tap task.\n\n## The real reason patients no-show\nOur intake surveys pointed to one pattern: patients weren't skipping care — they were stuck on hold. 62% of no-shows said they would have rescheduled if it took under a minute.\n\n## What the portal does differently\nSelf-service rescheduling, automatic waitlist backfill, and reminders that include a reschedule link instead of just a warning. Clinics using all three saw no-show rates drop 34% in six months.\n\n## What to try first\nTurn on reminder-with-reschedule-link. It's the single highest-impact setting.\n\n**Next step:** Ask your practice administrator to enable portal rescheduling for your clinic.",
            "# Remote Patient Monitoring, Explained Without the Jargon\n\nIf your care team has suggested remote monitoring, here's what that actually means for your day-to-day.\n\n## The short version\nA small device — a blood pressure cuff, a glucose meter, a scale — sends readings to your care team automatically. No portal logins, no manual entry.\n\n## What your care team sees\nTrends, not surveillance. Your nurse sees whether readings are drifting over weeks, and reaches out before a problem becomes an ER visit. In our chronic care program, that meant 28% fewer unplanned admissions last year.\n\n## What it asks of you\nUse the device as prescribed. That's it.\n\n**Questions?** Your care coordinator can walk you through setup in one 15-minute call."
        ],
        sources: [
            { title: "Patient Portal FAQ v3", chunk: "§2 Rescheduling & reminders", score: 0.92 },
            { title: "No-Show Reduction Pilot: Results Memo", chunk: "§1 Six-month outcomes", score: 0.87 },
            { title: "Plain-Language Style Guide (Patient Comms)", chunk: "§1 Reading-level rules", score: 0.8 }
        ]
    },
    email: {
        variants: [
            "SUBJECT: Telehealth now open evenings & weekends\nPREVIEW: Book a video visit as late as 9pm\n\nHi {{first_name}},\n\nGood news — telehealth visits are now available weekday evenings until 9pm and Saturdays 8am–2pm.\n\nSame providers, same portal, no travel time. Video visits work for follow-ups, medication questions, minor illness, and mental health check-ins.\n\n[Book a telehealth visit]\n\nNeed an in-person appointment instead? Reply to this email or call your clinic directly.\n\n— Your Care Team",
            "SUBJECT: Flu shots are in — book in under a minute\nPREVIEW: Walk-ins welcome, appointments faster\n\nHi {{first_name}},\n\nFlu season is here, and this year's vaccine is now available at all our locations.\n\nBooking online takes under a minute, and most visits are done in fifteen. Flu shots are covered at no cost under most plans.\n\n[Book my flu shot]\n\nPrefer a walk-in? Check same-day availability on the portal before you head over.\n\n— Your Care Team"
        ],
        sources: [
            { title: "Telehealth Expansion Announcement (internal brief)", chunk: "§2 Hours & eligible visit types", score: 0.94 },
            { title: "Patient Email Playbook", chunk: "§3 Subject line & CTA patterns", score: 0.88 },
            { title: "Plain-Language Style Guide (Patient Comms)", chunk: "§2 Benefits-first framing", score: 0.82 }
        ]
    },
    social: {
        variants: [
            "500 home visits this quarter.\n\nThat's our community nursing team meeting patients where they are — no waiting rooms, no transportation barriers, no missed follow-ups.\n\nBehind that number: 214 patients managing chronic conditions from home, and a readmission rate 28% below the regional average.\n\nProud of this team. More to come.",
            "Free blood pressure screenings. No appointment, no insurance card, no cost.\n\nOur community health van will be at the Riverside Farmers Market every Saturday this month, 9am–1pm.\n\nHigh blood pressure often has no symptoms — a two-minute check is how most people find out.\n\nStop by. Bring a friend."
        ],
        sources: [
            { title: "Community Nursing Q2 Report", chunk: "§1 Visit volume & outcomes", score: 0.91 },
            { title: "Social Voice Guide (Health Comms)", chunk: "§1 Numbers-first, no hype", score: 0.86 },
            { title: "Community Outreach Calendar", chunk: "§2 Screening event details", score: 0.79 }
        ]
    },
    article: {
        variants: [
            "# Managing Type 2 Diabetes Between Visits: A Practical Guide\n\nYour appointments are checkpoints. Most of diabetes care happens in the weeks between them — and small routines matter more than perfect ones.\n\n## The three numbers to know\nYour A1c target, your daily glucose range, and your blood pressure goal. Write them down after every visit; they can change.\n\n## Between-visit routines that hold up\nCheck glucose at the times your care team specified — patterns matter more than single readings. Log what you can; even partial logs help your provider adjust treatment.\n\n## When to call before your next visit\nRepeated readings outside your range, new numbness or vision changes, or a medication you can't tolerate. Don't wait these out.\n\n## Your care team's role\nBring your log and your questions. Adjustments between visits are normal — they mean the plan is working as designed.",
            "# Understanding Your Explanation of Benefits (EOB)\n\nAn EOB is not a bill. It's a summary of what your insurance processed — and reading it takes about two minutes once you know the four sections.\n\n## 1. What was billed\nThe provider's full charge before any insurance adjustments. This number is almost never what you owe.\n\n## 2. What insurance allowed\nThe negotiated rate — usually much lower than the billed amount.\n\n## 3. What insurance paid\nThe plan's share of the allowed amount.\n\n## 4. What you may owe\nYour share: deductible, copay, or coinsurance. Compare this against any bill you receive from the provider — the numbers should match.\n\n## If something looks wrong\nCall the member services number on your insurance card, and have the claim number from the EOB ready."
        ],
        sources: [
            { title: "Diabetes Care Guide (Patient Education Library)", chunk: "§3 Self-management basics", score: 0.93 },
            { title: "Health Literacy Review Checklist", chunk: "§1 Structure for patient articles", score: 0.85 },
            { title: "Member Billing FAQ", chunk: "§2 EOB walkthrough", score: 0.81 }
        ]
    }
};

const BRIEF_EXAMPLES = {
    blog: [
        "Write a blog post explaining how our patient portal reduces appointment no-shows, for clinic administrators",
        "Explain what remote patient monitoring means for chronic care patients, in plain language"
    ],
    email: [
        "Announce extended telehealth hours to existing patients, emphasizing evening and weekend availability",
        "Flu season reminder encouraging patients to book vaccinations online, noting most plans cover it at no cost"
    ],
    social: [
        "LinkedIn post celebrating our community nursing team completing 500 home visits this quarter",
        "Promote our free community blood pressure screenings at the farmers market, no appointment needed"
    ],
    article: [
        "Patient education article on managing Type 2 diabetes between visits",
        "Help new members understand their explanation of benefits (EOB) and how it differs from a bill"
    ]
};

let genState = { type: 'blog', variant: 0, brief: '' };

function openGenModal() {
    document.getElementById('gen-modal').classList.add('open');
    renderExampleChips();
    showGenStep('form');
}

function renderExampleChips() {
    const chips = BRIEF_EXAMPLES[genState.type] || [];
    document.getElementById('gen-examples').innerHTML = chips.map(ex =>
        `<button type="button" class="example-chip" onclick="useExample(this)">${ex}</button>`
    ).join('');
}

function useExample(el) {
    document.getElementById('gen-brief').value = el.textContent;
    document.getElementById('gen-brief').focus();
}

function closeGenModal() {
    document.getElementById('gen-modal').classList.remove('open');
}

function selectGenType(el) {
    document.querySelectorAll('#gen-type-grid .type-option').forEach(o => o.classList.remove('selected'));
    el.classList.add('selected');
    genState.type = el.dataset.type;
    renderExampleChips();
}

function showGenStep(step) {
    document.getElementById('gen-step-form').style.display = step === 'form' ? 'block' : 'none';
    document.getElementById('gen-step-loading').style.display = step === 'loading' ? 'block' : 'none';
    document.getElementById('gen-step-result').style.display = step === 'result' ? 'block' : 'none';
    updateGenStepIndicator(step);
}

function updateGenStepIndicator(step) {
    const order = { form: 1, loading: 2, result: 3 };
    const current = order[step];
    for (let n = 1; n <= 3; n++) {
        const el = document.getElementById('gen-step-ind-' + n);
        if (!el) continue;
        el.classList.remove('is-active', 'is-done');
        if (n === current) el.classList.add('is-active');
        else if (n < current) el.classList.add('is-done');
    }
}

function genStepClick(n) {
    // Only completed steps are clickable; step 1 returns to the brief form
    const el = document.getElementById('gen-step-ind-' + n);
    if (n === 1 && el.classList.contains('is-done')) {
        showGenStep('form');
    }
}

function startGeneration() {
    const brief = document.getElementById('gen-brief').value.trim();
    if (!brief) {
        showNotification('Please add a brief before generating', 'info');
        return;
    }
    genState.brief = brief;
    genState.variant = 0;
    runLoadingSequence();
}

function runLoadingSequence() {
    showGenStep('loading');
    const steps = ['load-step-1', 'load-step-2', 'load-step-3'];
    steps.forEach(id => {
        const el = document.getElementById(id);
        el.classList.remove('active', 'done');
    });

    let i = 0;
    function advance() {
        if (i > 0) {
            document.getElementById(steps[i - 1]).classList.remove('active');
            document.getElementById(steps[i - 1]).classList.add('done');
        }
        if (i < steps.length) {
            document.getElementById(steps[i]).classList.add('active');
            i++;
            setTimeout(advance, 700);
        } else {
            showResult();
        }
    }
    advance();
}

function showResult() {
    const mock = GEN_MOCK[genState.type];
    const text = mock.variants[genState.variant % mock.variants.length];
    const tone = document.getElementById('gen-tone').value;
    const audience = document.getElementById('gen-audience').value;

    document.getElementById('result-meta').textContent =
        `${genState.type.toUpperCase()} · ${tone} · ${audience} · ${mock.sources.length} chunks retrieved`;
    document.getElementById('result-text').textContent = text;

    const list = document.getElementById('sources-list');
    list.innerHTML = mock.sources.map(s =>
        `<div class="source-chunk">
            <div class="source-chunk-title">${s.title}</div>
            <div>${s.chunk}</div>
            <div class="source-chunk-score">relevance ${s.score}</div>
        </div>`
    ).join('');
    list.style.display = 'none';
    document.getElementById('sources-toggle').textContent = `▸ View retrieved source chunks (${mock.sources.length})`;

    document.getElementById('rate-up').classList.remove('selected-up');
    document.getElementById('rate-down').classList.remove('selected-down');
    document.getElementById('rate-thanks').style.display = 'none';

    showGenStep('result');
}

function toggleSources() {
    const list = document.getElementById('sources-list');
    const btn = document.getElementById('sources-toggle');
    const open = list.style.display !== 'none';
    list.style.display = open ? 'none' : 'block';
    btn.textContent = (open ? '▸' : '▾') + btn.textContent.slice(1);
}

function copyResult() {
    const text = document.getElementById('result-text').textContent;
    navigator.clipboard.writeText(text).then(
        () => showNotification('Copied to clipboard!', 'success'),
        () => showNotification('Copy failed — select and copy manually', 'info')
    );
}

function regenerate() {
    genState.variant++;
    runLoadingSequence();
}

function backToForm() {
    showGenStep('form');
}

function rateResult(dir) {
    document.getElementById('rate-up').classList.toggle('selected-up', dir === 'up');
    document.getElementById('rate-down').classList.toggle('selected-down', dir === 'down');
    document.getElementById('rate-thanks').style.display = 'inline';
}

document.getElementById('gen-modal').addEventListener('click', function(e) {
    if (e.target === this) closeGenModal();
});
document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') { closeGenModal(); closePatModal(); closeIngModal(); }
});

function analyzeContent() {
    const searchTerm = document.getElementById('search-input').value;
    if (searchTerm.trim()) {
        executeQuery(`Analyze and show insights about: ${searchTerm}`);
    } else {
        showNotification('Please enter a search term');
    }
}

function executeQuery(query) {
    console.log('Executing query:', query);
    showNotification(`Query: "${query.substring(0, 50)}..."`);
    
    // Simulate API call
    setTimeout(() => {
        showNotification('Processing your request...', 'info');
    }, 100);
}

function showNotification(message, type = 'success') {
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        background-color: ${type === 'success' ? '#00cc88' : '#0066ff'};
        color: white;
        padding: 12px 20px;
        border-radius: 6px;
        font-size: 13px;
        box-shadow: 0 2px 8px rgba(0,0,0,0.15);
        z-index: 1000;
        animation: slideIn 0.3s ease-out;
    `;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease-out';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// Add slide animations
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from {
            transform: translateX(400px);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    @keyframes slideOut {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(400px);
            opacity: 0;
        }
    }
`;
document.head.appendChild(style);

// Initialize
function initDashboard() {
    document.getElementById('content-chunks').textContent = currentChunkTotal.toLocaleString();
}

// Search functionality
document.getElementById('search-input').addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
        analyzeContent();
    }
});

document.addEventListener('DOMContentLoaded', initDashboard);
