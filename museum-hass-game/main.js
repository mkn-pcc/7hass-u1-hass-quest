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
        alert("Load Error: Check console.");
    }
}

function setupEventListeners() {
    document.getElementById('btn-start').onclick = startToHub;
    document.getElementById('btn-help').onclick = () => alert("Analyze 3 sources in each exhibit to complete the case file.");
    el.btnNext.onclick = advanceDialogue;
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
    el.dialogue.classList.remove('hidden');
    setDialogue('curator', state.completedCases.length === 0 ? 'hub_intro' : 'hub_return');

    state.data.cases.forEach((c, idx) => {
        const btn = document.createElement('div');
        btn.className = 'hotspot';
        btn.style.left = `${20 + (idx * 25)}%`;
        btn.style.top = `55%`;
        if (state.completedCases.includes(c.id)) {
            btn.style.filter = 'grayscale(1) brightness(0.5)';
            btn.innerHTML = `<img src="assets/ui/case_complete_stamp.png" style="width:100%">`;
        } else {
            btn.onclick = () => enterCase(c);
        }
        el.hotspots.appendChild(btn);
    });

    if (state.completedCases.length === 3) {
        const finish = document.createElement('button');
        finish.className = 'img-btn';
        finish.innerHTML = `<img src="assets/ui/text_continue.png">`;
        finish.style.position = 'absolute';
        finish.style.bottom = '300px';
        finish.style.left = '50%';
        finish.onclick = () => el.finalScreen.classList.remove('hidden');
        el.hotspots.appendChild(finish);
    }
}

function enterCase(caseData) {
    state.currentScene = 'case';
    state.activeCase = caseData;
    state.viewedSources = [];
    el.bg.style.backgroundImage = `url('${caseData.background}')`;
    el.hotspots.innerHTML = '';
    setDialogue(caseData.guideId, 'intro', caseData.id);

    caseData.hotspots.forEach(hs => {
        const h = document.createElement('div');
        h.className = 'hotspot';
        h.style.left = hs.x;
        h.style.top = hs.y;
        h.onclick = () => openSource(hs.sourceId);
        el.hotspots.appendChild(h);
    });
}

// --- DIALOGUE ---
function setDialogue(npcId, setKey, caseId = null) {
    const set = caseId ? state.data.dialogue.cases[caseId][setKey] : state.data.dialogue[setKey];
    state.currentDialogueSet = set;
    state.dialogueIndex = 0;
    el.npcName.innerText = npcId.split('_')[0].toUpperCase();
    el.npcPortrait.src = `assets/portraits/${npcId}.png`;
    updateDialogueBox();
}

function updateDialogueBox() {
    el.text.innerText = state.currentDialogueSet[state.dialogueIndex];
    el.btnNext.classList.toggle('hidden', state.dialogueIndex >= state.currentDialogueSet.length - 1);
}

function advanceDialogue() {
    state.dialogueIndex++;
    updateDialogueBox();
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

    // Render Insights
    const analysisArea = document.getElementById('analysis-ui');
    const insightSection = document.createElement('div');
    insightSection.id = "insight-section";
    insightSection.innerHTML = `
        <p><strong>3. Content Insight:</strong> ${source.insightQuestion}</p>
        <div class="analysis-row" id="insight-buttons"></div>
    `;
    
    // Clean up old sections
    const oldInsight = document.getElementById('insight-section');
    if (oldInsight) oldInsight.remove();
    analysisArea.appendChild(insightSection);

    source.insights.forEach(opt => {
        const b = document.createElement('button');
        b.className = 'skill-btn';
        b.innerText = opt;
        b.onclick = () => selectSkill('insight', opt, b);
        document.getElementById('insight-buttons').appendChild(b);
    });

    document.querySelectorAll('.skill-btn').forEach(b => b.classList.remove('selected'));
    el.sourceModal.classList.remove('hidden');
}

function closeSource() {
    const s = state.activeSource;
    if (!state.currentAnalysis.type || !state.currentAnalysis.cat || !state.currentAnalysis.insight) {
        alert("Researcher! Complete all 3 analysis steps first.");
        return;
    }

    if (state.currentAnalysis.type !== s.correctType || 
        !s.correctCats.includes(state.currentAnalysis.cat) || 
        state.currentAnalysis.insight !== s.correctInsight) {
        alert("Your analysis doesn't quite match the evidence. Check the text and try again!");
        return;
    }

    el.sourceModal.classList.add('hidden');
    if (!state.viewedSources.includes(s.id)) state.viewedSources.push(s.id);
    if (state.viewedSources.length === 3) setTimeout(showQuiz, 500);
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
                alert("Correct!");
                state.completedCases.push(state.activeCase.id);
                el.quizModal.classList.add('hidden');
                el.progressText.innerText = `Cases Complete: ${state.completedCases.length}/3`;
                renderHub();
            } else {
                alert("Incorrect. Re-examine the evidence.");
            }
        };
        optCont.appendChild(b);
    });
    el.quizModal.classList.remove('hidden');
}

init();
