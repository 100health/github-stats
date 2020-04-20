import axios from 'axios';
import * as debug from 'debug';

export interface PullRequest {
  url: string;
  id: number;
  node_id: string;
  html_url: string;
  diff_url: string;
  patch_url: string;
  issue_url: string;
  commits_url: string;
  review_comments_url: string;
  review_comment_url: string;
  statuses_url: string;
  number: number;
  state: 'open' | 'closed';
  locked: boolean;
  title: string;
  user: User;
  body: string;
  created_at: Date;
  updated_at: Date;
  closed_at: Date;
  merged_at: Date;
  merge_commit_sha: string;
}

interface User {
  login: string;
  id: number;
  node_id: 'string';
}

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const logger = debug('redox:pull-requests');

const ax = axios.create({
  headers: {
    'Authorization': `token ${GITHUB_TOKEN}`
  },
  baseURL: 'https://api.github.com/'
});

ax.interceptors.request.use((config) => {
  logger('Initiating request: ', config.url);
  return config;
});

export const getPrsInTimeWindow = async (afterTime: Date, beforeTime: Date, repo: string) => {
  let earliest = new Date(); // Initialize to right now
  let page = 1; // initialize page to page 1
  const prs: PullRequest[] = [];
  while (earliest > afterTime) {
    const newPrs = await getPrsPage(repo, page);
    logger(`${newPrs.length} retrieved`);

    if (!newPrs.length) {
      break;
    }

    earliest = new Date(newPrs[newPrs.length -1].created_at);
    logger(`Earliest PR retrieved: ${earliest}`);

    page++;

    const filteredPrs = newPrs.filter((pr) => new Date(pr.created_at) < beforeTime && new Date(pr.created_at) > afterTime);

    filteredPrs.forEach(pr => prs.push(pr));
  }
  return prs;
};

export const getPrsPage = async (repo: string, page: number): Promise<PullRequest[]> => {
  const response = await ax.get(`repos/100health/${repo}/pulls?state=closed&per_page=100&base=master&page=${page}&sort=created&direction=desc`);
  const headers = response.headers;
  logger(`x-ratelimit-limit: ${headers['x-ratelimit-limit']}`);
  logger(`x-ratelimit-remaining: ${headers['x-ratelimit-remaining']}`);
  logger(`x-ratelimit-reset: ${headers['x-ratelimit-reset']} which is ${new Date(headers['x-ratelimit-reset'] * 1000)}`);
  return response.data;
};