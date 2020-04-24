import * as debug from 'debug';
import * as prompts from 'prompts';
import { getPrsInTimeWindow, PullRequest } from './pull-requests';

const logger = debug('redox:reverts');

const repos = ['redox-services', 'RedoxEngine', 'Alchemist', 'dashboard'];

const today = new Date(new Date().setHours(0, 0, 0, 0));
const oneMonthAgo = new Date(new Date(new Date().setMonth(today.getMonth() - 1)).setHours(0, 0,0,0));

const dateValidator = (date: Date) => date > today ? 'Not in the future' : true

const questions: prompts.PromptObject[] = [
  {
    type: 'date',
    name: 'startDate',
    message: 'Start of time range?',
    initial: oneMonthAgo,
    validate: dateValidator
  },
  {
    type: 'date',
    name: 'endDate',
    message: 'End of time range?',
    initial: today,
    validate: dateValidator
  }
];

const filterPrsToJustReverts = (prs: PullRequest[]) => {
  return prs.filter(pr => {
    if (!pr.merged_at) {
      return false;
    }

    if (pr.title.match(/.*revert.*/i)) {
      return true;
    }

    if (pr.body && pr.body.match(/Reverts\s100health\/.*#[0-9]*/)) {
      return true;
    }

    if (pr.head && pr.head.ref.match(/revert\-[0-9]*/)) {
      return true;
    }

    return false;
  });
}

const getReverts = async (startDate: Date, endDate: Date) => {
  let revertedPrs: PullRequest[] = [];
  for (const repo of repos) {
    console.log(`Finding PRs in the 100health/${repo} repository...`);
    const allPrsInTimeWindow = await getPrsInTimeWindow(startDate, endDate, repo);
    logger(`Total of ${allPrsInTimeWindow.length} PRs in time window or ${repo} repository`);
    const reverts = filterPrsToJustReverts(allPrsInTimeWindow);
    revertedPrs = revertedPrs.concat(reverts);
    console.log(`Done searching 100health/${repo}`);
  }
  
  return revertedPrs;
}

const reportData = (prs: PullRequest[]) => {
  console.log('\n\n');
  const columns = ['html_url', 'title', 'created_at', 'merged_at'];
  console.log(columns.join(','));
  for (const pr of prs) {
    const fields = columns.map(col => pr[col]);
    console.log(fields.join(','));
  }
}

const run = async () => {
  const responses = await prompts(questions);
  const reverts = await getReverts(responses.startDate, responses.endDate);
  reportData(reverts);
};

run();
