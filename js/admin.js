/**
 * admin.js — Admin dashboard: overview stats, Teams/Children/Mentors/Users
 * CRUD, point-value config, mentor questionnaire editor, audit log, CSV
 * export, and global search. Everything routes through ZTH.api with the
 * session token; the server re-checks the Admin role on every call.
 */

(function () {
  const { qs, qsa, el, formatNumber } = ZTH.utils;
  let session = null;

  const TABS = [
    { id: 'overview', label: '📊 Overview' },
    { id: 'teams', label: '🛡️ Teams' },
    { id: 'children', label: '🧒 Campers' },
    { id: 'mentors', label: '🧑‍🏫 Mentors' },
    { id: 'users', label: '🔑 Users' },
    { id: 'scoring', label: '⚙️ Scoring Config' },
    { id: 'audit', label: '📜 Audit Log' },
    { id: 'export', label: '⬇️ Export' }
  ];

  async function init() {
    session = await ZTH.auth.requireSession(['Admin']);
    if (!session) return;
    qs('#adminName').textContent = session.displayName || session.username;
    qs('#logoutBtn').addEventListener('click', async () => { await ZTH.auth.logout(); window.location.href = 'login.html'; });

    const tabWrap = qs('#adminTabs');
    tabWrap.innerHTML = '';
    TABS.forEach((t, i) => {
      const btn = el('button', {
        class: 'tab-btn' + (i === 0 ? ' active' : ''),
        onclick: () => {
          qsa('.tab-btn', tabWrap).forEach((b) => b.classList.remove('active'));
          btn.classList.add('active');
          renderTab(t.id);
        }
      }, [t.label]);
      tabWrap.appendChild(btn);
    });
    renderTab('overview');

    const searchInput = qs('#globalSearch');
    searchInput.addEventListener('input', ZTH.utils.debounce(() => runSearch(searchInput.value), 350));
  }

  async function renderTab(tabId) {
    const mount = qs('#adminMount');
    mount.innerHTML = '<div class="flex" style="justify-content:center;padding:40px"><div class="spinner"></div></div>';
    try {
      if (tabId === 'overview') return renderOverview(mount);
      if (tabId === 'teams') return renderCrudTab(mount, 'team');
      if (tabId === 'children') return renderCrudTab(mount, 'child');
      if (tabId === 'mentors') return renderCrudTab(mount, 'mentor');
      if (tabId === 'users') return renderUsersTab(mount);
      if (tabId === 'scoring') return renderScoringConfigTab(mount);
      if (tabId === 'audit') return renderAuditTab(mount);
      if (tabId === 'export') return renderExportTab(mount);
    } catch (err) {
      mount.innerHTML = '';
      mount.appendChild(el('div', { class: 'panel' }, ['Error loading tab: ' + err.message]));
    }
  }

  // ---- OVERVIEW ------------------------------------------------------------
  async function renderOverview(mount) {
    const data = await ZTH.api.call('getAdminDashboard', { token: session.token });
    mount.innerHTML = '';
    const grid = el('div', { class: 'admin-grid' });
    const cards = [
      ['Total Teams', data.totalTeams],
      ['Total Points Awarded', formatNumber(data.totalPoints)],
      ['Games Played', data.gamesPlayed],
      ['Bible Activities', data.bibleActivities],
      ['Individual Activities', data.individualActivities],
      ['Mentor Evaluations', data.mentorEvaluations],
      ['Most Active Judge', data.mostActiveJudge ? data.mostActiveJudge.judge + ' (' + data.mostActiveJudge.count + ')' : '—'],
      ['Highest Scoring Team', data.highestScoringTeam ? data.highestScoringTeam.name + ' (' + data.highestScoringTeam.score + ')' : '—'],
      ['Lowest Scoring Team', data.lowestScoringTeam ? data.lowestScoringTeam.name + ' (' + data.lowestScoringTeam.score + ')' : '—']
    ];
    cards.forEach(([label, value]) => {
      grid.appendChild(el('div', { class: 'stat-card' }, [
        el('div', { class: 'value', style: 'font-size:1.3rem' }, [String(value)]),
        el('div', { class: 'label' }, [label])
      ]));
    });
    mount.appendChild(el('div', { class: 'panel' }, [el('h2', {}, ['Camp Overview']), grid]));
    mount.appendChild(renderUndoPanel());
  }

  function renderUndoPanel() {
    const panel = el('div', { class: 'panel mt-24' }, [
      el('h2', {}, ['Undo a Score']),
      el('p', { class: 'text-muted' }, ['Paste a score ID (visible in the Audit Log) to void it and reverse its points.'])
    ]);
    const category = el('select', {}, [
      el('option', { value: 'game' }, ['Game']),
      el('option', { value: 'bible' }, ['Bible']),
      el('option', { value: 'individual' }, ['Individual']),
      el('option', { value: 'mentor' }, ['Mentor'])
    ]);
    const idInput = el('input', { type: 'text', placeholder: 'Score ID, e.g. G-a1b2c3d4' });
    const row = el('div', { class: 'flex gap-12 flex-wrap mt-16' }, [category, idInput,
      el('button', {
        class: 'btn btn-primary', type: 'button',
        onclick: async () => {
          try {
            const result = await ZTH.api.call('undoScore', { token: session.token, category: category.value, id: idInput.value.trim() });
            ZTH.utils.toast('Undone — reversed ' + result.reversedPoints + ' pts from ' + result.team, 'success');
            idInput.value = '';
          } catch (err) { ZTH.utils.toast(err.message, 'error'); }
        }
      }, ['Undo Score'])
    ]);
    panel.appendChild(row);
    return panel;
  }

  // ---- GENERIC CRUD (Teams / Children / Mentors) ---------------------------
  const CRUD_CONFIG = {
    team: {
      title: 'Teams', listAction: 'listTeams', listKey: 'teams', saveAction: 'saveTeam', deleteAction: 'deleteTeam',
      idField: 'Team ID', payloadKey: 'team', deleteKey: 'teamId',
      columns: ['Team ID', 'Team Name', 'Color', 'Mentor', 'Captain', 'Total Score'],
      fields: [
        { key: 'Team Name', label: 'Team Name', type: 'text', required: true },
        { key: 'Color', label: 'Color (hex)', type: 'text' },
        { key: 'Logo URL', label: 'Logo URL', type: 'text' },
        { key: 'Mentor', label: 'Mentor', type: 'text' },
        { key: 'Captain', label: 'Captain', type: 'text' }
      ]
    },
    child: {
      title: 'Campers', listAction: 'listChildren', listKey: 'children', saveAction: 'saveChild', deleteAction: 'deleteChild',
      idField: 'Child ID', payloadKey: 'child', deleteKey: 'childId',
      columns: ['Child ID', 'Name', 'Grade', 'Team ID'],
      fields: [
        { key: 'Name', label: 'Name', type: 'text', required: true },
        { key: 'Grade', label: 'Grade', type: 'text' },
        { key: 'Team ID', label: 'Team ID (e.g. T1)', type: 'text' }
      ]
    },
    mentor: {
      title: 'Mentors', listAction: 'listMentors', listKey: 'mentors', saveAction: 'saveMentor', deleteAction: 'deleteMentor',
      idField: 'Mentor ID', payloadKey: 'mentor', deleteKey: 'mentorId',
      columns: ['Mentor ID', 'Name', 'Team ID'],
      fields: [
        { key: 'Name', label: 'Name', type: 'text', required: true },
        { key: 'Team ID', label: 'Team ID (e.g. T1)', type: 'text' }
      ]
    }
  };

  async function renderCrudTab(mount, kind) {
    const cfg = CRUD_CONFIG[kind];
    const data = await ZTH.api.call(cfg.listAction, { token: session.token });
    const rows = data[cfg.listKey];

    mount.innerHTML = '';
    const panel = el('div', { class: 'panel' });
    panel.appendChild(el('div', { class: 'crud-toolbar' }, [
      el('h2', {}, [cfg.title]),
      el('button', { class: 'btn btn-primary', type: 'button', onclick: () => openCrudModal(kind, null) }, ['+ Add New'])
    ]));

    const tableWrap = el('div', { class: 'table-scroll' });
    const table = el('table', { class: 'data-table' });
    table.appendChild(el('thead', {}, [el('tr', {}, cfg.columns.concat(['']).map((c) => el('th', {}, [c])))]));
    const tbody = el('tbody');
    rows.forEach((row) => {
      const tr = el('tr', {}, cfg.columns.map((c) => el('td', {}, [String(row[c] !== undefined ? row[c] : '')])));
      const actions = el('td', { class: 'flex gap-8' }, [
        el('button', { class: 'btn btn-ghost', style: 'padding:6px 12px;min-height:auto', type: 'button', onclick: () => openCrudModal(kind, row) }, ['Edit']),
        el('button', { class: 'btn btn-ghost', style: 'padding:6px 12px;min-height:auto;color:var(--hero-red)', type: 'button', onclick: () => deleteCrudRow(kind, row) }, ['Delete'])
      ]);
      tr.appendChild(actions);
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    tableWrap.appendChild(table);
    panel.appendChild(tableWrap);
    mount.appendChild(panel);
  }

  function openCrudModal(kind, existing) {
    const cfg = CRUD_CONFIG[kind];
    const backdrop = el('div', { class: 'modal-backdrop', onclick: (e) => { if (e.target === backdrop) backdrop.remove(); } });
    const card = el('div', { class: 'panel modal-card' });
    card.appendChild(el('h2', {}, [existing ? 'Edit' : 'Add'].concat([' ' + cfg.title.replace(/s$/, '')])));

    const inputs = {};
    cfg.fields.forEach((f) => {
      const input = el('input', { type: 'text', value: existing ? (existing[f.key] || '') : '' });
      inputs[f.key] = input;
      card.appendChild(el('div', { class: 'field' }, [el('label', {}, [f.label]), input]));
    });

    const errorBox = el('div', { class: 'form-error-banner hidden' });
    card.appendChild(errorBox);

    card.appendChild(el('div', { class: 'flex gap-12 mt-16' }, [
      el('button', {
        class: 'btn btn-primary btn-block', type: 'button',
        onclick: async () => {
          const obj = {};
          if (existing) obj[cfg.idField] = existing[cfg.idField];
          let missing = false;
          cfg.fields.forEach((f) => {
            obj[f.key] = inputs[f.key].value.trim();
            if (f.required && !obj[f.key]) missing = true;
          });
          if (missing) { errorBox.textContent = 'Please fill in all required fields.'; errorBox.classList.remove('hidden'); return; }
          try {
            const payload = { token: session.token };
            payload[cfg.payloadKey] = obj;
            await ZTH.api.call(cfg.saveAction, payload);
            ZTH.utils.toast('Saved!', 'success');
            backdrop.remove();
            renderTab(kind === 'team' ? 'teams' : kind === 'child' ? 'children' : 'mentors');
          } catch (err) {
            errorBox.textContent = err.message; errorBox.classList.remove('hidden');
          }
        }
      }, ['Save']),
      el('button', { class: 'btn btn-ghost', type: 'button', onclick: () => backdrop.remove() }, ['Cancel'])
    ]));

    backdrop.appendChild(card);
    document.body.appendChild(backdrop);
  }

  async function deleteCrudRow(kind, row) {
    const cfg = CRUD_CONFIG[kind];
    if (!confirm('Delete this ' + cfg.title.replace(/s$/, '') + '? This cannot be undone.')) return;
    try {
      const payload = { token: session.token };
      payload[cfg.deleteKey] = row[cfg.idField];
      await ZTH.api.call(cfg.deleteAction, payload);
      ZTH.utils.toast('Deleted.', 'success');
      renderTab(kind === 'team' ? 'teams' : kind === 'child' ? 'children' : 'mentors');
    } catch (err) { ZTH.utils.toast(err.message, 'error'); }
  }

  // ---- USERS ------------------------------------------------------------
  async function renderUsersTab(mount) {
    const { users } = await ZTH.api.call('listUsers', { token: session.token });
    mount.innerHTML = '';
    const panel = el('div', { class: 'panel' });
    panel.appendChild(el('div', { class: 'crud-toolbar' }, [
      el('h2', {}, ['Judge & Admin Accounts']),
      el('button', { class: 'btn btn-primary', type: 'button', onclick: () => openUserModal(null) }, ['+ Add User'])
    ]));
    const table = el('table', { class: 'data-table' });
    table.appendChild(el('thead', {}, [el('tr', {}, ['Username', 'Name', 'Role', 'Active', ''].map((c) => el('th', {}, [c])))]));
    const tbody = el('tbody');
    users.forEach((u) => {
      const tr = el('tr', {}, [
        el('td', {}, [u.username]), el('td', {}, [u.displayName]), el('td', {}, [u.role]), el('td', {}, [u.active ? 'Yes' : 'No']),
        el('td', { class: 'flex gap-8' }, [
          el('button', { class: 'btn btn-ghost', style: 'padding:6px 12px;min-height:auto', type: 'button', onclick: () => openUserModal(u) }, ['Edit']),
          el('button', { class: 'btn btn-ghost', style: 'padding:6px 12px;min-height:auto;color:var(--hero-red)', type: 'button', onclick: async () => {
            if (!confirm('Delete user ' + u.username + '?')) return;
            try { await ZTH.api.call('deleteUser', { token: session.token, username: u.username }); ZTH.utils.toast('Deleted.', 'success'); renderTab('users'); }
            catch (err) { ZTH.utils.toast(err.message, 'error'); }
          } }, ['Delete'])
        ])
      ]);
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    panel.appendChild(el('div', { class: 'table-scroll' }, [table]));
    mount.appendChild(panel);
  }

  function openUserModal(existing) {
    const backdrop = el('div', { class: 'modal-backdrop', onclick: (e) => { if (e.target === backdrop) backdrop.remove(); } });
    const card = el('div', { class: 'panel modal-card' });
    card.appendChild(el('h2', {}, [existing ? 'Edit User' : 'Add User']));

    const username = el('input', { type: 'text', value: existing ? existing.username : '', disabled: existing ? 'disabled' : undefined });
    const displayName = el('input', { type: 'text', value: existing ? existing.displayName : '' });
    const role = el('select', {}, ['Admin', 'Games Judge', 'Bible Judge', 'Individual Judge', 'Mentor Judge'].map((r) =>
      el('option', { value: r, selected: existing && existing.role === r ? 'selected' : undefined }, [r])));
    const password = el('input', { type: 'password', placeholder: existing ? 'Leave blank to keep current password' : 'Set a password' });
    const active = el('select', {}, [
      el('option', { value: 'true', selected: (!existing || existing.active) ? 'selected' : undefined }, ['Active']),
      el('option', { value: 'false', selected: (existing && !existing.active) ? 'selected' : undefined }, ['Inactive'])
    ]);

    card.appendChild(el('div', { class: 'field' }, [el('label', {}, ['Username']), username]));
    card.appendChild(el('div', { class: 'field' }, [el('label', {}, ['Display Name']), displayName]));
    card.appendChild(el('div', { class: 'field' }, [el('label', {}, ['Role']), role]));
    card.appendChild(el('div', { class: 'field' }, [el('label', {}, ['Password']), password]));
    card.appendChild(el('div', { class: 'field' }, [el('label', {}, ['Status']), active]));

    const errorBox = el('div', { class: 'form-error-banner hidden' });
    card.appendChild(errorBox);

    card.appendChild(el('div', { class: 'flex gap-12 mt-16' }, [
      el('button', {
        class: 'btn btn-primary btn-block', type: 'button',
        onclick: async () => {
          try {
            await ZTH.api.call('saveUser', {
              token: session.token,
              user: {
                username: username.value.trim(), displayName: displayName.value.trim(),
                role: role.value, active: active.value === 'true',
                password: password.value || undefined
              }
            });
            ZTH.utils.toast('Saved!', 'success');
            backdrop.remove();
            renderTab('users');
          } catch (err) { errorBox.textContent = err.message; errorBox.classList.remove('hidden'); }
        }
      }, ['Save']),
      el('button', { class: 'btn btn-ghost', type: 'button', onclick: () => backdrop.remove() }, ['Cancel'])
    ]));

    backdrop.appendChild(card);
    document.body.appendChild(backdrop);
  }

  // ---- SCORING CONFIG (point values + mentor questions) --------------------
  async function renderScoringConfigTab(mount) {
    const [{ config }, { questions }] = await Promise.all([
      ZTH.api.call('getConfig', { token: session.token }),
      ZTH.api.call('getMentorQuestions', { token: session.token })
    ]);
    mount.innerHTML = '';

    const configPanel = el('div', { class: 'panel' });
    configPanel.appendChild(el('h2', {}, ['Point Values & Settings']));
    const configInputs = [];
    config.forEach((c) => {
      const input = el('input', { type: 'text', value: c.Value });
      configInputs.push({ key: c.Key, input });
      configPanel.appendChild(el('div', { class: 'field' }, [el('label', {}, [c.Key + (c.Description ? ' — ' + c.Description : '')]), input]));
    });
    configPanel.appendChild(el('button', {
      class: 'btn btn-primary', type: 'button',
      onclick: async () => {
        try {
          await ZTH.api.call('saveConfig', { token: session.token, entries: configInputs.map((c) => ({ Key: c.key, Value: c.input.value })) });
          ZTH.utils.toast('Settings saved.', 'success');
        } catch (err) { ZTH.utils.toast(err.message, 'error'); }
      }
    }, ['Save Settings']));
    mount.appendChild(configPanel);

    const qPanel = el('div', { class: 'panel mt-24' });
    qPanel.appendChild(el('h2', {}, ['Mentor Evaluation Questions']));
    qPanel.appendChild(el('p', { class: 'text-muted' }, ['Edit questions and answer-option scores. Order controls display order on the judge form.']));

    const qState = questions.map((q) => ({
      questionId: q.questionId, question: q.question, order: q.order,
      options: q.options.map((o) => ({ label: o.label, score: o.score }))
    }));

    const qContainer = el('div', {});
    function renderQuestions() {
      qContainer.innerHTML = '';
      qState.forEach((q, qi) => {
        const block = el('div', { class: 'mentor-question-block' });
        const qInput = el('input', { type: 'text', value: q.question });
        qInput.addEventListener('input', () => { q.question = qInput.value; });
        block.appendChild(el('div', { class: 'field' }, [el('label', {}, ['Question ' + (qi + 1)]), qInput]));

        const optWrap = el('div', { class: 'flex gap-8 flex-wrap' });
        q.options.forEach((opt, oi) => {
          const labelInput = el('input', { type: 'text', value: opt.label, style: 'width:110px' });
          const scoreInput = el('input', { type: 'number', value: opt.score, style: 'width:70px' });
          labelInput.addEventListener('input', () => { opt.label = labelInput.value; });
          scoreInput.addEventListener('input', () => { opt.score = Number(scoreInput.value) || 0; });
          optWrap.appendChild(el('div', { class: 'flex gap-8' }, [labelInput, scoreInput,
            el('button', { class: 'btn btn-ghost', style: 'padding:6px 10px;min-height:auto', type: 'button', onclick: () => { q.options.splice(oi, 1); renderQuestions(); } }, ['✕'])
          ]));
        });
        block.appendChild(optWrap);
        block.appendChild(el('button', { class: 'btn btn-ghost mt-8', style: 'padding:6px 12px;min-height:auto', type: 'button', onclick: () => { q.options.push({ label: 'Option', score: 0 }); renderQuestions(); } }, ['+ Add Option']));
        block.appendChild(el('button', { class: 'btn btn-ghost mt-8', style: 'padding:6px 12px;min-height:auto;color:var(--hero-red)', type: 'button', onclick: () => { qState.splice(qi, 1); renderQuestions(); } }, ['Remove Question']));
        qContainer.appendChild(block);
      });
    }
    renderQuestions();
    qPanel.appendChild(qContainer);

    qPanel.appendChild(el('button', {
      class: 'btn btn-ghost mt-16', type: 'button',
      onclick: () => { qState.push({ questionId: 'Q' + (qState.length + 1) + '-' + Date.now(), question: 'New question', order: qState.length + 1, options: [{ label: 'Yes', score: 5 }, { label: 'No', score: 0 }] }); renderQuestions(); }
    }, ['+ Add Question']));

    qPanel.appendChild(el('button', {
      class: 'btn btn-primary mt-16 btn-block', type: 'button',
      onclick: async () => {
        try {
          qState.forEach((q, i) => { q.order = i + 1; });
          await ZTH.api.call('saveMentorQuestions', { token: session.token, questions: qState });
          ZTH.utils.toast('Mentor questionnaire saved.', 'success');
        } catch (err) { ZTH.utils.toast(err.message, 'error'); }
      }
    }, ['Save Mentor Questionnaire']));

    mount.appendChild(qPanel);
  }

  // ---- AUDIT LOG ------------------------------------------------------------
  async function renderAuditTab(mount) {
    const { entries } = await ZTH.api.call('getAuditLog', { token: session.token, limit: 300 });
    mount.innerHTML = '';
    const panel = el('div', { class: 'panel' });
    panel.appendChild(el('h2', {}, ['Audit Log']));
    const table = el('table', { class: 'data-table' });
    table.appendChild(el('thead', {}, [el('tr', {}, ['Timestamp', 'User', 'Action', 'Details'].map((c) => el('th', {}, [c])))]));
    const tbody = el('tbody');
    entries.forEach((e) => {
      tbody.appendChild(el('tr', {}, [
        el('td', {}, [new Date(e.Timestamp).toLocaleString()]),
        el('td', {}, [e.User]), el('td', {}, [e.Action]), el('td', {}, [e.Details])
      ]));
    });
    table.appendChild(tbody);
    panel.appendChild(el('div', { class: 'table-scroll' }, [table]));
    mount.appendChild(panel);
  }

  // ---- EXPORT ------------------------------------------------------------
  async function renderExportTab(mount) {
    mount.innerHTML = '';
    const panel = el('div', { class: 'panel' });
    panel.appendChild(el('h2', {}, ['Export Data']));
    panel.appendChild(el('p', { class: 'text-muted' }, ['Download any sheet as CSV — opens cleanly in Excel/Google Sheets, and the CSV can be printed as a PDF from there for a printable report.']));
    const grid = el('div', { class: 'flex gap-12 flex-wrap mt-16' });
    const categories = [
      ['teams', 'Teams'], ['children', 'Campers'], ['mentors', 'Mentors'],
      ['game', 'Game Scores'], ['bible', 'Bible Scores'], ['individual', 'Individual Scores'],
      ['mentorScores', 'Mentor Scores'], ['audit', 'Audit Log']
    ];
    categories.forEach(([key, label]) => {
      grid.appendChild(el('button', {
        class: 'btn btn-blue', type: 'button',
        onclick: async () => {
          try {
            const { csv, filename } = await ZTH.api.call('exportData', { token: session.token, category: key });
            downloadCsv(csv, filename);
          } catch (err) { ZTH.utils.toast(err.message, 'error'); }
        }
      }, ['⬇️ ' + label]));
    });
    panel.appendChild(grid);
    mount.appendChild(panel);
  }

  function downloadCsv(csv, filename) {
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  }

  // ---- SEARCH ------------------------------------------------------------
  async function runSearch(query) {
    const resultsBox = qs('#searchResults');
    if (!query || query.length < 2) { resultsBox.classList.add('hidden'); return; }
    try {
      const results = await ZTH.api.call('search', { token: session.token, query });
      resultsBox.classList.remove('hidden');
      resultsBox.innerHTML = '';
      const sections = [['Teams', results.teams], ['Campers', results.children], ['Mentors', results.mentors]];
      sections.forEach(([label, items]) => {
        if (!items.length) return;
        resultsBox.appendChild(el('div', { class: 'eyebrow mt-8' }, [label]));
        items.forEach((item) => resultsBox.appendChild(el('div', { class: 'activity-item' }, [item.name])));
      });
      if (!results.teams.length && !results.children.length && !results.mentors.length) {
        resultsBox.appendChild(el('div', { class: 'text-muted' }, ['No matches.']));
      }
    } catch (err) { /* ignore */ }
  }

  document.addEventListener('DOMContentLoaded', init);
})();
