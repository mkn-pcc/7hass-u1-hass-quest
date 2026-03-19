// --- GAME STATE ---
let state = {
    currentScene: 'title',
    completedCases: [],
    activeCase: null,
    viewedSources: [],
    dialogueIndex: 0,
    currentDialogueSet: null,
    currentAnalysis: { type: null, cat: null, insight: null },
    data: { cases: null, dialogue: null, sources: null }
};

// --- DOM ELEMENTS ---
const el = {
    bg: document.getElementById('scene-bg'),
    title: document.getElementById('title-screen'),
    dialogue: document.getElementById('dialogue-container'),
    npcName: document.getElementById('npc-name'),
    npcPortrait: document.getElementById('npc-portrait'),
    text: document.getElementById('dialogue-text'),
    btnNext: document.getElementById('btn-next'),
    hotspots: document.getElementById('hotspot-layer'),
    progress: document.getElementById('progress-bar'),
    progressText: document.getElementById('progress-text'),
    sourceModal: document.getElementById('source-modal'),
    quizModal: document.getElementById('quiz-modal'),
    finalScreen: document.getElementById('final-screen')
};

// --- NPC DIRECTORY ---
const npcDirectory = {
    'curator': 'Stephanie',
    'indigenous_cultures_head': 'Miranda',
    'trade_head': 'Raphael',
    'torres_strait_head': 'Grayson'
};

// --- INITIALIZATION ---
async function init() {
    try {
        const [casesRes, dialogueRes, sourcesRes] = await Promise.all([
            fetch('data/cases.json'),
            fetch('data/dialogue.json'),
            fetch('data/sources.json')
        ]);

        if (!casesRes.ok || !dialogueRes.ok || !sourcesRes.ok) throw new Error("File load failed");

        state.data.cases = await casesRes.json();
        state.data.dialogue = await dialogueRes.json();
        state.data.sources = await sourcesRes.json();
        
        setupEventListeners();
        showTitle();
    } catch (err) {
        console.error(err);
        alert("System Error: Could not load museum archives. Please check console.");
    }
}

function setupEventListeners() {
    document.getElementById('btn-start').onclick = startToHub;
    document.getElementById('btn-help').onclick = () => alert("Analyse three sources in each exhibit to complete the case file.");
    document.getElementById('btn-close-source').onclick = closeSource;
    document.getElementById('btn-replay').onclick = () => location.reload();
}

// --- SCENE LOGIC ---
function showTitle() {
    el.bg.style.backgroundImage = `url('assets/backgrounds/title_bg.png')`;
}

function startToHub() {
    state.currentScene = 'hub';
    el.title.classList.add('hidden');
    el.progress.classList.remove('hidden');
    renderHub();
}

function renderHub() {
    el.bg.style.backgroundImage = `url('assets/backgrounds/hub_bg.png')`;
    el.hotspots.innerHTML = '';
    el.hotspots.classList.remove('hidden');
    
    // Reset dialogue for the hub
    el.dialogue.classList.remove('hidden');
    setDialogue('curator', state.completedCases.length === 0 ? 'hub_intro' : 'hub_return');

    // Generate Case Hotspots
    state.data.cases.forEach((c, idx) => {
        const btn = document.createElement('div');
        btn.className = 'hotspot';
        btn.style.left = `${20 + (idx * 25)}%`;
        btn.style.top = `55%`;
        
        if (state.completedCases.includes(c.id)) {
            btn.style.filter = 'grayscale(1) brightness(0.5)';
            btn.style.animation = 'none'; // Stop pulsing if complete
            btn.innerHTML = `<img src="assets/ui/case_complete_stamp.png" style="width:100%; pointer-events:none;">`;
        } else {
            btn.onclick = () => enterCase(c);
        }
        el.hotspots.appendChild(btn);
    });

    // Final Completion Check
    if (state.completedCases.length >= state.data.cases.length) {
        const finish = document.createElement('button');
        finish.className = 'img-btn';
        finish.innerHTML = `<img src="assets/ui/text_continue.png" alt="Finish">`;
        finish.style.position = 'absolute';
        finish.style.bottom = '300px';
        finish.style.left = '50%';
        finish.style.transform = 'translateX(-50%)';
        finish.onclick = () => el.finalScreen.classList.remove('hidden');
        el.hotspots.appendChild(finish);
    }
}

function enterCase(caseData) {
    state.currentScene = 'case';
    state.activeCase = caseData;
    state.viewedSources = []; // Reset viewed sources for this attempt
    
    el.bg.style.backgroundImage = `url('${caseData.background}')`;
    el.hotspots.innerHTML = '';
    el.dialogue.classList.remove('hidden');
    
    setDialogue(caseData.guideId, 'intro', caseData.id);

    // Render Source Hotspots
    caseData.hotspots.forEach(hs => {
        const h = document.createElement('div');
        h.className = 'hotspot';
        h.style.left = hs.x;
        h.style.top = hs.y;
        h.dataset.sourceId = hs.sourceId; // Store ID for visual tracking later
        h.onclick = () => openSource(hs.sourceId);
        el.hotspots.appendChild(h);
    });

    // Add a 'Return to Hub' Button
    const backBtn = document.createElement('button');
    backBtn.className = 'img-btn';
    backBtn.innerHTML = `<img src="assets/ui/text_back.png" alt="Back">`;
    backBtn.style.position = 'absolute';
    backBtn.style.top = '20px';
    backBtn.style.right = '20px';
    backBtn.onclick = renderHub;
    el.hotspots.appendChild(backBtn);
}

