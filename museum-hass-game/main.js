/**
 * 7 HASS: Skill Quest - Main Game Logic
 * Version 1.1 - Layout & Pathing Patch
 */

// --- 1. GAME STATE ---
let state = {
    currentScene: 'title',
    completedCases: [], // Stores IDs of finished cases
    activeCase: null,
    viewedSources: [], // Tracks source IDs viewed in current case
    dialogueIndex: 0,
    currentDialogueSet: null,
    data: {
        cases: null,
        dialogue: null,
        sources: null
    }
};

// --- 2. DOM ELEMENTS ---
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

// --- 3. INITIALIZATION ---
async function init() {
    console.log("Museum HASS Quest: Initializing...");

    try {
        // Fetch JSON data using relative paths
        const [casesRes, dialogueRes, sourcesRes] = await Promise.all([
            fetch('data/cases.json'),
            fetch('data/dialogue.json'),
            fetch('data/sources.json')
        ]);

        // Check if any fetch failed
        if (!casesRes.ok || !dialogueRes.ok || !sourcesRes.ok) {
            throw new Error("One or more JSON files failed to load. Check your 'data' folder name and file names.");
        }

        state.data.cases = await casesRes.json();
        state.data.dialogue = await dialogueRes.json();
        state.data.sources = await sourcesRes.json();
        
        console.log("Data loaded successfully.");
        
        setupEventListeners();
        showTitle();

    } catch (err) {
        console.error("CRITICAL ERROR:", err.message);
        alert("Game failed to load data. See Console (F12) for details.");
    }
}

function setupEventListeners() {
    document.getElementById('btn-start').onclick = startToHub;
    document.getElementById('btn-help').onclick = () => {
        alert("Junior Researcher: Your goal is to investigate all 3 exhibit cases.\n\n1. Click a case in the hub.\n2. Find and click 3 source hotspots in each room.\n3. Answer the final summary question for each case.\n4. Complete all cases to submit your report!");
    };
    el.btnNext.onclick = advanceDialogue;
    document.getElementById('btn-close-source').onclick = closeSource;
    document.getElementById('btn-replay').onclick = () => location.reload();
}

// --- 4. SCENE NAVIGATION ---

function showTitle() {
    el.bg.style.backgroundImage = `url('assets/backgrounds/title_bg.png')`;
}

function startToHub() {
    console.log("Entering Museum Hub...");
    state.currentScene = 'hub';
    state.activeCase = null;
    el.title.classList.add('hidden');
    el.progress.classList.remove('hidden');
    renderHub();
}

function renderHub() {
    // Reset visual state
    el.bg.style.backgroundImage = `url('assets/backgrounds/hub_bg.png')`;
    el.hotspots.innerHTML = '';
    el.hotspots.classList.remove('hidden');
    el.dialogue.classList.remove('hidden');
    
    // Set Curator Dialogue
    setDialogue('curator', state.completedCases.length === 0 ? 'hub_intro' : 'hub_return');

    // Render Case Selection Hotspots
    state.data.cases.forEach((c, idx) => {
        const btn = document.createElement('div');
        btn.className = 'hotspot';
        // Position them across the hub floor/stands
        btn.style.left = `${20 + (idx * 30)}%`;
        btn.style.top = `60%`;
        btn.title = `Exhibit: ${c.title}`;
        
        // Visual indicator if complete
        if (state.completedCases.includes(c.id)) {
            btn.style.filter = 'grayscale(1) brightness(0.7)';
            btn.innerHTML = `<img src="assets/ui/case_complete_stamp.png" style="width:100%; height:100%;">`;
        } else {
            btn.onclick = () => enterCase(c);
        }
        el.hotspots.appendChild(btn);
    });

    // Check for Final Completion
    if (state.completedCases.length === 3) {
        setDialogue('curator', 'hub_intro'); // Or a final success message if added to JSON
        const finalBtn = document.createElement('button');
        finalBtn.className = 'img-btn';
        finalBtn.innerHTML = `<img src="assets/ui/text_continue.png" alt="Submit Final Report">`;
        finalBtn.style.position = 'absolute';
        finalBtn.style.bottom = '320px'; // Sits above the dialogue box
        finalBtn.style.left = '50%';
        finalBtn.style.transform = 'translateX(-50%)';
        finalBtn.onclick = () => el.finalScreen.classList.remove('hidden');
        el.hotspots.appendChild(finalBtn);
    }
}

