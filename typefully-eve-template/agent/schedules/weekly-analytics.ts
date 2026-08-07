import { defineSchedule } from "eve/schedules";

/**
 * Weekly Typefully analytics digest.
 *
 * @remarks
 * Fires every Monday at 14:00 UTC (Vercel evaluates cron in UTC; adjust the hour for your
 * team's timezone). Task mode runs the agent on the prompt below with the full tool surface;
 * the read-only analytics tools are not approval-gated, so the session never needs to park.
 * Delivery is the `post_analytics_report` tool, which posts to the channel in the
 * `TYPEFULLY_ANALYTICS_CHANNEL` environment variable, so this schedule needs no channel
 * handoff. Trigger it in dev with `curl -X POST http://localhost:3000/eve/v1/dev/schedules/weekly-analytics`.
 *
 * @see {@link https://eve.dev/docs/schedules | eve schedules}
 */
export default defineSchedule({
  cron: "0 14 * * 1",
  markdown: [
    "Post this week's Typefully analytics digest to the team.",
    "",
    "1. Call typefully_list_social_sets and pick the first social set to report on. Note its id and name.",
    "2. Call typefully_get_social_set_analytics_followers for that social set id.",
    "3. Call typefully_list_social_set_analytics_posts for that social set id.",
    "4. Build two tables from what those tools return, every cell a string:",
    "   - A followers table: one row per account or reporting period, with the follower counts and any change figures the tool provides.",
    "   - A posts table: one row per post, with an identifier or date, a column linking to the post (use the post URL or permalink the analytics tool returns; do not fabricate a URL), and the engagement metrics the tool provides (impressions, likes, reposts, and so on).",
    "   Use only fields the tools actually return; do not invent metrics. If there are no posts for the period, pass an empty posts table (no rows) so the report omits it rather than showing an empty table. For followers, if the tool returns nothing, use a single row that says there is no data for the period.",
    "5. Call post_analytics_report with a casual summary (1-2 sentences) that includes the social set and the period, the posts table, and the followers table.",
    "",
    "Do not post anything if the analytics tools error; let the run fail instead so the problem is visible.",
  ].join("\n"),
});
