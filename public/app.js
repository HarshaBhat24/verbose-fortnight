// Client State (In-Memory Stateless Design)
const state = {
  types: [],
  userContextSummary: '',
  history: [], // array of { question: string, answer: string }
  currentQuestion: '',
  turnCount: 0
};

// DOM Elements
const intakeSection = document.getElementById('intake-section');
const interviewSection = document.getElementById('interview-section');
const intakeForm = document.getElementById('intake-form');
const intakeDescription = document.getElementById('intake-description');
const startBtn = document.getElementById('start-btn');
const presetChips = document.querySelectorAll('.preset-chip');

const detectedTypesEl = document.getElementById('detected-types');
const contextSummaryText = document.getElementById('context-summary-text');
const resetBtn = document.getElementById('reset-btn');
const modelBadge = document.getElementById('model-badge');
const modelNameEl = document.getElementById('model-name');

const interviewFeed = document.getElementById('interview-feed');
const answerForm = document.getElementById('answer-form');
const answerInput = document.getElementById('answer-input');
const submitAnswerBtn = document.getElementById('submit-answer-btn');

const errorBanner = document.getElementById('error-banner');
const errorMessage = document.getElementById('error-message');
const closeError = document.getElementById('close-error');

// Event Listeners
presetChips.forEach(chip => {
  chip.addEventListener('click', () => {
    intakeDescription.value = chip.getAttribute('data-text');
    intakeDescription.focus();
  });
});

intakeForm.addEventListener('submit', handleStartInterview);
answerForm.addEventListener('submit', handleSubmitAnswer);
resetBtn.addEventListener('click', resetSession);
closeError.addEventListener('click', hideError);

// API Helpers
async function apiCall(endpoint, payload) {
  hideError();
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || `Server returned HTTP ${response.status}`);
  }
  return data;
}

// Handler: Start Interview
async function handleStartInterview(e) {
  e.preventDefault();
  const description = intakeDescription.value.trim();
  if (description.length < 10) {
    showError('Please provide a more detailed description (at least 10 characters).');
    return;
  }

  setLoading(startBtn, true);

  try {
    const res = await apiCall('/api/interview/start', { description });

    state.types = res.types || ['web_app'];
    state.userContextSummary = res.userContextSummary || description;
    state.history = [];
    state.turnCount = 1;

    // Display Model used
    if (res.modelUsed) {
      modelNameEl.textContent = res.modelUsed;
      modelBadge.classList.remove('hidden');
    }

    // Update Context Header
    renderContextBadges(state.types);
    contextSummaryText.textContent = state.userContextSummary;

    // Transition Views
    intakeSection.classList.add('hidden');
    interviewSection.classList.remove('hidden');

    // Extract first turn question
    const firstQuestion = res.firstTurn?.next_question || 'Can you walk me through your primary methodology on this target?';
    state.currentQuestion = firstQuestion;

    // Render turn 1 question card
    renderNewQuestionTurn(state.turnCount, firstQuestion);

  } catch (err) {
    showError(`Failed to start interview: ${err.message}`);
  } finally {
    setLoading(startBtn, false);
  }
}

// Handler: Submit Turn Answer
async function handleSubmitAnswer(e) {
  e.preventDefault();
  const answerText = answerInput.value.trim();
  if (!answerText) return;

  setLoading(submitAnswerBtn, true);

  try {
    const res = await apiCall('/api/interview/turn', {
      types: state.types,
      userContextSummary: state.userContextSummary,
      history: state.history,
      latestAnswer: answerText
    });

    const critiqueData = res.result || {};

    // 1. Render User's Answer in the active turn container
    renderUserAnswerInCurrentTurn(state.turnCount, answerText);

    // 2. Render Critique & Verdict in the active turn container
    renderFeedbackInCurrentTurn(state.turnCount, critiqueData);

    // 3. Save turn to client history
    state.history.push({
      question: state.currentQuestion,
      answer: answerText
    });

    // 4. Update model badge if available
    if (res.modelUsed) {
      modelNameEl.textContent = res.modelUsed;
    }

    // 5. Clear answer input
    answerInput.value = '';

    // 6. Spawn Next Question Turn if present
    if (critiqueData.next_question) {
      state.turnCount++;
      state.currentQuestion = critiqueData.next_question;
      renderNewQuestionTurn(state.turnCount, critiqueData.next_question);
    }

  } catch (err) {
    showError(`Failed to submit turn: ${err.message}`);
  } finally {
    setLoading(submitAnswerBtn, false);
  }
}

