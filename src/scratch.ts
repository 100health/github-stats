import { getPRCommits, getPRFiles, getSinglePR } from './pull-requests';

const doIt = async () => {
  const pr = await getSinglePR('https://github.com/100health/redox-services/pull/2991');
  const files = await getPRFiles(pr);
  const commits = await getPRCommits(pr);

  console.log(JSON.stringify({
    pr,
    commits,
    files
  }));
};

doIt();