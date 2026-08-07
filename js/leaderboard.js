/**
 * leaderboard.js — Public leaderboard page. No login required. Polls the
 * backend every few seconds and re-renders, animating score changes and
 * firing confetti when the #1 team changes.
 */

(function () {
  const { qs, el, formatNumber, animateCounter, timeAgo } = ZTH.utils;

  let lastScores = {};
  let lastLeaderId = null;
  let refreshTimer = null;

  function rankClass(index) {
    if (index === 0) return 'gold';
    if (index === 1) return 'silver';
    if (index === 2) return 'bronze';
    return 'plain';
  }

  function rankLabel(index) {
    return index === 0 ? '1st' : index === 1 ? '2nd' : index === 2 ? '3rd' : String(index + 1);
  }

  function renderTeams(teams) {
    const grid = qs('#leaderboardGrid');
    grid.innerHTML = '';
    teams.forEach((team, index) => {
      const row = el('a', {
        class: 'team-row' + (index === 0 ? ' rank-1' : ''),
        href: 'team.html?id=' + encodeURIComponent(team.teamId)
      }, [
        el('div', { class: 'rank-burst ' + rankClass(index) }, [rankLabel(index)]),
        el('div', { class: 'team-color-bar', style: '--team-color:' + (team.color || '#1D3557') }),
        el('div', {}, [
          el('div', { class: 'team-name' }, [(index === 0 ? '👑 ' : '') + team.name]),
          el('div', { class: 'team-meta' }, ['Mentor: ' + (team.mentor || '—')])
        ]),
        el('div', { class: 'score-col' }, [
          el('div', { class: 'score-counter', id: 'score-' + team.teamId }, [formatNumber(team.totalScore)])
        ])
      ]);
      grid.appendChild(row);

      const prev = lastScores[team.teamId];
      if (prev !== undefined && prev !== team.totalScore) {
        const node = qs('#score-' + team.teamId);
        animateCounter(node, prev, team.totalScore, 700);
        node.classList.add('pulse');
        setTimeout(() => node.classList.remove('pulse'), 550);
      }
      lastScores[team.teamId] = team.totalScore;
    });

    const newLeaderId = teams[0] && teams[0].teamId;
    if (lastLeaderId && newLeaderId && newLeaderId !== lastLeaderId) {
      ZTH.utils.confetti(90);
      ZTH.utils.toast('🎉 New leader: ' + teams[0].name + '!', 'success');
    }
    lastLeaderId = newLeaderId;
  }

  async function renderStats() {
    try {
      const stats = await ZTH.api.call('getPublicStats', {});
      const strip = qs('#statStrip');
      strip.innerHTML = '';
      strip.appendChild(statCard(stats.leader ? stats.leader.name : '—', 'Current Leader'));
      strip.appendChild(statCard(String(stats.scoresToday), 'Scores Logged Today'));
      strip.appendChild(statCard(stats.biggestScoreToday ? '+' + stats.biggestScoreToday.points : '—', 'Biggest Score Today'));
      strip.appendChild(statCard(String(stats.totalTeams), 'Teams Competing'));
    } catch (e) { /* stats are non-critical */ }
  }

  function statCard(value, label) {
    return el('div', { class: 'stat-card' }, [
      el('div', { class: 'value' }, [value]),
      el('div', { class: 'label' }, [label])
    ]);
  }

  async function renderActivity() {
    try {
      const { activity } = await ZTH.api.call('getRecentActivity', { limit: 10 });
      const feed = qs('#activityFeed');
      feed.innerHTML = '';
      if (!activity.length) {
        feed.appendChild(el('div', { class: 'text-muted' }, ['No activity yet — the first score of the day is coming soon!']));
        return;
      }
      activity.forEach((a) => {
        feed.appendChild(el('div', { class: 'activity-item' }, [
          el('span', { class: 'chip ' + a.type.toLowerCase() }, [a.type]),
          el('span', {}, [a.text]),
          el('span', { class: 'time' }, [timeAgo(a.timestamp)])
        ]));
      });
    } catch (e) { /* non-critical */ }
  }

  async function refresh() {
    try {
      const { teams } = await ZTH.api.call('getLeaderboard', {});
      renderTeams(teams);
      qs('#lastUpdated').textContent = 'Updated ' + new Date().toLocaleTimeString();
    } catch (err) {
      qs('#lastUpdated').textContent = 'Connection issue — retrying…';
    }
  }

  function startPolling() {
    refresh();
    renderStats();
    renderActivity();
    const seconds = (window.ZTH_CONFIG && window.ZTH_CONFIG.LEADERBOARD_REFRESH_SECONDS) || 8;
    refreshTimer = setInterval(() => { refresh(); renderStats(); renderActivity(); }, seconds * 1000);
  }

  function initProjectorToggle() {
    const btn = qs('#projectorToggle');
    if (!btn) return;
    btn.addEventListener('click', () => {
      document.body.classList.toggle('projector-mode');
      const isOn = document.body.classList.contains('projector-mode');
      btn.textContent = isOn ? '🖥️ Exit Projector Mode' : '🖥️ Projector Mode';
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    initProjectorToggle();
    startPolling();
  });
})();
