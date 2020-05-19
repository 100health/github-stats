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
  head: Branch;
  base: Branch;
  _links: Links;
}

interface Branch {
  label: string;
  ref: string;
  sha: string;
  user: User;
  repo: Repo;
}

interface Repo {
  id: number;
  node_id: string;
  full_name: string;
  private: boolean;
  owner: User;
  html_url: string;
  description: string;
  fork: boolean;
  url: string;
}

interface Link {
  href: string;
}

interface Links {
  self: Link;
  html: Link;
  issue: Link;
  comments: Link;
  review_comments: Link;
  review_comment: Link;
  commits: Link;
  statuses: Link;
}
interface User {
  login: string;
  id: number;
  node_id: 'string';
}

export interface PRCommit {
  url: string;
  sha: string;
  node_id: string;
  html_url: string;
  comments_url: string;
  commit: Commit;
  author: User;
  committer: User;
  parents: {
    url: string;
    sha: string;
  }[];
}

interface Commit {
  url: string;
  author: {
    name: string;
    email: string;
    date: string;
  },
  committer: {
    name: string;
    email: string;
    date: string;
  },
  message: string;
  tree: {
    url: string;
    sha: string;
  },
  comment_count: number;
  verification: Object;
}

export interface PRFile {
  sha: string;
  filename: string;
  status: string;
  additions: number;
  deletions: number;
  changes: number;
  blob_url: string;
  raw_url: string;
  contents_url: string;
  patch: string;
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

export const getPRCommits = async (pr: PullRequest): Promise<PRCommit[]> => await (await ax.get(pr.commits_url)).data;
export const getPRFiles = async (pr: PullRequest): Promise<PRFile[]> => await (await ax.get(`${pr.url}/files`)).data;
// GET /repos/:owner/:repo/pulls/:pull_number/files

export const isRevertPR = (pr: PullRequest): boolean => {
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
}