import type { ProjectType } from './types';

export const SEED_REPOS: Record<ProjectType, string> = {
  next: 'https://github.com/blanck1945/boogiepop-next-seed',
  vite: 'https://github.com/blanck1945/boogiepop-react-seed',
  streamlit: 'https://github.com/blanck1945/boogiepop-streamlit-seed',
};

export const SEED_PACKAGE_NAMES: Record<ProjectType, string> = {
  next: 'boogiepop-next-seed',
  vite: 'boogiepop-react-seed',
  streamlit: 'boogiepop-streamlit-seed',
};

export const WORKFLOW_TEMPLATE_FILES: Record<ProjectType, string> = {
  next: 'next-deploy.yml.tpl',
  vite: 'vite-deploy.yml.tpl',
  streamlit: 'streamlit-deploy.yml.tpl',
};
