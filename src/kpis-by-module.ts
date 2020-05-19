import * as prompts from 'prompts';
import * as debug from 'debug';
import { getPrsInTimeWindow, PullRequest, isRevertPR, getPRCommits, PRCommit, PRFile, getPRFiles } from './pull-requests';
import { dateRangeQuestions } from './prompts-helper';

const logger = debug('redox:kpisByModule');

const repos = ['redox-services', 'RedoxEngine'];

interface PullRequestReportObject {
  pullRequest: PullRequest;
  commits: PRCommit[];
  files: PRFile[];
}
type PullRequestMap = Map<string, PullRequestReportObject>;
type PullRequestCommitMap = Map<string, PRCommit[]>;
type PullRequestFileMap = Map<string, PRFile[]>;

const isRedoxEnginePR = (pr: PullRequest): boolean => pr.url.includes('100health/RedoxEngine');
const isServicesPR = (files: PRFile[]) => files.some(file => file.filename.startsWith('services/'));
const isLibraryPR = (files: PRFile[]) => files.some(file => file.filename.startsWith('libraries/'));
const isPackagePR = (files: PRFile[]) => files.some(file => file.filename.startsWith('packages/'));

const getPrs = async (startDate: Date, endDate: Date) => {
  let prs: PullRequest[] = [];
  for (const repo of repos) {
    console.log(`Finding PRs in the 100health/${repo} repository...`);
    const allPrsInTimeWindow = await getPrsInTimeWindow(startDate, endDate, repo);
    logger(`Total of ${allPrsInTimeWindow.length} PRs in time window or ${repo} repository`);
    prs = prs.concat(allPrsInTimeWindow);
    console.log(`Done searching 100health/${repo}`);
  }
  return prs.filter(pr => !!pr.merged_at);
};

const getCommits = async (prs: PullRequest[]): Promise<PullRequestCommitMap> => {
  console.log(`Loading commit data...`);
  const allCommits = await Promise.all(prs.map(getPRCommits));
  const map: PullRequestCommitMap = new Map();
  prs.forEach((pr, index) => map.set(pr.url, allCommits[index]));
  console.log(`Done loading commit data...`);
  return map;
};

const getFiles = async (prs: PullRequest[]): Promise<PullRequestFileMap> => {
  console.log(`Loading file data...`);
  const allFiles = await Promise.all(prs.map(getPRFiles));
  const map: PullRequestFileMap = new Map();
  prs.forEach((pr, index) => map.set(pr.url, allFiles[index]));
  console.log(`Done loading commit data...`);
  return map;
};

const sortPRCommits = (prCommits: PRCommit[]) => 
  prCommits.sort((prCommitA, prCommitB) => +new Date(prCommitA.commit.committer.date) - +new Date(prCommitB.commit.committer.date));

const filterMasterMerges = (prCommits: PRCommit[]) => prCommits.filter(prCommit => !prCommit.commit.message.startsWith('Merge branch \'master\' '));

const getFirstCommitDateTime = (prCommits: PRCommit[]) => prCommits[0].commit.committer.date;
const getLastHumanCommitDateTime = (prCommits: PRCommit[]) => prCommits[prCommits.length - 1].commit.committer.date;

const getFieldsForPR = (prObj: PullRequestReportObject) => {
  const pr = prObj.pullRequest;
  const { html_url, title, created_at, merged_at } = pr;
  const commits = filterMasterMerges(sortPRCommits(prObj.commits));
  const firstCommitDateTime = getFirstCommitDateTime(commits);
  const lastCommitDateTime = getLastHumanCommitDateTime(commits);
  return [
    html_url,
    title.replace(',',''), // Get rid of comma's since we're using a comma delimiter
    created_at,
    merged_at,
    getFirstCommitDateTime(commits),
    getLastHumanCommitDateTime(commits),
    +new Date(lastCommitDateTime) - +new Date(firstCommitDateTime), // Cycle Time
    +new Date(pr.merged_at) - +new Date(lastCommitDateTime), // Lead Time
    isRedoxEnginePR(pr),
    isRedoxEnginePR(pr) ? false : isServicesPR(prObj.files),
    isRedoxEnginePR(pr) ? false : isLibraryPR(prObj.files),
    isRedoxEnginePR(pr) ? false : isPackagePR(prObj.files),
  ];
};

const reportData = (reportMap: PullRequestMap) => {
  console.log('\n\n');
  const columns = ['URL', 'Title', 'Created At', 'Merged At', 'Time of First Commit', 'Time of Last Commit', 'Cycle Time', 'Lead Time', 'RedoxEngine?', 'Service?', 'Library?', 'Package?'];
  console.log(columns.join(','));
  reportMap.forEach(prObj => console.log(getFieldsForPR(prObj).join(',')));
};

const run = async () => {
  const responses = await prompts(dateRangeQuestions);
  const prs = await getPrs(responses.startDate, responses.endDate);
  const [ commitMap, fileMap ] = await Promise.all([getCommits(prs), getFiles(prs)]);
  const reportMap: PullRequestMap = new Map();
  prs.forEach(pr =>
    reportMap.set(pr.url, {
      pullRequest: pr,
      commits: commitMap.get(pr.url),
      files: fileMap.get(pr.url)
    })
  )
  reportData(reportMap);
};

run();