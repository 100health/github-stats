import * as prompts from 'prompts';
import * as debug from 'debug';
import { getPrsInTimeWindow, PullRequest, isRevertPR, getPRCommits, PRCommit, PRFile, getPRFiles } from './pull-requests';
import { dateRangeQuestions } from './prompts-helper';

const logger = debug('redox:kpisByModule');

const repos = ['redox-services'];

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

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

function chunkArray<T>(array: T[], chunkSize: number = 10): Array<T[]> {
  const chunkedArray = [];
  let index = 0;
  while (index < array.length) {
    chunkedArray.push(array.slice(index, chunkSize + index));
    index += chunkSize;
  }
  return chunkedArray;
}

const getCommits = async (prs: PullRequest[]): Promise<PullRequestCommitMap> => {
  console.log(`Loading commit data for ${prs.length} PRs`);
  const map: PullRequestCommitMap = new Map();

  const chunkedPRList = chunkArray(prs);

  for (const chunk of chunkedPRList) {
    const commits = await Promise.all(chunk.map(getPRCommits));
    chunk.forEach((pr, index) => map.set(pr.url, commits[index]));
    console.log(`Loaded commit data for ${chunk.length} PRs`);
    await sleep(1000);
  }

  console.log(`Done loading commit data...`);
  return map;
};

const getFiles = async (prs: PullRequest[]): Promise<PullRequestFileMap> => {
  console.log(`Loading file data for ${prs.length}...`);
  const map: PullRequestFileMap = new Map();
  const chunkedPRList = chunkArray(prs);
  for (const chunk of chunkedPRList) {
    const files = await Promise.all(chunk.map(getPRFiles));
    chunk.forEach((pr, index) => map.set(pr.url, files[index]));
    console.log(`Loaded file data for ${chunk.length} PRs`);
    await sleep(1000);
  }
  console.log(`Done loading file data...`);
  return map;
};

const sortPRCommits = (prCommits: PRCommit[]) => 
  prCommits.sort((prCommitA, prCommitB) => +new Date(prCommitA.commit.author.date) - +new Date(prCommitB.commit.author.date));

const filterMasterMerges = (prCommits: PRCommit[]) => prCommits.filter(prCommit => !prCommit.commit.message.startsWith('Merge branch \'master\' '));
const filterLernaCommits = (prCommits: PRCommit[]) => prCommits.filter(prCommits => !prCommits.commit.message.startsWith('chore(release): lerna publish'));

const getFirstCommitDateTime = (prCommits: PRCommit[]) => prCommits[0].commit.author.date;

const getLastHumanCommitDateTime = (prCommits: PRCommit[]) => prCommits[prCommits.length - 1].commit.author.date;

const getLeadTime = (pr: PullRequest, commits: PRCommit[]) => 
  (+new Date(pr.merged_at) - +new Date(getLastHumanCommitDateTime(commits))) / (1000 * 60 * 60); // In hours

const getCycleTime = (commits: PRCommit[]) => 
  (+new Date(getLastHumanCommitDateTime(commits)) - +new Date(getFirstCommitDateTime(commits))) / (1000 * 60 * 60); // In hours

const getFieldsForPR = (prObj: PullRequestReportObject) => {
  const pr = prObj.pullRequest;
  const { html_url, title, created_at, merged_at } = pr;
  const commits = filterMasterMerges(
    filterLernaCommits(
      sortPRCommits(prObj.commits)
    )
  );
  return [
    html_url,
    title.replace(/,/g,''), // Get rid of comma's since we're using a comma delimiter
    created_at,
    merged_at,
    getFirstCommitDateTime(commits),
    getLastHumanCommitDateTime(commits),
    getCycleTime(commits),
    getLeadTime(pr, commits),
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
  reportMap.forEach(prObj => {
    try {
      console.log(getFieldsForPR(prObj).join(','))
    } catch (err) {
      console.error(`Error extracting data for PR ${prObj.pullRequest.html_url}`);
      console.error(err.message, err.stack);
    }
  });
};

const run = async () => {
  const responses = await prompts(dateRangeQuestions);
  const prs = await getPrs(responses.startDate, responses.endDate);
  const [ commitMap, fileMap ] = await Promise.all([
    getCommits(prs),
    getFiles(prs)
  ]);
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
