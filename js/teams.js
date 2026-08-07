/**
 * teams.js — Public team detail page (team.html?id=T1).
 */

(function () {
  const { qs, el, formatNumber, timeAgo } = ZTH.utils;

  function getTeamIdFromUrl() {
    return new URLSearchParams(window.location.search).get('id');
  }

  async function render() {
    const teamId = getTeamIdFromUrl();
    if (!teamId) {
      qs('#teamContent').innerHTML = '<div class="panel">No team selected. <a href="leaderboard.html">Back to leaderboard</a></div>';
      return;
    }
    try {
      const team = await ZTH.api.call('getTeamDetail', { teamId });
      document.title = team.name + ' — Zero to Hero';

      qs('#teamHero').innerHTML = '';
      qs('#teamHero').style.setProperty('--team-color', team.color || '#1D3557');
      qs('#teamHero').appendChild(el('div', { class: 'emblem', style: '--team-color:' + (team.color || '#1D3557') }, [team.name.slice(0, 1)]));
      const info = el('div', {}, [
        el('h1', {}, [team.name]),
        el('div', { class: 'text-muted' }, ['Mentor: ' + (team.mentor || '—') + '  •  Captain: ' + (team.captain || '—')])
      ]);
      qs('#teamHero').appendChild(info);
      qs('#teamHero').appendChild(el('div', { class: 'score-counter', style: 'margin-left:auto' }, [formatNumber(team.totalScore)]));

      const breakdown = qs('#breakdownGrid');
      breakdown.innerHTML = '';
      const parts = [
        ['Games', team.breakdown.games, 'games'],
        ['Bible', team.breakdown.bible, 'bible'],
        ['Individual', team.breakdown.individual, 'individual'],
        ['Mentor', team.breakdown.mentor, 'mentor']
      ];
      parts.forEach(([label, value, cls]) => {
        breakdown.appendChild(el('div', { class: 'stat-card' }, [
          el('div', { class: 'value' }, [formatNumber(value)]),
          el('div', { class: 'label' }, [el('span', { class: 'chip ' + cls }, [label])])
        ]));
      });

      const roster = qs('#rosterList');
      roster.innerHTML = '';
      if (!team.children.length) {
        roster.appendChild(el('li', {}, ['No campers assigned yet.']));
      } else {
        team.children.forEach((c) => roster.appendChild(el('li', {}, [c.name + (c.grade ? ' • Grade ' + c.grade : '')])));
      }

      const feed = qs('#teamActivityFeed');
      feed.innerHTML = '';
      if (!team.recentActivity.length) {
        feed.appendChild(el('div', { class: 'text-muted' }, ['No activity logged for this team yet.']));
      } else {
        team.recentActivity.forEach((a) => {
          feed.appendChild(el('div', { class: 'activity-item' }, [
            el('span', { class: 'chip ' + a.type.toLowerCase() }, [a.type]),
            el('span', {}, [a.text + (a.points ? ' (+' + a.points + ')' : '')]),
            el('span', { class: 'time' }, [timeAgo(a.timestamp)])
          ]));
        });
      }
    } catch (err) {
      qs('#teamContent').innerHTML = '<div class="panel">Could not load this team: ' + err.message + '</div>';
    }
  }

  document.addEventListener('DOMContentLoaded', render);
})();
