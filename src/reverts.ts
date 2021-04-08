import * as debug from 'debug';
import * as prompts from 'prompts';
import { getPrsInTimeWindow, PullRequest, isRevertPR } from './pull-requests';
import { dateRangeQuestions } from './prompts-helper';

const logger = debug('redox:reverts');

const repos = ['redox-services'];

const filterPrsToJustReverts = (prs: PullRequest[]) => {
  return prs.filter(isRevertPR);
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
  const responses = await prompts(dateRangeQuestions);
  const reverts = await getReverts(responses.startDate, responses.endDate);
  reportData(reverts);
};

run();