// UI Rendering Functions
function renderContextBadges(types) {
  detectedTypesEl.innerHTML = types
    .map(t => `<span class="type-badge">${escapeHtml(t)}</span>`)
    .join('');
}

function renderNewQuestionTurn(turnNum, questionText) {
  const turnDiv = document.createElement('div');
  turnDiv.className = 'turn-item';
  turnDiv.id = `turn-${turnNum}`;

  turnDiv.innerHTML = `
    <div class="card question-card">
      <div class="question-header">
        <span>⚡ Question ${turnNum}</span>
      </div>
      <div class="question-text">${escapeHtml(questionText)}</div>
    </div>
    <div class="user-answer-placeholder"></div>
    <div class="feedback-placeholder"></div>
  `;

  interviewFeed.appendChild(turnDiv);
  turnDiv.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function renderUserAnswerInCurrentTurn(turnNum, answerText) {
  const turnDiv = document.getElementById(`turn-${turnNum}`);
  if (!turnDiv) return;

  const placeholder = turnDiv.querySelector('.user-answer-placeholder');
  placeholder.innerHTML = `
    <div class="card user-answer-card">
      <div class="answer-header">Your Answer:</div>
      <div class="answer-text">${escapeHtml(answerText)}</div>
    </div>
  `;
}

function renderFeedbackInCurrentTurn(turnNum, feedback) {
  const turnDiv = document.getElementById(`turn-${turnNum}`);
  if (!turnDiv) return;

  const placeholder = turnDiv.querySelector('.feedback-placeholder');

  const verdict = feedback.verdict || 'graded';
  const verdictLabel = formatVerdictLabel(verdict);
  const rubricItem = feedback.rubric_item_addressed || 'General Scope';

  let feedbackContentHTML = '';

  if (feedback.flagged_claim) {
    feedbackContentHTML += `
      <div class="detail-block">
        <span class="detail-label">Flagged Claim:</span>
        <div class="detail-content">"${escapeHtml(feedback.flagged_claim)}"</div>
      </div>
    `;
  }

  if (feedback.why_wrong) {
    feedbackContentHTML += `
      <div class="detail-block">
        <span class="detail-label wrong-label">Critique / Gap Identified:</span>
        <div class="detail-content">${escapeHtml(feedback.why_wrong)}</div>
      </div>
    `;
  }

  if (feedback.what_a_strong_answer_includes) {
    feedbackContentHTML += `
      <div class="detail-block">
        <span class="detail-label strong-label">What a Strong Answer Includes:</span>
        <div class="detail-content">${escapeHtml(feedback.what_a_strong_answer_includes)}</div>
      </div>
    `;
  }

  placeholder.innerHTML = `
    <div class="card feedback-card">
      <div class="verdict-header">
        <span class="verdict-badge ${escapeHtml(verdict)}">${escapeHtml(verdictLabel)}</span>
        <span class="rubric-item">Rubric: ${escapeHtml(rubricItem)}</span>
      </div>
      <div class="feedback-details">
        ${feedbackContentHTML}
      </div>
    </div>
  `;
}

function formatVerdictLabel(verdict) {
  switch (verdict) {
    case 'correct': return '✓ Correct';
    case 'partially_correct': return '⚠️ Partially Correct';
    case 'incorrect': return '✗ Incorrect';
    case 'too_vague_to_grade': return '❓ Too Vague to Grade';
    default: return verdict.toUpperCase();
  }
}

// Reset Session
function resetSession() {
  state.types = [];
  state.userContextSummary = '';
  state.history = [];
  state.currentQuestion = '';
  state.turnCount = 0;

  interviewFeed.innerHTML = '';
  intakeDescription.value = '';
  answerInput.value = '';

  interviewSection.classList.add('hidden');
  intakeSection.classList.remove('hidden');
  hideError();
}

// Helpers
function setLoading(buttonEl, isLoading) {
  const btnText = buttonEl.querySelector('.btn-text');
  const spinner = buttonEl.querySelector('.spinner');
  buttonEl.disabled = isLoading;
  if (isLoading) {
    btnText.classList.add('hidden');
    spinner.classList.remove('hidden');
  } else {
    btnText.classList.remove('hidden');
    spinner.classList.add('hidden');
  }
}

function showError(msg) {
  errorMessage.textContent = msg;
  errorBanner.classList.remove('hidden');
  errorBanner.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function hideError() {
  errorBanner.classList.add('hidden');
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
