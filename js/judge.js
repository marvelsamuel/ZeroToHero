/**
 * judge.js — Judge scoring screens. One form per role, large touch targets,
 * minimal typing, one-click save with a success animation that resets the
 * form automatically so a judge can move straight to the next score.
 *
 * Points for Games / Bible / Individual are FIXED by the admin — judges
 * cannot raise or lower them here, and the server enforces this
 * independently even if this file is bypassed. Solo Challenge points are a
 * pick from three admin-configured presets, also enforced server-side.
 */

(function () {
  const { qs, qsa, el, toast } = ZTH.utils;

  let session = null;
  let lookups = { teams: [], children: [], mentors: [], defaults: {}, solo: { enabled: false, pointOptions: [10, 15, 20] }, mentorBonusCap: 5 };
  let mentorQuestions = [];

  // Per-form transient state
  const state = {
    gameTeamA: null, gameTeamB: null, gameWinner: null,
    gameMentorAnswers: { teamA: {}, teamB: {} },
    bibleTeam: null,
    individualTeamId: null,
    soloTeamId: null, soloPoints: null,
    mentorId: null, mentorAnswers: {}
  };

  const ROLE_BASE_FORM = {
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
      lookups = await ZTH.api.call('getScoringLookups', { token: session.token });
    } catch (e) {
      toast('Could not load teams — refresh to try again.', 'error');
      return;
    }

    // Mentor questions are needed for the Mentor form AND for the in-game
    // mentor bonus on the Games form, so fetch them for any role that might
    // touch either.
    const needsMentorQuestions = ['Mentor Judge', 'Games Judge', 'Admin'].indexOf(session.role) !== -1;
    if (needsMentorQuestions) {
      try { mentorQuestions = (await ZTH.api.call('getMentorQuestions', { token: session.token })).questions; } catch (e) { /* ignore */ }
    }

    const forms = buildFormList(session.role);
    setupTabs(forms);
    renderActiveForm(forms[0]);
  }

  function buildFormList(role) {
    if (role === 'Admin') {
      return lookups.solo.enabled ? ['game', 'solo', 'bible', 'individual', 'mentor'] : ['game', 'bible', 'individual', 'mentor'];
    }
    if (role === 'Games Judge') {
      return lookups.solo.enabled ? ['game', 'solo'] : ['game'];
    }
    return [ROLE_BASE_FORM[role]];
  }

  function setupTabs(forms) {
    const tabWrap = qs('#judgeTabs');
    if (forms.length <= 1) { tabWrap.classList.add('hidden'); return; }
    tabWrap.classList.remove('hidden');
    tabWrap.innerHTML = '';
    const labels = { game: '🏆 Games', solo: '🎯 Solo Challenge', bible: '📖 Bible', individual: '⭐ Individual', mentor: '🧑‍🏫 Mentor' };
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
    if (formName === 'solo') mount.appendChild(renderSoloForm());
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

  function fixedPointsBadge(amount, cls) {
    return el('div', { class: 'text-center mt-8 mb-16' }, [
      el('span', { class: 'chip ' + (cls || '') }, ['This awards a fixed ' + amount + ' points'])
    ]);
  }

  /** Renders a mentor question set as tappable pill groups; calls onChangeTotal() as selections change. */
  function renderMentorQuestionPicker(answersState, onChangeTotal) {
    const wrap = el('div', {});
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
            answersState[q.questionId] = opt.label;
            onChangeTotal();
          }
        }, [opt.label + ' (' + opt.score + ')']);
        pillGroup.appendChild(pill);
      });
      block.appendChild(pillGroup);
      wrap.appendChild(block);
    });
    return wrap;
  }

  function computeMentorTotal(answersState) {
    let total = 0;
    mentorQuestions.forEach((q) => {
      const answer = answersState[q.questionId];
      const opt = q.options.find((o) => o.label === answer);
      if (opt) total += opt.score;
    });
    return total;
  }

  // ---- GAME FORM (1v1, fixed points, optional mentor bonus per team) -----
  function renderGameForm() {
    const wrap = el('div', { class: 'panel judge-shell' });
    wrap.appendChild(el('div', { class: 'panel-header' }, [el('h2', {}, ['🏆 Game Score']), el('span', { class: 'eyebrow' }, ['GAMES'])]));
    wrap.appendChild(fixedPointsBadge(lookups.defaults.game, 'games'));

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

      if (mentorQuestions.length) {
        const teamAName = (lookups.teams.find((t) => t.teamId === state.gameTeamA) || {}).name || 'Team A';
        const teamBName = (lookups.teams.find((t) => t.teamId === state.gameTeamB) || {}).name || 'Team B';

        [['teamA', teamAName], ['teamB', teamBName]].forEach(([key, name]) => {
          const totalNode = el('span', {}, ['0']);
          const picker = renderMentorQuestionPicker(state.gameMentorAnswers[key], () => {
            const capped = Math.min(computeMentorTotal(state.gameMentorAnswers[key]), lookups.mentorBonusCap);
            totalNode.textContent = String(capped);
          });
          const details = el('details', { class: 'panel mt-16', style: 'box-shadow:none;' }, [
            el('summary', { style: 'cursor:pointer;font-weight:800;' }, ['🧑\u200d🏫 Optional: ' + name + ' mentor bonus (up to ' + lookups.mentorBonusCap + ' pts) — ', totalNode]),
            picker
          ]);
          wrap.appendChild(details);
        });
      }
    }

    const notes = el('textarea', { placeholder: 'Optional notes…' });
    wrap.appendChild(el('div', { class: 'field' }, [el('label', {}, ['Notes']), notes]));

    wrap.appendChild(el('button', {
      class: 'btn btn-primary btn-lg btn-block', type: 'button',
      onclick: () => submitScore('submitGameScore', {
        teamA: state.gameTeamA, teamB: state.gameTeamB, winner: state.gameWinner, notes: notes.value,
        mentorBonus: { teamA: state.gameMentorAnswers.teamA, teamB: state.gameMentorAnswers.teamB }
      }, (result) => {
        state.gameTeamA = null; state.gameTeamB = null; state.gameWinner = null;
        state.gameMentorAnswers = { teamA: {}, teamB: {} };
        renderActiveForm('game');
        return result;
      })
    }, ['✅ Save Score']));

    return wrap;
  }

  // ---- SOLO CHALLENGE FORM (last-day, one team at a time, preset points) --
  function renderSoloForm() {
    const wrap = el('div', { class: 'panel judge-shell' });
    wrap.appendChild(el('div', { class: 'panel-header' }, [el('h2', {}, ['🎯 Solo Challenge']), el('span', { class: 'eyebrow' }, ['LAST DAY GAMES'])]));
    wrap.appendChild(el('p', { class: 'text-muted mt-8' }, ['For challenges where only one team performs at a time — pick the team, then their score based on performance.']));

    wrap.appendChild(el('div', { class: 'field mt-16' }, [el('label', {}, ['Team']),
      el('div', { class: 'team-picker' }, lookups.teams.map((t) => teamButton(t, state.soloTeamId, () => { state.soloTeamId = t.teamId; renderActiveForm('solo'); })))
    ]));

    const activity = el('input', { type: 'text', placeholder: 'e.g. Obstacle course' });
    wrap.appendChild(el('div', { class: 'field' }, [el('label', {}, ['Activity']), activity]));

    wrap.appendChild(el('div', { class: 'field' }, [el('label', { class: 'text-center', style: 'display:block' }, ['Points (based on performance)']),
      el('div', { class: 'flex gap-12', style: 'justify-content:center;flex-wrap:wrap;' },
        lookups.solo.pointOptions.map((p) => el('button', {
          type: 'button',
          class: 'team-pick-btn' + (state.soloPoints === p ? ' selected' : ''),
          style: state.soloPoints === p ? '--team-color:#2EC4B6' : '',
          onclick: () => { state.soloPoints = p; renderActiveForm('solo'); }
        }, [String(p) + ' pts'])))
    ]));

    const notes = el('textarea', { placeholder: 'Optional notes…' });
    wrap.appendChild(el('div', { class: 'field' }, [el('label', {}, ['Notes']), notes]));

    wrap.appendChild(el('button', {
      class: 'btn btn-green btn-lg btn-block', type: 'button',
      onclick: () => submitScore('submitSoloGameScore', {
        teamId: state.soloTeamId, activity: activity.value, points: state.soloPoints, notes: notes.value
      }, () => { state.soloTeamId = null; state.soloPoints = null; renderActiveForm('solo'); })
    }, ['✅ Save Score']));

    return wrap;
  }

  // ---- BIBLE FORM (fixed points) ------------------------------------------
  function renderBibleForm() {
    const wrap = el('div', { class: 'panel judge-shell' });
    wrap.appendChild(el('div', { class: 'panel-header' }, [el('h2', {}, ['📖 Bible Score']), el('span', { class: 'eyebrow' }, ['BIBLE'])]));
    wrap.appendChild(fixedPointsBadge(lookups.defaults.bible, 'bible'));

    wrap.appendChild(el('div', { class: 'field' }, [el('label', {}, ['Team']),
      el('div', { class: 'team-picker' }, lookups.teams.map((t) => teamButton(t, state.bibleTeam, () => { state.bibleTeam = t.teamId; renderActiveForm('bible'); })))
    ]));

    const activity = el('input', { type: 'text', placeholder: 'e.g. Memory verse recitation' });
    wrap.appendChild(el('div', { class: 'field' }, [el('label', {}, ['Activity']), activity]));

    const notes = el('textarea', { placeholder: 'Optional notes…' });
    wrap.appendChild(el('div', { class: 'field' }, [el('label', {}, ['Notes']), notes]));

    wrap.appendChild(el('button', {
      class: 'btn btn-purple btn-lg btn-block', type: 'button',
      onclick: () => submitScore('submitBibleScore', {
        team: state.bibleTeam, activity: activity.value, notes: notes.value
      }, () => { state.bibleTeam = null; renderActiveForm('bible'); })
    }, ['✅ Save Score']));

    return wrap;
  }

  // ---- INDIVIDUAL FORM (team-only, fixed points) ---------------------------
  function renderIndividualForm() {
    const wrap = el('div', { class: 'panel judge-shell' });
    wrap.appendChild(el('div', { class: 'panel-header' }, [el('h2', {}, ['⭐ Individual Challenge']), el('span', { class: 'eyebrow' }, ['INDIVIDUAL'])]));
    wrap.appendChild(fixedPointsBadge(lookups.defaults.individual, 'individual'));

    wrap.appendChild(el('div', { class: 'field' }, [el('label', {}, ['Team']),
      el('div', { class: 'team-picker' }, lookups.teams.map((t) => teamButton(t, state.individualTeamId, () => { state.individualTeamId = t.teamId; renderActiveForm('individual'); })))
    ]));

    const task = el('input', { type: 'text', placeholder: 'e.g. Memorized 5 verses' });
    wrap.appendChild(el('div', { class: 'field' }, [el('label', {}, ['Task']), task]));

    wrap.appendChild(el('button', {
      class: 'btn btn-green btn-lg btn-block', type: 'button',
      onclick: () => submitScore('submitIndividualScore', {
        teamId: state.individualTeamId, task: task.value
      }, () => { state.individualTeamId = null; renderActiveForm('individual'); })
    }, ['✅ Save Score']));

    return wrap;
  }

  // ---- MENTOR FORM (full evaluation, weighted by admin-configured questions) --
  function renderMentorForm() {
    const wrap = el('div', { class: 'panel judge-shell' });
    wrap.appendChild(el('div', { class: 'panel-header' }, [el('h2', {}, ['🧑\u200d🏫 Mentor Evaluation']), el('span', { class: 'eyebrow' }, ['MENTOR'])]));

    const mentorSelect = el('select', {}, [
      el('option', { value: '' }, ['Select a mentor…']),
      ...lookups.mentors.map((m) => el('option', { value: m.mentorId }, [m.name]))
    ]);
    mentorSelect.addEventListener('change', () => { state.mentorId = mentorSelect.value; });
    wrap.appendChild(el('div', { class: 'field' }, [el('label', {}, ['Mentor']), mentorSelect]));

    const totalNode = el('div', { class: 'score-counter text-center', style: 'display:block' }, ['0']);
    wrap.appendChild(renderMentorQuestionPicker(state.mentorAnswers, () => { totalNode.textContent = String(computeMentorTotal(state.mentorAnswers)); }));
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
      const pts = result.points !== undefined ? result.points : '';
      showSuccessOverlay('+' + pts + ' points saved!');
      toast('Score saved! 🎉', 'success');
      onDone(result);
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