// --- DIALOGUE ---
function setDialogue(npcId, setKey, caseId = null) {
    const set = caseId ? state.data.dialogue.cases[caseId][setKey] : state.data.dialogue[setKey];
    
    if (!set || set.length === 0) {
        el.dialogue.classList.add('hidden');
        return;
    }

    state.currentDialogueSet = set;
    state.dialogueIndex = 0;
    
    // Look up the real name from the directory
    el.npcName.innerText = npcDirectory[npcId] || npcId.split('_')[0].toUpperCase();
    el.npcPortrait.src = `assets/portraits/${npcId}.png`;
    
    updateDialogueBox();
}

function updateDialogueBox() {
    el.text.innerText = state.currentDialogueSet[state.dialogueIndex];
    el.btnNext.classList.remove('hidden');

    // If it's the last line of dialogue, change the button to close it
    if (state.dialogueIndex >= state.currentDialogueSet.length - 1) {
        el.btnNext.innerHTML = `<img src="assets/ui/text_continue.png" alt="Done">`;
        el.btnNext.onclick = closeDialogue;
    } else {
        el.btnNext.innerHTML = `<img src="assets/ui/text_next.png" alt="Next">`;
        el.btnNext.onclick = advanceDialogue;
    }
}

function advanceDialogue() {
    state.dialogueIndex++;
    updateDialogueBox();
}

function closeDialogue() {
    el.dialogue.classList.add('hidden');
}

// --- SKILL ANALYSIS ---
function selectSkill(type, value, btn) {
    const parent = btn.parentElement;
    parent.querySelectorAll('.skill-btn').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
    state.currentAnalysis[type] = value;
}

function openSource(sourceId) {
    const source = state.data.sources.find(s => s.id === sourceId);
    if (!source) return;

    state.activeSource = source;
    state.currentAnalysis = { type: null, cat: null, insight: null };
    
    document.getElementById('source-title').innerText = source.title;
    
    const imgCont = document.getElementById('source-image-container');
    imgCont.innerHTML = source.image ? `<img src="${source.image}">` : '';
    
    document.getElementById('source-description').innerText = source.caption;
    document.getElementById('source-prompt').innerText = source.prompt;

    // Safely inject dynamic insight buttons
    let insightSection = document.getElementById('insight-section');
    if (!insightSection) {
        insightSection = document.createElement('div');
        insightSection.id = "insight-section";
        document.getElementById('analysis-ui').appendChild(insightSection);
    }
    
    insightSection.innerHTML = `
        <p><strong>3. Content Insight:</strong> ${source.insightQuestion}</p>
        <div class="analysis-row" id="insight-buttons"></div>
    `;

    source.insights.forEach(opt => {
        const b = document.createElement('button');
        b.className = 'skill-btn';
        b.innerText = opt;
        b.onclick = () => selectSkill('insight', opt, b);
        document.getElementById('insight-buttons').appendChild(b);
    });

    // Clear previous selections visually
    document.querySelectorAll('.skill-btn').forEach(b => b.classList.remove('selected'));
    el.sourceModal.classList.remove('hidden');
}

function closeSource() {
    const s = state.activeSource;
    
    // Form Validation
    if (!state.currentAnalysis.type || !state.currentAnalysis.cat || !state.currentAnalysis.insight) {
        alert("Researcher! Complete all three analysis steps before continuing.");
        return;
    }

    // Checking answers against JSON data arrays
    if (state.currentAnalysis.type !== s.correctType || 
        !s.correctCats.includes(state.currentAnalysis.cat) || 
        state.currentAnalysis.insight !== s.correctInsight) {
        alert("Your analysis doesn't quite match the evidence. Re-read the source text and try again!");
        return;
    }

    // Success! 
    el.sourceModal.classList.add('hidden');
    
    // Log success and visually update the hotspot
    if (!state.viewedSources.includes(s.id)) {
        state.viewedSources.push(s.id);
        const completedHotspot = document.querySelector(`[data-source-id="${s.id}"]`);
        if (completedHotspot) {
            completedHotspot.style.filter = 'grayscale(1) opacity(0.6)';
            completedHotspot.style.animation = 'none';
        }
    }
    
    // Check for case completion
    if (state.viewedSources.length >= 3) {
        setTimeout(showQuiz, 600); // Slight delay so they see the modal close first
    }
}

// --- QUIZ ---
function showQuiz() {
    const quiz = state.activeCase.completionQuestion;
    document.getElementById('quiz-question').innerText = quiz.question;
    
    const optCont = document.getElementById('quiz-options');
    optCont.innerHTML = '';
    
    quiz.options.forEach(opt => {
        const b = document.createElement('button');
        b.className = 'quiz-btn';
        b.innerText = opt;
        b.onclick = () => {
            if (opt === quiz.correct) {
                // Correct Summary
                state.completedCases.push(state.activeCase.id);
                el.quizModal.classList.add('hidden');
                el.progressText.innerText = `Cases Complete: ${state.completedCases.length}/3`;
                renderHub();
            } else {
                // Incorrect Summary
                alert("Incorrect. The museum requires accuracy. Think carefully about what the sources revealed.");
            }
        };
        optCont.appendChild(b);
    });
    
    el.quizModal.classList.remove('hidden');
}

init();
