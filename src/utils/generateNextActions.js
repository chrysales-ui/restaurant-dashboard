/**
 * Generates next action items based on live computed metrics.
 * @param {object} m       - output of compute()
 * @param {object} data    - raw restaurant data
 * @param {number} igVisits - IG profile visits for the 4W window
 * @returns {Array<{status, title, body}>}
 */
export function generateNextActions(m, data, igVisits = 0) {
  if (!m) return [];
  const actions = [];

  // ── Spend Per Cover efficiency ──────────────────────────────────────────
  if (m.cpcChg !== null && m.cpcChg !== undefined) {
    const chg = parseFloat(m.cpcChg);
    if (chg > 20) {
      actions.push({
        status: 'NEEDS REVIEW',
        title: 'Ad Efficiency Declining',
        body: `Spend per cover up ${chg}% vs prior 4 weeks ($${m.cpc.toFixed(2)} vs $${m.pcpc.toFixed(2)}) — review budget allocation.`,
      });
    } else if (chg < -20) {
      actions.push({
        status: 'ACTIVE',
        title: 'Efficiency Improving — Consider Scaling',
        body: `Spend per cover down ${Math.abs(chg)}% vs prior 4 weeks — strong signal to increase budget.`,
      });
    }
  }

  // ── Cover trend ─────────────────────────────────────────────────────────
  if (m.coversChg !== null && m.coversChg !== undefined) {
    const chg = parseFloat(m.coversChg);
    if (chg < -15) {
      actions.push({
        status: 'NEEDS REVIEW',
        title: 'Cover Count Declining',
        body: `Covers down ${Math.abs(chg)}% vs prior 4 weeks — check traffic sources and reservation funnel.`,
      });
    } else if (chg > 20) {
      actions.push({
        status: 'ACTIVE',
        title: 'Strong Cover Growth',
        body: `Covers up ${chg}% vs prior 4 weeks — current strategy is working.`,
      });
    }
  }

  // ── Meta CTR ────────────────────────────────────────────────────────────
  if (m.fbCtr !== null && m.fbCtr !== undefined && m.fb.impressions > 1000) {
    const ctr = parseFloat(m.fbCtr);
    if (ctr < 1.0) {
      actions.push({
        status: 'NEEDS REVIEW',
        title: 'Meta CTR Below 1%',
        body: `Current CTR is ${m.fbCtr}% — creative refresh or audience adjustment may improve performance.`,
      });
    }
  }

  // ── Meta CPC (link click cost) ──────────────────────────────────────────
  if (m.fbCpc !== null && m.fbCpc !== undefined) {
    const cpc = parseFloat(m.fbCpc);
    if (cpc > 2.0) {
      actions.push({
        status: 'NEEDS REVIEW',
        title: 'Meta Link Click Cost Elevated',
        body: `Cost per link click at $${m.fbCpc} — review audience targeting or ad creative.`,
      });
    }
  }

  // ── Meta → OpenTable reservations ───────────────────────────────────────
  if (m.fb?.otRes > 0) {
    actions.push({
      status: 'ACTIVE',
      title: 'Meta → OpenTable Tracking Active',
      body: `${m.fb.otRes} reservations attributed to Meta ads via pixel this period.`,
    });
  }

  // ── Cancellation / No-show rate ─────────────────────────────────────────
  const resSummary = data.reservations?.summary;
  if (resSummary?.total > 50) {
    if (resSummary.cancellationRate > 22) {
      actions.push({
        status: 'NEEDS REVIEW',
        title: 'High Cancellation Rate',
        body: `${resSummary.cancellationRate}% of reservations cancelled — consider deposit or reminder strategy.`,
      });
    }
    if (resSummary.noShowRate > 5) {
      actions.push({
        status: 'NEEDS REVIEW',
        title: 'No-Show Rate Elevated',
        body: `${resSummary.noShowRate}% no-show rate — SMS/email reminder sequence recommended.`,
      });
    }
  }

  // ── Web traffic trend ───────────────────────────────────────────────────
  if (m.usersChg !== null && m.usersChg !== undefined) {
    const chg = parseFloat(m.usersChg);
    if (chg < -20) {
      actions.push({
        status: 'NEEDS REVIEW',
        title: 'Web Traffic Declining',
        body: `Unique visitors down ${Math.abs(chg)}% vs prior 4 weeks — audit organic and paid sources.`,
      });
    } else if (chg > 30) {
      actions.push({
        status: 'ACTIVE',
        title: 'Web Traffic Surge',
        body: `Unique visitors up ${chg}% vs prior 4 weeks — ensure booking flow can handle demand.`,
      });
    }
  }

  // ── IG profile visits ───────────────────────────────────────────────────
  if (igVisits > 0 && m.c.covers > 0) {
    const igToBook = (m.c.covers / igVisits * 100).toFixed(1);
    if (parseFloat(igToBook) < 5) {
      actions.push({
        status: 'NEEDS REVIEW',
        title: 'Low IG → Booking Conversion',
        body: `Only ${igToBook}% of IG profile visitors converting to a cover — add booking link to bio/stories.`,
      });
    }
  }

  // Fallback if nothing flagged
  if (actions.length === 0) {
    actions.push({
      status: 'ACTIVE',
      title: 'All Metrics On Track',
      body: 'No significant issues detected this period — maintain current strategy.',
    });
  }

  return actions;
}