function enterCase(caseData) {
    console.log(`Entering Case: ${caseData.title}`);
    state.currentScene = 'case';
    state.activeCase = caseData;
    state.viewedSources = [];
    
    el.bg.style.backgroundImage = `url('${caseData.background}')`;
    el.hotspots.innerHTML = '';
    
    // Set specific guide for this case
    setDialogue(caseData.guideId, 'intro', caseData.id);

    // Create Source Hotspots based on JSON coordinates
    caseData.hotspots.forEach(hs => {
        const h = document.createElement('div');
        h.className = 'hotspot';
        h.style.left = hs.x;
        h.style.top = hs.y;
        h.onclick = () => openSource(hs.sourceId);
        el.hotspots.appendChild(h);
    });
}

// --- 5. DIALOGUE LOGIC ---

/**
 * @param {string} npcId - The filename (no extension) in assets/portraits/
 * @param {string} setKey - The key in dialogue.json (e.g., 'intro')
 * @param {string|null} caseId - Optional ID if looking inside cases object
 */
function setDialogue(npcId, setKey, caseId = null) {
    const set = caseId ? state.data.dialogue.cases[caseId][setKey] : state.data.dialogue[setKey];
    
    if (!set) {
        console.error(`Dialogue set not found for: ${npcId}, ${setKey}`);
        return;
    }

    state.currentDialogueSet = set;
    state.dialogueIndex = 0;
    
    // Update UI elements
    el.npcName.innerText = npcId.split('_')[0].toUpperCase(); // Prettify name
    el.npcPortrait.src = `assets/portraits/${npcId}.png`;
    
    // Safety check for portrait loading
    el.npcPortrait.onerror = () => {
        console.warn(`Portrait missing: assets/portraits/${npcId}.png`);
        el.npcPortrait.classList.add('hidden');
    };
    el.npcPortrait.onload = () => el.npcPortrait.classList.remove('hidden');

    updateDialogueBox();
}

function updateDialogueBox() {
    el.text.innerText = state.currentDialogueSet[state.dialogueIndex];
    
    // Show "Next" button only if there are more lines
    if (state.dialogueIndex < state.currentDialogueSet.length - 1) {
        el.btnNext.classList.remove('hidden');
    } else {
        el.btnNext.classList.add('hidden');
    }
}

function advanceDialogue() {
    state.dialogueIndex++;
    if (state.dialogueIndex < state.currentDialogueSet.length) {
        updateDialogueBox();
    }
}

// --- 6. SOURCE & QUIZ LOGIC ---

function openSource(sourceId) {
    const source = state.data.sources.find(s => s.id === sourceId);
    if (!source) return;

    console.log(`Inspecting Source: ${source.title}`);
    document.getElementById('source-title').innerText = source.title;
    document.getElementById('source-type').innerText = `${source.type} | ${source.sourceLabel}`;
    
    const imgCont = document.getElementById('source-image-container');
    imgCont.innerHTML = source.image ? `<img src="${source.image}" alt="${source.title}">` : '';
    
    document.getElementById('source-description').innerText = source.caption;
    document.getElementById('source-prompt').innerText = source.prompt;
    
    el.sourceModal.classList.remove('hidden');

    if (!state.viewedSources.includes(sourceId)) {
        state.viewedSources.push(sourceId);
    }
}

function closeSource() {
    el.sourceModal.classList.add('hidden');
    
    // Once all 3 hotspots in a room are clicked, trigger the final case question
    if (state.viewedSources.length === 3) {
        setTimeout(showQuiz, 500);
    }
}

function showQuiz() {
    const caseData = state.activeCase;
    const quiz = caseData.completionQuestion;
    
    document.getElementById('quiz-question').innerText = quiz.question;
    const optionsCont = document.getElementById('quiz-options');
    optionsCont.innerHTML = '';
    
    quiz.options.forEach(opt => {
        const b = document.createElement('button');
        b.className = 'quiz-btn';
        b.innerText = opt;
        b.onclick = () => handleQuizAnswer(opt, quiz.correct);
        optionsCont.appendChild(b);
    });
    
    el.quizModal.classList.remove('hidden');
}

function handleQuizAnswer(selected, correct) {
    if (selected === correct) {
        alert("Correct Interpretation! Case File complete.");
        state.completedCases.push(state.activeCase.id);
        el.quizModal.classList.add('hidden');
        el.progressText.innerText = `Cases Complete: ${state.completedCases.length}/3`;
        renderHub();
    } else {
        alert("Your interpretation doesn't quite match the evidence. Re-examine the sources!");
    }
}

// Start the game load
init();
