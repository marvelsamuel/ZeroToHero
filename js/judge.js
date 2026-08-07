/**
 * judge.js — Judge scoring screens. One form per role, large touch targets,
 * minimal typing, one-click save with a success animation that resets the
 * form automatically so a judge can move straight to the next score.
 */

(function () {
  const { qs, qsa, el, toast } = ZTH.utils;

  let session = null;
  let lookups = { teams: [], children: [], mentors: [], defaults: {} };
  let mentorQuestions = [];

  // Per-form transient state
  const state = {
    gameTeamA: null, gameTeamB: null, gameWinner: null, gamePoints: 10,
    bibleTeam: null, biblePoints: 5,
    individualChildId: null, individualPoints: 5,
    mentorId: null, mentorAnswers: {}
  };

  const ROLE_FORM = {
    'Games Judge': 'game',
    'Bible Judge': 'bible',
    'Individual Judge': 'individual',
    'Mentor Judge': 'mentor'
  };

  async function init() {
    session = await ZTH.auth.requireSession(['Games Judge', 'Bible Judge', 'Individual Judge', 'Mentor Judge', 'Admin']);
    if (!session) return;

    qs('#judgeName').textContent = session.displayName || session.username;
    qs('#judgeRole').textContent = ZTH.auth.roleLabel(session.role);
    qs('#logoutBtn').addEventListener('click', async () => { await ZTH.auth.logout(); window.location.href = 'login.html'; });

    try {
      lookups = await ZTH.api.call('getScoringLookups', {});
      state.gamePoints = lookups.defaults.game;
      state.biblePoints = lookups.defaults.bible;
      state.individualPoints = lookups.defaults.individual;
    } catch (e) {
      toast('Could not load teams — refresh to try again.', 'error');
      return;
    }

    if (session.role === 'Mentor Judge' || session.role === 'Admin') {
      try { mentorQuestions = (await ZTH.api.call('getMentorQuestions', {})).questions; } catch (e) { /* ignore */ }
    }

    const formsToShow = session.role === 'Admin' ? Object.values(ROLE_FORM) : [ROLE_FORM[session.role]];
    setupTabs(formsToShow);
    renderActiveForm(formsToShow[0]);
  }

  function setupTabs(forms) {
    const tabWrap = qs('#judgeTabs');
    if (forms.length <= 1) { tabWrap.classList.add('hidden'); return; }
    tabWrap.innerHTML = '';
    const labels = { game: '🏆 Games', bible: '📖 Bible', individual: '⭐ Individual', mentor: '🧑‍🏫 Mentor' };
    forms.forEach((f, i) => {
      const btn = el('button', {
        class: 'tab-btn' + (i === 0 ? ' active' : ''),
        onclick: () => {
          qsa('.tab-btn', tabWrap).forEach((b) => b.classList.remove('active'));
          btn.classList.add('active');
          renderActiveForm(f);
        }
      }, [labels[f]]);
      tabWrap.appendChild(btn);
    });
  }

  function renderActiveForm(formName) {
    const mount = qs('#judgeFormMount');
    mount.innerHTML = '';
    if (formName === 'game') mount.appendChild(renderGameForm());
    if (formName === 'bible') mount.appendChild(renderBibleForm());
    if (formName === 'individual') mount.appendChild(renderIndividualForm());
    if (formName === 'mentor') mount.appendChild(renderMentorForm());
  }

  function teamButton(team, selectedId, onClick) {
    return el('button', {
      type: 'button',
      class: 'team-pick-btn' + (selectedId === team.teamId ? ' selected' : ''),
      style: '--team-color:' + (team.color || '#1D3557'),
      onclick: onClick
    }, [team.name]);
  }

  function pointsStepper(getValue, setValue, min, max) {
    const valueNode = el('div', { class: 'value' }, [String(getValue())]);
    const dec = el('button', { type: 'button', onclick: () => { setValue(Math.max(min, getValue() - 1)); valueNode.textContent = String(getValue()); } }, ['−']);
    const inc = el('button', { type: 'button', onclick: () => { setValue(Math.min(max, getValue() + 1)); valueNode.textContent = String(getValue()); } }, ['+']);
    return el('div', { class: 'points-stepper' }, [dec, valueNode, inc]);
  }

  // ---- GAME FORM ----------------------------------------------------------
  function renderGameForm() {
    const wrap = el('div', { class: 'panel judge-shell' });
    wrap.appendChild(el('div', { class: 'panel-header' }, [el('h2', {}, ['🏆 Game Score']), el('span', { class: 'eyebrow' }, ['GAMES'])]));

    wrap.appendChild(el('div', { class: 'field' }, [el('label', {}, ['Team A']),
      el('div', { class: 'team-picker' }, lookups.teams.map((t) => teamButton(t, state.gameTeamA, () => { state.gameTeamA = t.teamId; if (state.gameWinner && state.gameWinner !== t.teamId && state.gameWinner !== state.gameTeamB) state.gameWinner = null; renderActiveForm('game'); })))
    ]));
    wrap.appendChild(el('div', { class: 'field' }, [el('label', {}, ['Team B']),
      el('div', { class: 'team-picker' }, lookups.teams.map((t) => teamButton(t, state.gameTeamB, () => { state.gameTeamB = t.teamId; renderActiveForm('game'); })))
    ]));

    if (state.gameTeamA && state.gameTeamB && state.gameTeamA !== state.gameTeamB) {
      const winnerOptions = lookups.teams.filter((t) => t.teamId === state.gameTeamA || t.teamId === state.gameTeamB);
      wrap.appendChild(el('div', { class: 'field' }, [el('label', {}, ['Winner']),
        el('div', { class: 'team-picker' }, winnerOptions.map((t) => teamButton(t, state.gameWinner, () => { state.gameWinner = t.teamId; renderActiveForm('game'); })))
      ]));
    }

    wrap.appendChild(el('div', { class: 'field' }, [el('label', { class: 'text-center', style: 'display:block' }, ['Points']),
      pointsStepper(() => state.gamePoints, (v) => { state.gamePoints = v; }, 0, 100)
    ]));

    const notes = el('textarea', { placeholder: 'Optional notes…' });
    wrap.appendChild(el('div', { class: 'field' }, [el('label', {}, ['Notes']), notes]));

    wrap.appendChild(el('button', {
      class: 'btn btn-primary btn-lg btn-block', type: 'button',
      onclick: () => submitScore('submitGameScore', {
        teamA: state.gameTeamA, teamB: state.gameTeamB, winner: state.gameWinner,
        points: state.gamePoints, notes: notes.value
      }, () => { state.gameTeamA = null; state.gameTeamB = null; state.gameWinner = null; state.gamePoints = lookups.defaults.game; renderActiveForm('game'); })
    }, ['✅ Save Score']));

    return wrap;
  }

  // ---- BIBLE FORM ----------------------------------------------------------
  function renderBibleForm() {
    const wrap = el('div', { class: 'panel judge-shell' });
    wrap.appendChild(el('div', { class: 'panel-header' }, [el('h2', {}, ['📖 Bible Score']), el('span', { class: 'eyebrow' }, ['BIBLE'])]));

    wrap.appendChild(el('div', { class: 'field' }, [el('label', {}, ['Team']),
      el('div', { class: 'team-picker' }, lookups.teams.map((t) => teamButton(t, state.bibleTeam, () => { state.bibleTeam = t.teamId; renderActiveForm('bible'); })))
    ]));

    const activity = el('input', { type: 'text', placeholder: 'e.g. Memory verse recitation' });
    wrap.appendChild(el('div', { class: 'field' }, [el('label', {}, ['Activity']), activity]));

    wrap.appendChild(el('div', { class: 'field' }, [el('label', { class: 'text-center', style: 'display:block' }, ['Points']),
      pointsStepper(() => state.biblePoints, (v) => { state.biblePoints = v; }, 0, 100)
    ]));

    const notes = el('textarea', { placeholder: 'Optional notes…' });
    wrap.appendChild(el('div', { class: 'field' }, [el('label', {}, ['Notes']), notes]));

    wrap.appendChild(el('button', {
      class: 'btn btn-purple btn-lg btn-block', type: 'button',
      onclick: () => submitScore('submitBibleScore', {
        team: state.bibleTeam, activity: activity.value, points: state.biblePoints, notes: notes.value
      }, () => { state.bibleTeam = null; state.biblePoints = lookups.defaults.bible; renderActiveForm('bible'); })
    }, ['✅ Save Score']));

    return wrap;
  }

  // ---- INDIVIDUAL FORM ------------------------------------------------------
  function renderIndividualForm() {
    const wrap = el('div', { class: 'panel judge-shell' });
    wrap.appendChild(el('div', { class: 'panel-header' }, [el('h2', {}, ['⭐ Individual Challenge']), el('span', { class: 'eyebrow' }, ['INDIVIDUAL'])]));

    const childSelect = el('select', {}, [
      el('option', { value: '' }, ['Select a camper…']),
      ...lookups.children.map((c) => el('option', { value: c.childId, selected: state.individualChildId === c.childId ? 'selected' : undefined }, [c.name]))
    ]);
    childSelect.addEventListener('change', () => { state.individualChildId = childSelect.value; });
    wrap.appendChild(el('div', { class: 'field' }, [el('label', {}, ['Camper']), childSelect]));

    const task = el('input', { type: 'text', placeholder: 'e.g. Memorized 5 verses' });
    wrap.appendChild(el('div', { class: 'field' }, [el('label', {}, ['Task']), task]));

    wrap.appendChild(el('div', { class: 'field' }, [el('label', { class: 'text-center', style: 'display:block' }, ['Points']),
      pointsStepper(() => state.individualPoints, (v) => { state.individualPoints = v; }, 0, 100)
    ]));

    wrap.appendChild(el('button', {
      class: 'btn btn-green btn-lg btn-block', type: 'button',
      onclick: () => submitScore('submitIndividualScore', {
        childId: state.individualChildId, task: task.value, points: state.individualPoints
      }, () => { state.individualChildId = null; state.individualPoints = lookups.defaults.individual; childSelect.value = ''; renderActiveForm('individual'); })
    }, ['✅ Save Score']));

    return wrap;
  }

  // ---- MENTOR FORM ------------------------------------------------------
  function renderMentorForm() {
    const wrap = el('div', { class: 'panel judge-shell' });
    wrap.appendChild(el('div', { class: 'panel-header' }, [el('h2', {}, ['🧑\u200d🏫 Mentor Evaluation']), el('span', { class: 'eyebrow' }, ['MENTOR'])]));

    const mentorSelect = el('select', {}, [
      el('option', { value: '' }, ['Select a mentor…']),
      ...lookups.mentors.map((m) => el('option', { value: m.mentorId }, [m.name]))
    ]);
    mentorSelect.addEventListener('change', () => { state.mentorId = mentorSelect.value; });
    wrap.appendChild(el('div', { class: 'field' }, [el('label', {}, ['Mentor']), mentorSelect]));

    let runningTotal = 0;
    const totalNode = el('div', { class: 'score-counter text-center', style: 'display:block' }, ['0']);

    mentorQuestions.forEach((q) => {
      const block = el('div', { class: 'mentor-question-block' });
      block.appendChild(el('h4', {}, [q.question]));
      const pillGroup = el('div', { class: 'option-pill-group' });
      q.options.forEach((opt) => {
        const pill = el('button', {
          type: 'button', class: 'option-pill',
          onclick: () => {
            qsa('.option-pill', pillGroup).forEach((p) => p.classList.remove('selected'));
            pill.classList.add('selected');
            state.mentorAnswers[q.questionId] = opt.label;
            recomputeTotal();
          }
        }, [opt.label + ' (' + opt.score + ')']);
        pillGroup.appendChild(pill);
      });
      block.appendChild(pillGroup);
      wrap.appendChild(block);
    });

    function recomputeTotal() {
      let total = 0;
      mentorQuestions.forEach((q) => {
        const answer = state.mentorAnswers[q.questionId];
        const opt = q.options.find((o) => o.label === answer);
        if (opt) total += opt.score;
      });
      totalNode.textContent = String(total);
    }

    wrap.appendChild(el('div', { class: 'field mt-16' }, [el('label', {}, ['Running Total']), totalNode]));

    const notes = el('textarea', { placeholder: 'Optional notes…' });
    wrap.appendChild(el('div', { class: 'field' }, [el('label', {}, ['Notes']), notes]));

    wrap.appendChild(el('button', {
      class: 'btn btn-primary btn-lg btn-block', type: 'button',
      onclick: () => submitScore('submitMentorScore', {
        mentorId: state.mentorId, answers: state.mentorAnswers, notes: notes.value
      }, () => { state.mentorId = null; state.mentorAnswers = {}; mentorSelect.value = ''; renderActiveForm('mentor'); })
    }, ['✅ Save Evaluation']));

    return wrap;
  }

  // ---- SUBMIT + SUCCESS ANIMATION ---------------------------------------
  async function submitScore(action, payload, onDone) {
    const btns = qsa('.judge-shell .btn-lg');
    btns.forEach((b) => (b.disabled = true));
    try {
      const result = await ZTH.api.call(action, Object.assign({ token: session.token }, payload));
      showSuccessOverlay('+' + (result.points !== undefined ? result.points : '') + ' points saved!');
      toast('Score saved! 🎉', 'success');
      onDone();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      btns.forEach((b) => (b.disabled = false));
    }
  }

  function showSuccessOverlay(message) {
    const overlay = el('div', { class: 'modal-backdrop' }, [
      el('div', { class: 'panel modal-card text-center', style: 'padding:36px' }, [
        el('div', { class: 'success-check' }, ['✓']),
        el('h2', { class: 'mt-16' }, [message]),
        el('div', { class: 'text-muted mt-8' }, ['Ready for the next hero!'])
      ])
    ]);
    document.body.appendChild(overlay);
    setTimeout(() => overlay.remove(), 1100);
  }

  document.addEventListener('DOMContentLoaded', init);
})();
